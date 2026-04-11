"""Stripe — webhooks, Connect, Billing, loyer payments.

Routes :
  POST /connect/onboard          → Stripe Connect Express onboarding
  GET  /connect/status           → vérifier le compte Connect
  POST /checkout                 → créer une session Checkout abonnement
  GET  /subscription             → abonnement actif de l'utilisateur
  POST /loyer/{paiement_id}      → PaymentIntent loyer (4% Althy)
  POST /webhook                  → événements Stripe asynchrones

Règle absolue CLAUDE.md :
  - 4 % Althy prélevé en application_fee (transfer_data.destination = compte proprio)
  - Jamais afficher "commission" côté utilisateur → toujours "Loyer net reçu"
  - CHF 90 frais dossier → uniquement si locataire retenu (POST /locataires/{id}/retenir)
"""

from __future__ import annotations

import json
import uuid
from datetime import date
from typing import Annotated, Literal

import httpx
import stripe
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

PLATFORM_FEE_PCT = settings.STRIPE_PLATFORM_FEE_PCT  # 4.0


# ═════════════════════════════════════════════════════════════════════════════
# Stripe Connect — onboarding propriétaire
# ═════════════════════════════════════════════════════════════════════════════


@router.post("/connect/onboard")
async def create_connect_account(db: DbDep, user: AuthDep):
    """Crée ou récupère le compte Stripe Connect Express du propriétaire."""
    row = (await db.execute(
        text("SELECT stripe_account_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )).fetchone()
    account_id = row[0] if row else None

    if not account_id:
        account = stripe.Account.create(
            type="express",
            country="CH",
            email=user.email,
            capabilities={"transfers": {"requested": True}},
            business_type="individual",
        )
        account_id = account.id
        await db.execute(
            text("UPDATE profiles SET stripe_account_id = :aid WHERE user_id = :uid"),
            {"aid": account_id, "uid": str(user.id)},
        )
        await db.commit()

    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{settings.ALLOWED_ORIGINS[0]}/app/abonnement?connect=refresh",
        return_url=f"{settings.ALLOWED_ORIGINS[0]}/app/abonnement?connect=success",
        type="account_onboarding",
    )
    return {"url": link.url}


@router.get("/connect/status")
async def get_connect_status(db: DbDep, user: AuthDep):
    """Retourne le statut du compte Stripe Connect du propriétaire."""
    row = (await db.execute(
        text("SELECT stripe_account_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )).fetchone()
    if not row or not row[0]:
        return {"connected": False}

    account = stripe.Account.retrieve(row[0])
    return {
        "connected": True,
        "details_submitted": account.details_submitted,
        "charges_enabled": account.charges_enabled,
        "payouts_enabled": account.payouts_enabled,
        "account_id": row[0],
    }


# ═════════════════════════════════════════════════════════════════════════════
# Stripe Billing — abonnements
# ═════════════════════════════════════════════════════════════════════════════


class CheckoutRequest(BaseModel):
    plan: Literal["proprio", "pro", "agence", "portail"]


PLAN_PRICE_MAP = {
    "proprio": "STRIPE_PRICE_PROPRIO_MONTHLY",
    "pro":     "STRIPE_PRICE_PRO_MONTHLY",
    "agence":  "STRIPE_PRICE_AGENCY_MONTHLY",
    "portail": "STRIPE_PRICE_PORTAL_MONTHLY",
}


@router.post("/checkout")
async def create_checkout_session(payload: CheckoutRequest, db: DbDep, user: AuthDep):
    """
    Crée une session Stripe Checkout pour l'abonnement choisi.
    Retourne l'URL de la page de paiement Stripe.
    """
    price_attr = PLAN_PRICE_MAP.get(payload.plan)
    if not price_attr:
        raise HTTPException(400, "Plan inconnu")
    price_id: str = getattr(settings, price_attr, "")
    if not price_id:
        raise HTTPException(500, f"Prix Stripe non configuré pour le plan {payload.plan}")

    # Récupérer ou créer le customer Stripe
    row = (await db.execute(
        text("SELECT stripe_customer_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )).fetchone()
    customer_id = row[0] if row else None

    if not customer_id:
        customer = stripe.Customer.create(email=user.email, metadata={"user_id": str(user.id)})
        customer_id = customer.id
        await db.execute(
            text("UPDATE profiles SET stripe_customer_id = :cid WHERE user_id = :uid"),
            {"cid": customer_id, "uid": str(user.id)},
        )
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.ALLOWED_ORIGINS[0]}/app/abonnement?checkout=success",
        cancel_url=f"{settings.ALLOWED_ORIGINS[0]}/app/abonnement?checkout=cancel",
        metadata={"user_id": str(user.id), "plan": payload.plan},
        subscription_data={"metadata": {"user_id": str(user.id), "plan": payload.plan}},
    )
    return {"url": session.url}


@router.get("/subscription")
async def get_subscription(db: DbDep, user: AuthDep):
    """Retourne l'abonnement actif de l'utilisateur."""
    row = (await db.execute(
        text("""
            SELECT plan, status, current_period_end
            FROM subscriptions
            WHERE user_id = :uid AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"uid": str(user.id)},
    )).fetchone()

    if not row:
        return {"plan": "starter", "status": "no_subscription", "current_period_end": None}

    return {
        "plan": row[0],
        "status": row[1],
        "current_period_end": row[2].isoformat() if row[2] else None,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Paiement loyer via Stripe Connect
# ═════════════════════════════════════════════════════════════════════════════


class LoyerPaymentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    loyer_brut: float    # montant réel (ex: 1800)
    loyer_net: float     # loyer_brut - 4% Althy (ex: 1728) — affiché "Loyer net reçu"
    frais_althy: float   # 4% (ex: 72) — JAMAIS affiché à l'utilisateur


@router.post("/loyer/{paiement_id}", response_model=LoyerPaymentResponse)
async def initiate_loyer_payment(
    paiement_id: uuid.UUID,
    db: DbDep,
    user: AuthDep,
):
    """
    Crée un PaymentIntent Stripe pour le paiement d'un loyer.
    Prélève automatiquement 4% d'application_fee pour Althy.
    Transfère le solde (96%) au compte Connect du propriétaire.

    Le frontend affiche uniquement : "Loyer net reçu : CHF {loyer_net}"
    Le frais_althy n'est JAMAIS affiché.
    """
    # Récupérer le paiement + le compte Connect du proprio + locataire
    row = (await db.execute(
        text("""
            SELECT p.montant, p.bien_id, p.locataire_id, b.owner_id,
                   pr.stripe_account_id
            FROM paiements p
            JOIN biens b ON b.id = p.bien_id
            JOIN profiles pr ON pr.user_id = b.owner_id
            WHERE p.id = :pid AND p.statut = 'en_attente'
        """),
        {"pid": str(paiement_id)},
    )).fetchone()

    if not row:
        raise HTTPException(404, "Paiement introuvable ou déjà réglé")

    montant, bien_id, locataire_id, owner_id, stripe_account_id = row

    if not stripe_account_id:
        raise HTTPException(
            422,
            "Le propriétaire n'a pas encore connecté son compte Stripe. "
            "Il doit compléter l'onboarding depuis son espace Abonnement.",
        )

    loyer_brut = float(montant)
    frais_althy = round(loyer_brut * PLATFORM_FEE_PCT / 100, 2)
    loyer_net = round(loyer_brut - frais_althy, 2)

    # Montant en centimes pour Stripe
    amount_centimes = int(loyer_brut * 100)
    fee_centimes = int(frais_althy * 100)

    pi = stripe.PaymentIntent.create(
        amount=amount_centimes,
        currency="chf",
        application_fee_amount=fee_centimes,
        transfer_data={"destination": stripe_account_id},
        metadata={
            "type": "loyer",
            "paiement_id": str(paiement_id),
            "bien_id": str(bien_id),
            "locataire_id": str(locataire_id) if locataire_id else "",
            "owner_id": str(owner_id),
            "loyer_net": str(loyer_net),
        },
        description=f"Loyer net reçu : CHF {loyer_net}",
        automatic_payment_methods={"enabled": True},
    )

    # Stocker le PI ID sur le paiement dès maintenant
    await db.execute(
        text("UPDATE paiements SET stripe_payment_intent_id = :pi WHERE id = :pid"),
        {"pi": pi.id, "pid": str(paiement_id)},
    )
    await db.commit()

    return LoyerPaymentResponse(
        client_secret=pi.client_secret,
        payment_intent_id=pi.id,
        loyer_brut=loyer_brut,
        loyer_net=loyer_net,
        frais_althy=frais_althy,
    )


# ═════════════════════════════════════════════════════════════════════════════
# Webhook Stripe (événements asynchrones)
# ═════════════════════════════════════════════════════════════════════════════


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: DbDep,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """Point d'entrée unique pour tous les événements Stripe."""
    body = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload=body,
            sig_header=stripe_signature,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Signature webhook invalide")

    etype = event["type"]
    data = event["data"]["object"]

    # ── checkout.session.completed → créer ou activer l'abonnement ────────
    if etype == "checkout.session.completed":
        customer_id = data.get("customer")
        sub_id = data.get("subscription")
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        plan = metadata.get("plan", "proprio")
        if customer_id and user_id:
            await db.execute(
                text("""
                    INSERT INTO subscriptions
                        (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
                    VALUES (:uid, :cid, :sid, :plan, 'active')
                    ON CONFLICT (user_id) DO UPDATE
                    SET stripe_customer_id  = :cid,
                        stripe_subscription_id = :sid,
                        plan = :plan,
                        status = 'active',
                        updated_at = now()
                """),
                {"uid": user_id, "cid": customer_id, "sid": sub_id, "plan": plan},
            )
            await db.commit()

    # ── Abonnement modifié ─────────────────────────────────────────────────
    elif etype == "customer.subscription.updated":
        customer_id = data.get("customer")
        new_status = data.get("status")
        plan_id = data["items"]["data"][0]["price"]["id"] if data.get("items") else None
        plan_name = _price_to_plan(plan_id)
        if customer_id:
            await db.execute(
                text("""
                    UPDATE subscriptions
                    SET status = :s, plan = :p,
                        current_period_start = to_timestamp(:ps),
                        current_period_end   = to_timestamp(:pe),
                        updated_at = now()
                    WHERE stripe_customer_id = :cid
                """),
                {
                    "s": new_status, "p": plan_name,
                    "ps": data.get("current_period_start"),
                    "pe": data.get("current_period_end"),
                    "cid": customer_id,
                },
            )
            await db.commit()

    elif etype == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            await db.execute(
                text("""
                    UPDATE subscriptions
                    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
                    WHERE stripe_customer_id = :cid
                """),
                {"cid": customer_id},
            )
            await db.commit()

    # ── Loyer reçu ─────────────────────────────────────────────────────────
    elif etype == "payment_intent.succeeded":
        await _handle_payment_intent_succeeded(db, data)

    # ── Loyer impayé (PaymentIntent manuel) ───────────────────────────────
    elif etype == "payment_intent.payment_failed":
        pi_id = data.get("id")
        reason = data.get("last_payment_error", {}).get("message", "Échec paiement")
        metadata = data.get("metadata", {})
        paiement_id = metadata.get("paiement_id")

        if paiement_id:
            await db.execute(
                text("""
                    UPDATE paiements SET statut = 'retard', updated_at = now()
                    WHERE id = :pid
                """),
                {"pid": paiement_id},
            )
        await db.execute(
            text("""
                UPDATE transactions SET status = 'failed', failure_reason = :r, updated_at = now()
                WHERE stripe_payment_intent_id = :pi
            """),
            {"r": reason, "pi": pi_id},
        )
        await db.commit()

    # ── Loyer impayé (facture récurrente Stripe Billing) ──────────────────
    elif etype == "invoice.payment_failed":
        await _handle_invoice_payment_failed(db, data)

    # ── Compte Connect vérifié ─────────────────────────────────────────────
    elif etype == "account.updated":
        account_id = data.get("id")
        if data.get("payouts_enabled"):
            await db.execute(
                text("UPDATE profiles SET updated_at = now() WHERE stripe_account_id = :aid"),
                {"aid": account_id},
            )
            await db.commit()

    return {"received": True}


# ─── Handlers internes ────────────────────────────────────────────────────────


async def _handle_payment_intent_succeeded(
    db: AsyncSession,
    data: dict,
) -> None:
    """
    Traite un PaymentIntent réussi.
    Seuls les PaymentIntents de type 'loyer' (metadata.type == 'loyer') sont traités.
    """
    pi_id = data.get("id")
    metadata = data.get("metadata", {})

    # Ne traiter que les paiements de loyer identifiés
    if metadata.get("type") != "loyer":
        return

    amount = data.get("amount_received", 0) / 100
    paiement_id = metadata.get("paiement_id")
    bien_id = metadata.get("bien_id")
    owner_id = metadata.get("owner_id")
    loyer_net_meta = metadata.get("loyer_net")
    locataire_id = metadata.get("locataire_id")

    frais_althy = round(amount * PLATFORM_FEE_PCT / 100, 2)
    net_amount = float(loyer_net_meta) if loyer_net_meta else round(amount - frais_althy, 2)

    if paiement_id:
        # Mettre à jour la table paiements (Althy natif)
        # frais_althy stocké dans net_montant (loyer brut - frais = loyer net reçu)
        await db.execute(
            text("""
                UPDATE paiements
                SET statut = 'recu',
                    date_paiement = CURRENT_DATE,
                    net_montant = :net,
                    stripe_payment_intent_id = :pi,
                    updated_at = now()
                WHERE id = :pid
            """),
            {"net": net_amount, "pi": pi_id, "pid": paiement_id},
        )

    # Mettre à jour la table transactions (avec platform_fee = frais Althy 4%)
    lease_id = metadata.get("lease_id")
    await db.execute(
        text("""
            UPDATE transactions
            SET status = 'paid', paid_date = now(),
                stripe_payment_intent_id = :pi,
                net_amount = :net, platform_fee = :fee,
                updated_at = now()
            WHERE stripe_payment_intent_id = :pi
               OR (lease_id = :lid AND status = 'pending' AND :lid IS NOT NULL)
        """),
        {"pi": pi_id, "net": net_amount, "fee": frais_althy, "lid": lease_id},
    )

    # Notification proprio : loyer reçu
    if owner_id:
        montant_fmt = f"CHF {net_amount:,.2f}".replace(",", " ")
        await db.execute(
            text("""
                INSERT INTO notifications (user_id, type, titre, message, lien, created_at, updated_at)
                VALUES (:uid, 'loyer_recu', 'Loyer reçu', :msg, :lien, now(), now())
            """),
            {
                "uid": owner_id,
                "msg": f"Loyer net reçu : {montant_fmt} (frais Althy 4% déduits).",
                "lien": f"/app/biens/{bien_id}/finances" if bien_id else "/app/finances",
            },
        )

    # Audit log
    await db.execute(
        text("""
            INSERT INTO audit_logs
                (id, user_id, action, resource_type, resource_id, new_values, created_at)
            VALUES
                (:id, :uid, 'loyer_recu', 'paiement', :rid, :nv::jsonb, now())
        """),
        {
            "id": str(uuid.uuid4()),
            "uid": owner_id,
            "rid": paiement_id,
            "nv": json.dumps({
                "stripe_pi": pi_id,
                "montant_brut": amount,
                "frais_althy": frais_althy,
                "loyer_net": net_amount,
                "bien_id": bien_id,
                "locataire_id": locataire_id,
            }),
        },
    )

    await db.commit()


async def _handle_invoice_payment_failed(
    db: AsyncSession,
    data: dict,
) -> None:
    """
    Traite l'échec d'une facture récurrente (invoice.payment_failed).
    Crée une ai_action 'relancer_loyer' urgente et envoie un SMS au proprio.
    """
    customer_id = data.get("customer")
    invoice_id = data.get("id")
    amount_due = data.get("amount_due", 0) / 100
    period_end = data.get("period_end")

    if not customer_id:
        return

    # Trouver le proprio via son stripe_customer_id
    row = (await db.execute(
        text("""
            SELECT p.user_id, u.email, p.phone
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.stripe_customer_id = :cid
            LIMIT 1
        """),
        {"cid": customer_id},
    )).fetchone()

    if not row:
        return

    owner_id, owner_email, owner_phone = row

    # Créer une ai_action 'relancer_loyer' avec urgence haute
    await db.execute(
        text("""
            INSERT INTO ai_actions
                (id, user_id, action_type, titre, description, urgence, payload, status, created_at)
            VALUES
                (:id, :uid, 'relancer_loyer',
                 'Loyer impayé — relance requise',
                 :desc,
                 'haute',
                 :payload::jsonb,
                 'pending',
                 now())
        """),
        {
            "id": str(uuid.uuid4()),
            "uid": str(owner_id),
            "desc": (
                f"La facture Stripe {invoice_id} de CHF {amount_due:.2f} "
                "n'a pas pu être prélevée. Contactez votre locataire."
            ),
            "payload": json.dumps({
                "invoice_id": invoice_id,
                "customer_id": customer_id,
                "amount_due": amount_due,
                "period_end": period_end,
                "type": "invoice_failed",
            }),
        },
    )

    # Notification in-app
    await db.execute(
        text("""
            INSERT INTO notifications (user_id, type, titre, message, lien, created_at, updated_at)
            VALUES (:uid, 'loyer_impaye', 'Loyer impayé', :msg, '/app/finances', now(), now())
        """),
        {
            "uid": str(owner_id),
            "msg": (
                f"Le prélèvement du loyer (CHF {amount_due:.2f}) a échoué. "
                "Une relance automatique a été créée."
            ),
        },
    )

    await db.commit()

    # SMS Twilio au proprio (non-bloquant)
    if owner_phone and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        sms_body = (
            f"[Althy] Loyer impayé — CHF {amount_due:.2f} n'a pas pu être prélevé. "
            "Connectez-vous sur althy.ch pour relancer votre locataire."
        )
        try:
            async with httpx.AsyncClient(
                timeout=8,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            ) as client:
                await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/"
                    f"{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                    data={
                        "From": settings.TWILIO_FROM_NUMBER,
                        "To":   owner_phone,
                        "Body": sms_body,
                    },
                )
        except Exception:
            pass  # non-bloquant


def _price_to_plan(price_id: str | None) -> str:
    mapping = {
        settings.STRIPE_PRICE_PROPRIO_MONTHLY: "proprio",
        settings.STRIPE_PRICE_PRO_MONTHLY: "pro",
        settings.STRIPE_PRICE_AGENCY_MONTHLY: "agence",
        settings.STRIPE_PRICE_PORTAL_MONTHLY: "portail",
    }
    return mapping.get(price_id or "", "proprio")
