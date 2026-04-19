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
    plan: Literal["starter", "pro", "agence", "agence_premium", "portail"]


PLAN_PRICE_MAP = {
    "starter":        "STRIPE_PRICE_STARTER_MONTHLY",          # CHF 14/mois
    "pro":            "STRIPE_PRICE_PRO_MONTHLY",              # CHF 29/mois
    "agence":         "STRIPE_PRICE_AGENCY_MONTHLY",           # CHF 79/agent/mois
    "agence_premium": "STRIPE_PRICE_AGENCY_PREMIUM_MONTHLY",   # CHF 129/agent/mois
    "portail":        "STRIPE_PRICE_PORTAL_MONTHLY",           # CHF 9/mois
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

    pi = subscription.latest_invoice.payment_intent
    return {
        "client_secret": pi.client_secret,
        "subscription_id": subscription.id,
        "plan": payload.plan,
    }


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

    # ── payment_intent.succeeded — frais dossier CHF 90 uniquement ──────────
    # NOTE: les loyers ne passent plus par Stripe (QR-facture SPC 2.0 + CAMT.054)
    elif etype == "payment_intent.succeeded":
        pi_id = data.get("id")
        metadata = data.get("metadata", {})
        if metadata.get("type") == "frais_dossier":
            candidature_id = metadata.get("candidature_id")
            if candidature_id:
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


def _price_to_plan(price_id: str | None) -> str:
    mapping = {
        settings.STRIPE_PRICE_STARTER_MONTHLY: "starter",
        settings.STRIPE_PRICE_PRO_MONTHLY: "pro",
        settings.STRIPE_PRICE_PROPRIO_MONTHLY: "pro",              # legacy CHF 29 → grandfathered as "pro"
        settings.STRIPE_PRICE_AGENCY_MONTHLY: "agence",
        settings.STRIPE_PRICE_AGENCY_PREMIUM_MONTHLY: "agence_premium",
        settings.STRIPE_PRICE_PORTAL_MONTHLY: "portail",
    }
    return mapping.get(price_id or "", "gratuit")
