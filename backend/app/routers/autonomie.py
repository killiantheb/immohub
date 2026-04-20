"""Router FastAPI — /api/v1/autonomie

Endpoints du pivot stratégique Althy Autonomie (A4 — CHF 39/mois) :
  GET   /eligibility             — vérifie l'éligibilité du user connecté
  POST  /comparison              — calcule l'économie vs régie (public)
  POST  /subscribe               — active l'abonnement après paiement Stripe
  POST  /cancel                  — annule l'abonnement (statut cancelled)
  GET   /usage                   — compteurs d'unités incluses
  POST  /trigger-verification    — décrémente le quota vérification
  POST  /trigger-opener-mission  — décrémente le quota mission ouvreur
  POST  /legal-request           — 501 stub (assistance juridique)
  POST  /fiscal-export           — 501 stub (export fiscal)
"""

from __future__ import annotations

import uuid as _uuid
from typing import Annotated, Literal

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.autonomy_service import (
    AUTONOMIE_PRICE_MONTHLY,
    INCLUDED_OPENER_MISSIONS_PER_YEAR,
    INCLUDED_VERIFICATIONS_PER_YEAR,
    activate_autonomy,
    calculate_comparison,
    cancel_autonomy,
    consume_opener_mission,
    consume_verification,
)
from app.models.autonomy import AutonomySubscription
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ── Schémas ───────────────────────────────────────────────────────────────────


class ComparisonRequest(BaseModel):
    nb_biens: int = Field(..., ge=1, le=200)
    loyer_moyen_mensuel: float = Field(..., ge=0, le=50000)


class ComparisonResponse(BaseModel):
    nb_biens: int
    loyer_moyen_mensuel: float
    loyers_annuels: float
    cout_regie_annuel: float
    cout_autonomie_annuel: float
    economie_annuelle: float
    economie_pct: float
    details_regie: dict
    details_autonomie: dict


class SubscribeRequest(BaseModel):
    stripe_subscription_id: str | None = None
    previous_agency_id: _uuid.UUID | None = None


class UsageResponse(BaseModel):
    status: Literal["active", "paused", "cancelled"]
    verifications_used: int
    verifications_included: int
    verifications_remaining: int
    opener_missions_used: int
    opener_missions_included: int
    opener_missions_remaining: int
    legal_assistance_included: bool
    started_at: str
    cancelled_at: str | None


class CancelRequest(BaseModel):
    reason: str | None = Field(None, max_length=500)


class EligibilityResponse(BaseModel):
    eligible: bool
    current_plan: str | None
    reason: str | None


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_subscription(
    db: AsyncSession, user_id: _uuid.UUID
) -> AutonomySubscription | None:
    stmt = select(AutonomySubscription).where(
        AutonomySubscription.user_id == user_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ── GET /eligibility ──────────────────────────────────────────────────────────


@router.get("/eligibility", response_model=EligibilityResponse)
async def check_eligibility(db: DbDep, current_user: AuthDep) -> EligibilityResponse:
    """
    Un user est éligible à Autonomie s'il est proprio_solo ou invite.
    Un locataire, agence ou super_admin ne peut pas souscrire.
    """
    role = getattr(current_user, "role", None)
    plan = getattr(current_user, "plan_id", None)

    if role not in {"proprio_solo", "invite", "owner"}:
        return EligibilityResponse(
            eligible=False,
            current_plan=plan,
            reason="Althy Autonomie est réservé aux propriétaires.",
        )

    sub = await _get_subscription(db, current_user.id)
    if sub and sub.status == "active":
        return EligibilityResponse(
            eligible=False,
            current_plan="autonomie",
            reason="Vous êtes déjà abonné à Althy Autonomie.",
        )

    return EligibilityResponse(eligible=True, current_plan=plan, reason=None)


# ── POST /comparison (public) ─────────────────────────────────────────────────


@router.post("/comparison", response_model=ComparisonResponse)
async def compute_comparison(payload: ComparisonRequest) -> ComparisonResponse:
    """Public — calcule l'économie Autonomie vs régie pour la landing."""
    result = calculate_comparison(
        nb_biens=payload.nb_biens,
        loyer_moyen_mensuel=payload.loyer_moyen_mensuel,
    )
    return ComparisonResponse(**result)


# ── POST /subscribe ───────────────────────────────────────────────────────────


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: SubscribeRequest,
    db: DbDep,
    current_user: AuthDep,
) -> dict:
    """
    Active l'abonnement Autonomie après paiement Stripe confirmé.
    Le webhook Stripe est la source canonique ; cet endpoint sert surtout
    au flow front (confirmation immédiate post-paiement).
    """
    sub = await activate_autonomy(
        db=db,
        user_id=current_user.id,
        stripe_subscription_id=payload.stripe_subscription_id,
        previous_agency_id=payload.previous_agency_id,
    )
    await db.commit()
    return {
        "id": str(sub.id),
        "status": sub.status,
        "started_at": sub.started_at.isoformat(),
        "price_monthly": AUTONOMIE_PRICE_MONTHLY,
    }


