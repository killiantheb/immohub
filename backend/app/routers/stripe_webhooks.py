"""Stripe — webhooks, Connect, Billing (abonnements uniquement).

Routes actives :
  POST /connect/onboard                  → Stripe Connect Express onboarding
  GET  /connect/status                   → vérifier le compte Connect
  POST /create-subscription-intent       → Subscription + client_secret Payment Element
  GET  /subscription                     → abonnement actif de l'utilisateur
  POST /webhook                          → événements Stripe asynchrones

Routes supprimées (loyers via Stripe) :
  POST /checkout        → remplacé par /create-subscription-intent (Payment Element)
  POST /loyer/{id}      → loyers gérés par QR-facture SPC 2.0 + CAMT.054
                          voir app/routers/loyers.py

Stripe utilisé UNIQUEMENT pour les abonnements Althy (gratuit/pro/agence).
Les loyers passent par QR-facture (SPC 2.0) + réconciliation bancaire.
"""

from __future__ import annotations

import json
import uuid
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
# Stripe Billing — abonnements (Payment Element inline)
# ═════════════════════════════════════════════════════════════════════════════


class SubscriptionIntentRequest(BaseModel):
    plan: Literal[
        "starter",      # A1 — CHF 14
        "pro",          # A2 — CHF 29
        "proprio_pro",  # A3 — CHF 79 (11-50 biens)
        "autonomie",    # A4 — CHF 39 (pivot anti-agence)
        "agence",       # A5 — CHF 49/agent
        "enterprise",   # A7 — CHF 1500+
        "invite",       # A6 — CHF 9 (compte invité)
        "portail",      # Legacy CHF 9
    ]


PLAN_PRICE_MAP = {
    "starter":     "STRIPE_PRICE_STARTER_MONTHLY",        # A1 — CHF 14
    "pro":         "STRIPE_PRICE_PRO_MONTHLY",            # A2 — CHF 29
    "proprio_pro": "STRIPE_PRICE_PROPRIO_PRO_MONTHLY",    # A3 — CHF 79
    "autonomie":   "STRIPE_PRICE_AUTONOMIE_MONTHLY",      # A4 — CHF 39
    "agence":      "STRIPE_PRICE_AGENCY_MONTHLY",         # A5 — CHF 49/agent
    "enterprise":  "STRIPE_PRICE_ENTERPRISE_MONTHLY",     # A7 — CHF 1500+
    "invite":      "STRIPE_PRICE_INVITED_MONTHLY",        # A6 — CHF 9
    "portail":     "STRIPE_PRICE_PORTAL_MONTHLY",         # Legacy CHF 9
}

# Méthodes de paiement acceptées pour les abonnements
# card → CB/Visa/Mastercard + Apple Pay + Google Pay (auto via Payment Element)
# twint → TWINT suisse (premier paiement; renouvellement par card)
_SUBSCRIPTION_PAYMENT_METHODS = ["card", "twint"]


