from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.notification import Notification
from app.models.paiement import Paiement
from app.models.user import User
from app.schemas.transaction import AgencyDashboard, OwnerDashboard
from app.services.transaction_service import TransactionService
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── KPI endpoints (existing) ──────────────────────────────────────────────────


@router.get("/owner", response_model=OwnerDashboard, summary="KPIs propriétaire")
async def owner_dashboard(current_user: AuthUserDep, db: DbDep) -> OwnerDashboard:
    """Revenue, occupancy rate, pending/late rents for the current owner."""
    return await TransactionService(db).owner_dashboard(current_user=current_user)


@router.get("/agency", response_model=AgencyDashboard, summary="KPIs agence")
async def agency_dashboard(current_user: AuthUserDep, db: DbDep) -> AgencyDashboard:
    """Portfolio stats, YTD revenue and commissions for an agency user."""
    return await TransactionService(db).agency_dashboard(current_user=current_user)


# ── Briefing IA ───────────────────────────────────────────────────────────────


class BriefingResponse(BaseModel):
    titre: str
    message: str
    date: str
    is_today: bool


@router.get("/briefing", response_model=BriefingResponse, summary="Briefing IA du jour")
async def get_briefing(current_user: AuthUserDep, db: DbDep) -> BriefingResponse:
    """
    Return today's AI briefing stored by the Celery task.
    Falls back to a placeholder if not yet generated.
    """
    result = await db.execute(
        select(Notification)
        .where(
            and_(
                Notification.user_id == current_user.id,
                Notification.type == "briefing_quotidien",
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(1)
    )
    notif = result.scalar_one_or_none()
    today = date.today().isoformat()

    if not notif:
        return BriefingResponse(
            titre=f"Briefing du {date.today().strftime('%d/%m/%Y')}",
            message="Votre briefing personnalisé sera généré automatiquement à 07h00.",
            date=today,
            is_today=False,
        )

    notif_date = notif.created_at.date().isoformat() if notif.created_at else ""
    return BriefingResponse(
        titre=notif.titre,
        message=notif.message,
        date=notif_date,
        is_today=(notif_date == today),
    )


# ── Économies vs régie ────────────────────────────────────────────────────────


class SavingsResponse(BaseModel):
    saved_this_month: float  # CHF saved vs typical régie commission
    saved_ytd: float         # Year-to-date savings
    nb_biens: int
    loyers_mois: float       # Total rents received this month
    regie_rate: float        # Régie commission rate used (8 %)


@router.get("/savings", response_model=SavingsResponse, summary="Économies vs régie")
async def get_savings(current_user: AuthUserDep, db: DbDep) -> SavingsResponse:
    """
    Compute how much the user saved vs a traditional régie this month.
    Formula: rents_received * 8% + CHF 75/bien admin fee.
    """
    today = date.today()
    mois_courant = today.strftime("%Y-%m")

    # Count user's biens
    biens_res = await db.execute(
        select(Bien.id).where(Bien.owner_id == current_user.id)
    )
    bien_ids = [r[0] for r in biens_res.fetchall()]
    nb_biens = len(bien_ids)

    # Sum loyers reçus this month
    loyers_mois = 0.0
    if bien_ids:
        paiements_res = await db.execute(
            select(Paiement).where(
                and_(
                    Paiement.bien_id.in_(bien_ids),
                    Paiement.statut == "recu",
                    Paiement.mois == mois_courant,
                )
            )
        )
        loyers_mois = sum(float(p.montant) for p in paiements_res.scalars().all())

    REGIE_RATE = 0.08  # 8 % commission régie typique en Suisse
    ADMIN_FEE_PER_BIEN = 75.0  # CHF/bien/mois frais administratifs

    commission_regie = loyers_mois * REGIE_RATE
    frais_admin = nb_biens * ADMIN_FEE_PER_BIEN
    saved_this_month = round(commission_regie + frais_admin, 0)

    # YTD: scale by months elapsed (Jan = 1 month)
    saved_ytd = round(saved_this_month * today.month, 0)

    return SavingsResponse(
        saved_this_month=saved_this_month,
        saved_ytd=saved_ytd,
        nb_biens=nb_biens,
        loyers_mois=loyers_mois,
        regie_rate=REGIE_RATE,
    )
