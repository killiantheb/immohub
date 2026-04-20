"""
Althy Autonomie (A4) service.

Cœur métier du pivot CHF 39/mois :
  - calculate_comparison : chiffrer l'économie vs régie traditionnelle
  - activate_autonomy    : créer/réactiver l'abonnement + reset compteurs
  - consume_verification : décrémente quota annuel (4 vérifs incluses)
  - consume_opener_mission : décrémente quota annuel (4 missions incluses)

Règle de base : les 4 vérifications + 4 missions sont offertes par année
civile (du 1er janvier au 31 décembre), pas sur 12 mois glissants.
Au-delà du quota, les unités sont facturées au tarif marketplace standard.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.models.autonomy import AutonomySubscription
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Constantes — prix de référence pour le comparatif (source : UBS Immobilier 2025)
# ─────────────────────────────────────────────────────────────────────────────

AUTONOMIE_PRICE_MONTHLY = 39.0
INCLUDED_VERIFICATIONS_PER_YEAR = 4
INCLUDED_OPENER_MISSIONS_PER_YEAR = 4

# Régie traditionnelle : ~5 % des loyers encaissés (moyenne suisse romande).
AGENCY_FEE_PCT = 0.05
# Frais administratifs forfaitaires annuels régie (contrats, EDL, quittances).
AGENCY_ADMIN_FEE_YEARLY = 400.0


# ─────────────────────────────────────────────────────────────────────────────
# Comparatif économique
# ─────────────────────────────────────────────────────────────────────────────


def calculate_comparison(
    nb_biens: int,
    loyer_moyen_mensuel: float,
) -> dict:
    """
    Chiffre l'économie annuelle Autonomie vs régie traditionnelle.

    Ex : 2 biens à CHF 2000/mois de loyer
      → Régie : 2 × 2000 × 12 × 5 % = CHF 2400 + CHF 400 admin = CHF 2800/an
      → Autonomie : CHF 468/an
      → Économie : CHF 2332/an (pour ~ 90 min/mois d'auto-gestion)
    """
    if nb_biens < 1 or loyer_moyen_mensuel < 0:
        raise HTTPException(400, "Paramètres invalides")

    loyers_annuels = nb_biens * loyer_moyen_mensuel * 12
    cout_regie = round(loyers_annuels * AGENCY_FEE_PCT + AGENCY_ADMIN_FEE_YEARLY, 2)
    cout_autonomie = round(AUTONOMIE_PRICE_MONTHLY * 12, 2)
    economie = round(cout_regie - cout_autonomie, 2)
    economie_pct = round((economie / cout_regie) * 100, 1) if cout_regie > 0 else 0.0

    return {
        "nb_biens": nb_biens,
        "loyer_moyen_mensuel": loyer_moyen_mensuel,
        "loyers_annuels": round(loyers_annuels, 2),
        "cout_regie_annuel": cout_regie,
        "cout_autonomie_annuel": cout_autonomie,
        "economie_annuelle": economie,
        "economie_pct": economie_pct,
        "details_regie": {
            "commission_pct": AGENCY_FEE_PCT * 100,
            "commission_amount": round(loyers_annuels * AGENCY_FEE_PCT, 2),
            "frais_admin": AGENCY_ADMIN_FEE_YEARLY,
        },
        "details_autonomie": {
            "prix_mensuel": AUTONOMIE_PRICE_MONTHLY,
            "verifications_incluses": INCLUDED_VERIFICATIONS_PER_YEAR,
            "missions_ouvreur_incluses": INCLUDED_OPENER_MISSIONS_PER_YEAR,
            "assistance_juridique": True,
            "partenariat_assurance": True,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Activation
# ─────────────────────────────────────────────────────────────────────────────


async def activate_autonomy(
    db: AsyncSession,
    user_id: uuid.UUID,
    stripe_subscription_id: str | None = None,
    previous_agency_id: uuid.UUID | None = None,
) -> AutonomySubscription:
    """
    Crée ou réactive l'abonnement Autonomie.
    Réinitialise les compteurs annuels au passage.
    """
    stmt = select(AutonomySubscription).where(
        AutonomySubscription.user_id == user_id
    )
    result = await db.execute(stmt)
    subscription = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if subscription is None:
        subscription = AutonomySubscription(
            user_id=user_id,
            stripe_subscription_id=stripe_subscription_id,
            status="active",
            started_at=now,
            previous_agency_id=previous_agency_id,
            included_verifications_used_this_year=0,
            included_opener_missions_used_this_year=0,
            legal_assistance_included=True,
        )
        db.add(subscription)
    else:
        subscription.status = "active"
        subscription.cancelled_at = None
        subscription.cancellation_reason = None
        if stripe_subscription_id:
            subscription.stripe_subscription_id = stripe_subscription_id
        if previous_agency_id and not subscription.previous_agency_id:
            subscription.previous_agency_id = previous_agency_id
        subscription.included_verifications_used_this_year = 0
        subscription.included_opener_missions_used_this_year = 0

    await db.flush()
    return subscription


# ─────────────────────────────────────────────────────────────────────────────
# Consommation des unités incluses
# ─────────────────────────────────────────────────────────────────────────────


async def _get_active_subscription(
    db: AsyncSession, user_id: uuid.UUID
) -> AutonomySubscription:
    stmt = select(AutonomySubscription).where(
        AutonomySubscription.user_id == user_id,
        AutonomySubscription.status == "active",
    )
    result = await db.execute(stmt)
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(404, "Abonnement Autonomie introuvable ou inactif")
    return subscription


async def consume_verification(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict:
    """
    Décrémente le quota de vérifications locataire (4/an incluses).
    Retourne {used, remaining, billed: bool}.
    Si le quota est épuisé, billed=True → le router doit facturer via marketplace.
    """
    sub = await _get_active_subscription(db, user_id)

    if sub.included_verifications_used_this_year < INCLUDED_VERIFICATIONS_PER_YEAR:
        sub.included_verifications_used_this_year += 1
        await db.flush()
        return {
            "used": sub.included_verifications_used_this_year,
            "remaining": INCLUDED_VERIFICATIONS_PER_YEAR
            - sub.included_verifications_used_this_year,
            "billed": False,
        }

    return {
        "used": sub.included_verifications_used_this_year,
        "remaining": 0,
        "billed": True,
    }


async def consume_opener_mission(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict:
    """Même logique pour les missions ouvreur (4/an incluses)."""
    sub = await _get_active_subscription(db, user_id)

    if sub.included_opener_missions_used_this_year < INCLUDED_OPENER_MISSIONS_PER_YEAR:
        sub.included_opener_missions_used_this_year += 1
        await db.flush()
        return {
            "used": sub.included_opener_missions_used_this_year,
            "remaining": INCLUDED_OPENER_MISSIONS_PER_YEAR
            - sub.included_opener_missions_used_this_year,
            "billed": False,
        }

    return {
        "used": sub.included_opener_missions_used_this_year,
        "remaining": 0,
        "billed": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Annulation
# ─────────────────────────────────────────────────────────────────────────────


async def cancel_autonomy(
    db: AsyncSession,
    user_id: uuid.UUID,
    reason: str | None = None,
) -> AutonomySubscription:
    sub = await _get_active_subscription(db, user_id)
    sub.status = "cancelled"
    sub.cancelled_at = datetime.now(UTC)
    sub.cancellation_reason = reason
    await db.flush()
    return sub