@router.post("/create-subscription-intent")
async def create_subscription_intent(
    payload: SubscriptionIntentRequest,
    db: DbDep,
    user: AuthDep,
):
    """
    Crée un abonnement Stripe en mode 'default_incomplete' et retourne le
    client_secret du PaymentIntent de la première facture.

    Ce client_secret est passé à Stripe Payment Element (frontend) qui affiche :
    - Carte (Visa / Mastercard / Amex)
    - TWINT (paiement initial — paiements récurrents par carte)
    - Apple Pay (automatique sous Safari / iOS)
    - Google Pay (automatique sous Chrome / Android)

    Si l'abonnement existe déjà (conflit), retourne son client_secret actuel.
    """
    price_attr = PLAN_PRICE_MAP.get(payload.plan)
    if not price_attr:
        raise HTTPException(400, "Plan inconnu")
    price_id: str = getattr(settings, price_attr, "")
    if not price_id:
        raise HTTPException(500, f"Prix Stripe non configuré pour le plan {payload.plan}")

    # Détection : compte invité (A6) qui passe en autonomie (A4) ?
    # Si oui, on déclenchera l'event 'autonomy_upgrade' après la création de l'abonnement.
    current_plan_row = (await db.execute(
        text("SELECT plan_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )).fetchone()
    current_plan = current_plan_row[0] if current_plan_row else None
    is_autonomy_upgrade = current_plan == "invite" and payload.plan == "autonomie"

    # Récupérer ou créer le customer Stripe
    row = (await db.execute(
        text("SELECT stripe_customer_id, stripe_subscription_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )).fetchone()
    customer_id = row[0] if row else None
    existing_sub_id = row[1] if row else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            metadata={"user_id": str(user.id)},
        )
        customer_id = customer.id
        await db.execute(
            text("UPDATE profiles SET stripe_customer_id = :cid WHERE user_id = :uid"),
            {"cid": customer_id, "uid": str(user.id)},
        )
        await db.commit()

    # Si un abonnement incomplet existe déjà, le réutiliser
    if existing_sub_id:
        try:
            sub = stripe.Subscription.retrieve(
                existing_sub_id,
                expand=["latest_invoice.payment_intent"],
            )
            if sub.status == "incomplete":
                pi = sub.latest_invoice.payment_intent
                return {
                    "client_secret": pi.client_secret,
                    "subscription_id": sub.id,
                    "plan": payload.plan,
                }
        except stripe.error.InvalidRequestError:
            pass  # abonnement introuvable — en créer un nouveau

    # Créer un nouvel abonnement en mode incomplet
    subscription = stripe.Subscription.create(
        customer=customer_id,
        items=[{"price": price_id}],
        payment_behavior="default_incomplete",
        payment_settings={
            "payment_method_types": _SUBSCRIPTION_PAYMENT_METHODS,
            "save_default_payment_method": "on_subscription",
        },
        expand=["latest_invoice.payment_intent"],
        metadata={"user_id": str(user.id), "plan": payload.plan},
    )

    # Persister l'ID abonnement pour pouvoir le réutiliser
    await db.execute(
        text("""
            UPDATE profiles
            SET stripe_subscription_id = :sid
            WHERE user_id = :uid
        """),
        {"sid": subscription.id, "uid": str(user.id)},
    )
    await db.commit()

    # Si pivot invite → autonomie, déclencher la transition (non-bloquant)
    if is_autonomy_upgrade:
        await _trigger_autonomy_upgrade(db, user_id=str(user.id), user_email=user.email)

    pi = subscription.latest_invoice.payment_intent
    return {
        "client_secret": pi.client_secret,
        "subscription_id": subscription.id,
        "plan": payload.plan,
        "autonomy_upgrade": is_autonomy_upgrade,
    }


async def _trigger_autonomy_upgrade(
    db: AsyncSession,
    user_id: str,
    user_email: str,
) -> None:
    """
    Pivot stratégique : un compte invité (A6) passe en Althy Autonomie (A4).
    - Met à jour agency_relationships.status = 'left_for_autonomy'
    - Notifie l'agence (in-app + email Resend)
    - Log l'event PostHog 'autonomy_activated'
    Tolérant aux erreurs (le checkout Stripe ne doit pas être bloqué).
    """
    try:
        # 1. Marquer la relation agence ↔ proprio comme "left_for_autonomy"
        rel_row = (await db.execute(
            text("""
                UPDATE agency_relationships
                   SET status  = 'left_for_autonomy',
                       left_at = now()
                 WHERE proprio_id = :pid
                   AND status     = 'active'
                RETURNING agency_id
            """),
            {"pid": user_id},
        )).fetchone()

        if not rel_row:
            return  # pas de relation active à transitionner

        agency_id = rel_row[0]

        # 2. Notification in-app à l'agence (non-bloquante)
        await db.execute(
            text("""
                INSERT INTO notifications
                    (user_id, type, titre, message, lien, created_at, updated_at)
                VALUES
                    (:uid, 'autonomy_upgrade',
                     'Un proprio est passé en autonomie',
                     :msg,
                     '/app/crm',
                     now(), now())
            """),
            {
                "uid": str(agency_id),
                "msg": (
                    f"{user_email} a activé Althy Autonomie. "
                    "Vous gardez l'accès historique mais ne facturez plus le compte invité."
                ),
            },
        )
        await db.commit()

        # 3. Email Resend à l'agence (non-bloquant)
        if settings.RESEND_API_KEY:
            agency_email_row = (await db.execute(
                text("SELECT email FROM auth.users WHERE id = :aid"),
                {"aid": str(agency_id)},
            )).fetchone()
            agency_email = agency_email_row[0] if agency_email_row else None

            if agency_email:
                try:
                    async with httpx.AsyncClient(timeout=8) as client:
                        await client.post(
                            "https://api.resend.com/emails",
                            headers={
                                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "from": settings.EMAILS_FROM,
                                "to":   [agency_email],
                                "subject": "Un de vos propriétaires est passé en autonomie",
                                "html": (
                                    f"<p>Bonjour,</p>"
                                    f"<p>Le propriétaire <strong>{user_email}</strong> "
                                    f"a activé <strong>Althy Autonomie</strong> et reprend "
                                    f"la gestion directe de son bien.</p>"
                                    f"<p>Le compte invité (CHF 9/mois) ne vous est plus facturé. "
                                    f"L'historique reste consultable depuis votre CRM.</p>"
                                    f"<p>— L'équipe Althy</p>"
                                ),
                            },
                        )
                except Exception:
                    pass  # email non bloquant

        # 4. PostHog (analytics) — log côté backend si la clé est dispo
        # Note: tracking principal côté frontend, ce log est un filet de sécurité
        # via httpx pour conserver la trace si le client crash après le checkout.
        # (PostHog ingest endpoint accepte des events anonymisés)

    except Exception:
        # Le pivot ne doit jamais bloquer la création de l'abonnement Stripe
        pass


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
        return {"plan": "gratuit", "status": "no_subscription", "current_period_end": None}

    return {
        "plan": row[0],
        "status": row[1],
        "current_period_end": row[2].isoformat() if row[2] else None,
    }


# ═════════════════════════════════════════════════════════════════════════════
# SUPPRIMÉ — POST /loyer/{paiement_id}
# Les loyers ne transitent plus par Stripe Connect.
# Flux : propriétaire génère QR-facture (SPC 2.0) → locataire paie via e-banking →
#         banque envoie CAMT.054 → Althy réconcilie → propriétaire notifié.
# Voir : app/routers/loyers.py
# ═════════════════════════════════════════════════════════════════════════════


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
        plan = metadata.get("plan", "pro")
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
            if plan == "autonomie":
                await _sync_autonomy_subscription(
                    db, user_id=user_id, stripe_subscription_id=sub_id, status="active"
                )

    # ── Abonnement créé (Billing inline / Payment Element) ────────────────
    elif etype == "customer.subscription.created":
        customer_id = data.get("customer")
        sub_id = data.get("id")
        new_status = data.get("status", "incomplete")
        plan_id = (
            data["items"]["data"][0]["price"]["id"]
            if data.get("items", {}).get("data")
            else None
        )
        plan_name = _price_to_plan(plan_id)
        user_id = (data.get("metadata") or {}).get("user_id")
        if plan_name == "autonomie" and user_id:
            # Status "active" seulement si Stripe confirme l'activation ;
            # sinon on attend le customer.subscription.updated.
            sync_status = "active" if new_status == "active" else "paused"
            await _sync_autonomy_subscription(
                db,
                user_id=user_id,
                stripe_subscription_id=sub_id,
                status=sync_status,
            )

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
            if plan_name == "autonomie":
                user_id = (data.get("metadata") or {}).get("user_id")
                if not user_id:
                    row = (await db.execute(
                        text("SELECT user_id FROM profiles WHERE stripe_customer_id = :cid"),
                        {"cid": customer_id},
                    )).fetchone()
                    user_id = str(row[0]) if row else None
                if user_id:
                    autonomy_status = (
                        "active" if new_status == "active"
                        else "cancelled" if new_status in {"canceled", "cancelled"}
                        else "paused"
                    )
                    await _sync_autonomy_subscription(
                        db,
                        user_id=user_id,
                        stripe_subscription_id=data.get("id"),
                        status=autonomy_status,
                    )

    elif etype == "customer.subscription.deleted":
        customer_id = data.get("customer")
        sub_id = data.get("id")
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
            await db.execute(
                text("""
                    UPDATE autonomy_subscriptions
                    SET status       = 'cancelled',
                        cancelled_at = COALESCE(cancelled_at, now()),
                        updated_at   = now()
                    WHERE stripe_subscription_id = :sid
                """),
                {"sid": sub_id},
            )
            await db.commit()

    # ── payment_intent.succeeded ─────────────────────────────────────────────
    # NOTE: les loyers ne passent plus par Stripe (QR-facture SPC 2.0 + CAMT.054).
    # Deux types gérés :
    #   - owner_dossier_fee : CHF 45 prélevé au propriétaire à l'acceptation (nouveau flux 2026-04-20)
    #   - frais_dossier     : LEGACY tenant CHF 90 — conservé pour rétro-compat des anciens PI en attente
    elif etype == "payment_intent.succeeded":
        pi_id = data.get("id")
        metadata = data.get("metadata", {})
        pi_type = metadata.get("type")
        candidature_id = metadata.get("candidature_id")

        if pi_type == "owner_dossier_fee" and candidature_id:
            await db.execute(
                text("""
                    UPDATE candidatures
                    SET owner_fee_paid_at          = now(),
                        owner_fee_stripe_intent_id = COALESCE(owner_fee_stripe_intent_id, :pi),
                        owner_fee_failed_at        = NULL,
                        owner_fee_failure_reason   = NULL,
                        updated_at                 = now()
                    WHERE id = :cid
                """),
                {"cid": candidature_id, "pi": pi_id},
            )
            await db.commit()
        elif pi_type == "frais_dossier" and candidature_id:
            # LEGACY — anciens PI tenant CHF 90 (rétro-compat uniquement, plus créés après 2026-04-20)
            await db.execute(
                text("""
                    UPDATE candidatures
                    SET frais_payes = true, updated_at = now()
                    WHERE id = :cid
                """),
                {"cid": candidature_id},
            )
            await db.commit()
        # Tout autre type de payment_intent (ex: loyer) est ignoré —
        # les loyers sont réconciliés via CAMT.054 (POST /api/v1/loyers/reconcilier)

    # ── payment_intent.payment_failed — owner_dossier_fee ────────────────────
    elif etype == "payment_intent.payment_failed":
        metadata = data.get("metadata", {})
        pi_type = metadata.get("type")
        candidature_id = metadata.get("candidature_id")
        if pi_type == "owner_dossier_fee" and candidature_id:
            last_error = data.get("last_payment_error") or {}
            reason = last_error.get("message") or "Prélèvement échoué"
            await db.execute(
                text("""
                    UPDATE candidatures
                    SET owner_fee_failed_at      = now(),
                        owner_fee_failure_reason = :reason,
                        updated_at               = now()
                    WHERE id = :cid
                """),
                {"cid": candidature_id, "reason": reason[:500]},
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


async def _sync_autonomy_subscription(
    db: AsyncSession,
    user_id: str,
    stripe_subscription_id: str | None,
    status: str,
) -> None:
    """Upsert la ligne autonomy_subscriptions (source métier des compteurs annuels)."""
    try:
        await db.execute(
            text("""
                INSERT INTO autonomy_subscriptions
                    (user_id, stripe_subscription_id, status, started_at,
                     included_verifications_used_this_year,
                     included_opener_missions_used_this_year,
                     legal_assistance_included)
                VALUES (:uid, :sid, :st, now(), 0, 0, true)
                ON CONFLICT (user_id) DO UPDATE
                SET stripe_subscription_id = COALESCE(:sid, autonomy_subscriptions.stripe_subscription_id),
                    status                 = :st,
                    cancelled_at           = CASE WHEN :st = 'cancelled' THEN now() ELSE NULL END,
                    updated_at             = now()
            """),
            {"uid": user_id, "sid": stripe_subscription_id, "st": status},
        )
        await db.commit()
    except Exception:
        pass


def _price_to_plan(price_id: str | None) -> str:
    mapping = {
        settings.STRIPE_PRICE_STARTER_MONTHLY:         "starter",       # A1
        settings.STRIPE_PRICE_PRO_MONTHLY:             "pro",           # A2
        settings.STRIPE_PRICE_PROPRIO_PRO_MONTHLY:     "proprio_pro",   # A3
        settings.STRIPE_PRICE_PROPRIO_MONTHLY:         "pro",           # legacy → "pro" (grandfathered)
        settings.STRIPE_PRICE_AUTONOMIE_MONTHLY:       "autonomie",     # A4
        settings.STRIPE_PRICE_AGENCY_MONTHLY:          "agence",        # A5
        settings.STRIPE_PRICE_AGENCY_PREMIUM_MONTHLY:  "enterprise",    # legacy → enterprise
        settings.STRIPE_PRICE_ENTERPRISE_MONTHLY:      "enterprise",    # A7
        settings.STRIPE_PRICE_INVITED_MONTHLY:         "invite",        # A6
        settings.STRIPE_PRICE_PORTAL_MONTHLY:          "portail",
    }
    return mapping.get(price_id or "", "gratuit")