# ── POST /cancel ──────────────────────────────────────────────────────────────


@router.post("/cancel")
async def cancel(
    payload: CancelRequest,
    db: DbDep,
    current_user: AuthDep,
) -> dict:
    sub = await cancel_autonomy(db, current_user.id, payload.reason)
    await db.commit()
    return {
        "id": str(sub.id),
        "status": sub.status,
        "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
    }


# ── GET /usage ────────────────────────────────────────────────────────────────


@router.get("/usage", response_model=UsageResponse)
async def get_usage(db: DbDep, current_user: AuthDep) -> UsageResponse:
    sub = await _get_subscription(db, current_user.id)
    if sub is None:
        raise HTTPException(404, "Aucun abonnement Autonomie pour cet utilisateur.")

    return UsageResponse(
        status=sub.status,  # type: ignore[arg-type]
        verifications_used=sub.included_verifications_used_this_year,
        verifications_included=INCLUDED_VERIFICATIONS_PER_YEAR,
        verifications_remaining=max(
            0,
            INCLUDED_VERIFICATIONS_PER_YEAR
            - sub.included_verifications_used_this_year,
        ),
        opener_missions_used=sub.included_opener_missions_used_this_year,
        opener_missions_included=INCLUDED_OPENER_MISSIONS_PER_YEAR,
        opener_missions_remaining=max(
            0,
            INCLUDED_OPENER_MISSIONS_PER_YEAR
            - sub.included_opener_missions_used_this_year,
        ),
        legal_assistance_included=sub.legal_assistance_included,
        started_at=sub.started_at.isoformat(),
        cancelled_at=sub.cancelled_at.isoformat() if sub.cancelled_at else None,
    )


# ── POST /trigger-verification ────────────────────────────────────────────────


@router.post("/trigger-verification")
async def trigger_verification(db: DbDep, current_user: AuthDep) -> dict:
    result = await consume_verification(db, current_user.id)
    await db.commit()
    return result


# ── POST /trigger-opener-mission ──────────────────────────────────────────────


@router.post("/trigger-opener-mission")
async def trigger_opener_mission(db: DbDep, current_user: AuthDep) -> dict:
    result = await consume_opener_mission(db, current_user.id)
    await db.commit()
    return result


# ── POST /legal-request (stub 501) ────────────────────────────────────────────


@router.post("/legal-request", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def legal_request(db: DbDep, current_user: AuthDep) -> dict:
    """Assistance juridique via partenaire — à intégrer avec le partenariat retenu."""
    raise HTTPException(
        status_code=501,
        detail="Assistance juridique : intégration partenaire en cours.",
    )


# ── POST /fiscal-export (stub 501) ────────────────────────────────────────────


@router.post("/fiscal-export", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def fiscal_export(db: DbDep, current_user: AuthDep) -> dict:
    """Export fiscal annuel — à intégrer (PDF pré-rempli formulaire revenus immobiliers)."""
    raise HTTPException(
        status_code=501,
        detail="Export fiscal : génération PDF à venir.",
    )
