"""Stripe webhooks — /api/v1/webhooks/stripe

Événements gérés :
- checkout.session.completed     → activer abonnement
- customer.subscription.updated  → mise à jour plan
- customer.subscription.deleted  → annulation abonnement
- payment_intent.succeeded       → loyer reçu (4% Althy → proprio)
- payment_intent.payment_failed  → loyer impayé → notification
- account.updated                → Stripe Connect account vérifié
"""

from __future__ import annotations

import stripe
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ── Stripe Connect onboarding ─────────────────────────────────────────────────

@router.post("/connect/onboard")
async def create_connect_account(
    db: DbDep,
    user: Annotated[User, Depends(get_current_user)],
):
    """Crée ou récupère le compte Stripe Connect du propriétaire."""
    # Vérifier si le compte existe déjà
    result = await db.execute(
        text("SELECT stripe_account_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = result.fetchone()
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

    # Générer le lien d'onboarding
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{settings.ALLOWED_ORIGINS[0]}/app/abonnement?connect=refresh",
        return_url=f"{settings.ALLOWED_ORIGINS[0]}/app/abonnement?connect=success",
        type="account_onboarding",
    )
    return {"url": link.url}


@router.get("/connect/status")
async def get_connect_status(
    db: DbDep,
    user: Annotated[User, Depends(get_current_user)],
):
    """Retourne le statut du compte Stripe Connect."""
    result = await db.execute(
        text("SELECT stripe_account_id FROM profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = result.fetchone()
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


# ── Webhook Stripe (événements asynchrones) ───────────────────────────────────

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
    data  = event["data"]["object"]

    # ── Abonnement créé / activé ───────────────────────────────────────────
    if etype == "customer.subscription.updated":
        customer_id = data.get("customer")
        new_status  = data.get("status")
        plan_id     = data["items"]["data"][0]["price"]["id"] if data.get("items") else None
        plan_name   = _price_to_plan(plan_id)
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
                    "s": new_status,
                    "p": plan_name,
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

    # ── Loyer reçu — enregistrer la transaction ────────────────────────────
    elif etype == "payment_intent.succeeded":
        pi_id    = data.get("id")
        amount   = data.get("amount_received", 0) / 100  # centimes → CHF
        metadata = data.get("metadata", {})
        lease_id = metadata.get("lease_id")
        if lease_id:
            platform_fee = round(amount * settings.STRIPE_PLATFORM_FEE_PCT / 100, 2)
            net_amount   = round(amount - platform_fee, 2)
            await db.execute(
                text("""
                    UPDATE transactions
                    SET status = 'paid',
                        paid_date = now(),
                        stripe_payment_intent_id = :pi,
                        net_amount   = :net,
                        platform_fee = :fee,
                        updated_at   = now()
                    WHERE stripe_payment_intent_id = :pi
                       OR (lease_id = :lid AND status = 'pending')
                """),
                {
                    "pi": pi_id,
                    "net": net_amount,
                    "fee": platform_fee,
                    "lid": lease_id,
                },
            )
            await db.commit()

    # ── Loyer impayé ───────────────────────────────────────────────────────
    elif etype == "payment_intent.payment_failed":
        pi_id    = data.get("id")
        reason   = data.get("last_payment_error", {}).get("message", "Échec paiement")
        await db.execute(
            text("""
                UPDATE transactions
                SET status = 'failed', failure_reason = :r, updated_at = now()
                WHERE stripe_payment_intent_id = :pi
            """),
            {"r": reason, "pi": pi_id},
        )
        await db.commit()

    # ── Compte Connect vérifié ─────────────────────────────────────────────
    elif etype == "account.updated":
        account_id = data.get("id")
        if data.get("payouts_enabled"):
            await db.execute(
                text("""
                    UPDATE profiles SET updated_at = now()
                    WHERE stripe_account_id = :aid
                """),
                {"aid": account_id},
            )
            await db.commit()

    return {"received": True}


def _price_to_plan(price_id: str | None) -> str:
    mapping = {
        settings.STRIPE_PRICE_PROPRIO_MONTHLY: "starter",
        settings.STRIPE_PRICE_PRO_MONTHLY: "pro",
        settings.STRIPE_PRICE_AGENCY_MONTHLY: "agency",
        settings.STRIPE_PRICE_PORTAL_MONTHLY: "portal",
    }
    return mapping.get(price_id or "", "starter")
