"""Rôle Insurance — réponse aux offres d'assurance, commission intégrée."""

from __future__ import annotations

import uuid as uuid_lib
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.rfq import RFQ
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


class InsuranceOfferCreate(BaseModel):
    rfq_id: str
    product_name: str
    insurer_name: str
    annual_premium_chf: float = Field(..., gt=0)
    coverage_details: str
    deductible_chf: float = Field(0.0, ge=0)
    commission_pct: float = Field(10.0, ge=0, le=50)
    notes: str | None = None


class InsuranceOfferRead(BaseModel):
    id: str
    rfq_id: str
    product_name: str
    insurer_name: str
    annual_premium_chf: float
    monthly_premium_chf: float
    coverage_details: str
    deductible_chf: float
    commission_pct: float
    commission_chf: float
    net_premium_chf: float
    notes: str | None
    owner_id: str
    status: str


class InsuranceDashboard(BaseModel):
    total_offers: int
    accepted_offers: int
    total_commission_chf: float
    pending_rfqs: int
    offers: list[InsuranceOfferRead]


@router.get("/dashboard", response_model=InsuranceDashboard)
async def insurance_dashboard(
    db: DbDep,
    current_user: AuthUserDep,
) -> InsuranceDashboard:
    """Dashboard assureur — offres déposées et commissions."""
    if current_user.role not in ("insurance", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux assureurs")

    # RFQs assurance ouverts (publiés ou en draft)
    rfq_result = await db.execute(
        select(RFQ).where(
            RFQ.category == "insurance",
            RFQ.status.in_(["published", "draft"]),
        ).order_by(RFQ.created_at.desc()).limit(50)
    )
    open_rfqs = rfq_result.scalars().all()

    # Offres de cet assureur
    my_rfq_result = await db.execute(
        select(RFQ).where(
            RFQ.category == "insurance",
            RFQ.owner_id == current_user.id,
        ).order_by(RFQ.created_at.desc()).limit(100)
    )
    my_rfqs = my_rfq_result.scalars().all()

    offers = [
        InsuranceOfferRead(
            id=str(r.id),
            rfq_id=str(r.id),
            product_name=r.title or "Offre assurance",
            insurer_name=current_user.first_name or "Assureur",
            annual_premium_chf=float(r.budget_max or 0),
            monthly_premium_chf=round(float(r.budget_max or 0) / 12, 2),
            coverage_details=r.description or "",
            deductible_chf=0.0,
            commission_pct=10.0,
            commission_chf=round(float(r.budget_max or 0) * 0.10, 2),
            net_premium_chf=round(float(r.budget_max or 0) * 0.90, 2),
            notes=None,
            owner_id=str(r.owner_id),
            status=r.status or "draft",
        )
        for r in my_rfqs
    ]

    accepted = [o for o in offers if o.status == "accepted"]
    total_commission = sum(o.commission_chf for o in accepted)

    return InsuranceDashboard(
        total_offers=len(offers),
        accepted_offers=len(accepted),
        total_commission_chf=round(total_commission, 2),
        pending_rfqs=len(open_rfqs),
        offers=offers,
    )


@router.get("/rfqs", response_model=list[dict])
async def list_insurance_rfqs(
    db: DbDep,
    current_user: AuthUserDep,
    limit: int = Query(50, ge=1, le=200),
) -> list[dict]:
    """Liste les appels d'offre assurance disponibles."""
    if current_user.role not in ("insurance", "super_admin", "agency", "owner", "tenant"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    result = await db.execute(
        select(RFQ).where(
            RFQ.category == "insurance",
        ).order_by(RFQ.created_at.desc()).limit(limit)
    )
    rfqs = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "title": r.title,
            "description": r.description,
            "status": r.status,
            "urgency": r.urgency,
            "budget_max": float(r.budget_max) if r.budget_max else None,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rfqs
    ]


@router.post("/rfqs/{rfq_id}/respond", status_code=status.HTTP_201_CREATED)
async def respond_to_rfq(
    rfq_id: str,
    payload: InsuranceOfferCreate,
    db: DbDep,
    current_user: AuthUserDep,
) -> InsuranceOfferRead:
    """Dépose une offre d'assurance en réponse à un appel d'offre."""
    if current_user.role not in ("insurance", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux assureurs")

    rfq_result = await db.execute(select(RFQ).where(RFQ.id == uuid_lib.UUID(rfq_id)))
    rfq = rfq_result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appel d'offre introuvable")

    offer_id = uuid_lib.uuid4()
    offer_rfq = RFQ(
        id=offer_id,
        title=f"Offre — {payload.product_name}",
        description=f"{payload.coverage_details}\n\nFranchise: {payload.deductible_chf} CHF\n{payload.notes or ''}",
        category="insurance",
        status="quotes_received",
        urgency="medium",
        budget_max=payload.annual_premium_chf,
        owner_id=current_user.id,
        property_id=rfq.property_id,
    )
    db.add(offer_rfq)
    await db.commit()

    commission = round(payload.annual_premium_chf * payload.commission_pct / 100, 2)
    return InsuranceOfferRead(
        id=str(offer_id),
        rfq_id=rfq_id,
        product_name=payload.product_name,
        insurer_name=payload.insurer_name,
        annual_premium_chf=payload.annual_premium_chf,
        monthly_premium_chf=round(payload.annual_premium_chf / 12, 2),
        coverage_details=payload.coverage_details,
        deductible_chf=payload.deductible_chf,
        commission_pct=payload.commission_pct,
        commission_chf=commission,
        net_premium_chf=round(payload.annual_premium_chf - commission, 2),
        notes=payload.notes,
        owner_id=str(current_user.id),
        status="quotes_received",
    )
