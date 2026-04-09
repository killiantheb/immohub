"""Hunters router — off-market lead submissions — /api/v1/hunters"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.base import Base
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import Boolean, ForeignKey, Index, Numeric, Text, VARCHAR, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import select
from datetime import datetime, timezone

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Model (matches migration 0012 raw SQL) ────────────────────────────────────

class Hunter(Base):
    __tablename__ = "hunters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hunter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    address: Mapped[str] = mapped_column(VARCHAR(300), nullable=False)
    city: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    estimated_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    contact_name: Mapped[str | None] = mapped_column(VARCHAR(200))
    contact_phone: Mapped[str | None] = mapped_column(VARCHAR(30))
    contact_email: Mapped[str | None] = mapped_column(VARCHAR(200))
    status: Mapped[str] = mapped_column(VARCHAR(20), nullable=False, default="new")
    referral_amount: Mapped[float | None] = mapped_column(Numeric(8, 2))
    referral_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    off_market_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    referral_type: Mapped[str | None] = mapped_column(VARCHAR(20), default="vente")
    stripe_transfer_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_hunters_hunter_id", "hunter_id"),
        Index("ix_hunters_status", "status"),
        {"extend_existing": True},
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class HunterCreate(BaseModel):
    address: str
    city: str
    description: str | None = None
    estimated_price: float | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    referral_amount: float | None = None


class HunterRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    address: str
    city: str
    description: str | None
    estimated_price: float | None
    contact_name: str | None
    contact_phone: str | None
    contact_email: str | None
    status: str
    referral_amount: float | None
    referral_paid: bool
    off_market_visible: bool
    referral_type: str | None
    created_at: Any


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_hunters(db: DbDep, user: AuthUserDep):
    result = await db.execute(
        select(Hunter)
        .where(Hunter.hunter_id == user.id)
        .order_by(Hunter.created_at.desc())
    )
    items = result.scalars().all()
    return {"items": [HunterRead.model_validate(h) for h in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_hunter(body: HunterCreate, db: DbDep, user: AuthUserDep):
    if not body.address.strip() or not body.city.strip():
        raise HTTPException(400, "address and city are required")

    hunter = Hunter(
        hunter_id=user.id,
        address=body.address.strip(),
        city=body.city.strip(),
        description=body.description,
        estimated_price=body.estimated_price,
        contact_name=body.contact_name,
        contact_phone=body.contact_phone,
        contact_email=body.contact_email,
        referral_amount=body.referral_amount,
    )
    db.add(hunter)
    await db.commit()
    await db.refresh(hunter)
    return HunterRead.model_validate(hunter)


# ── Off-market publish ────────────────────────────────────────────────────────

class PublishPayload(BaseModel):
    visible: bool = True
    referral_type: str = "vente"   # vente | location


@router.post("/{hunter_id}/publish")
async def publish_off_market(
    hunter_id: uuid.UUID,
    body: PublishPayload,
    db: DbDep,
    user: AuthUserDep,
):
    """Hunter publie son lead comme off-market visible aux agents premium."""
    result = await db.execute(
        select(Hunter).where(Hunter.id == hunter_id, Hunter.hunter_id == user.id)
    )
    h = result.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "Lead non trouvé")
    h.off_market_visible = body.visible
    h.referral_type = body.referral_type
    h.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(h.id), "off_market_visible": h.off_market_visible}


# ── Off-market marketplace (agents premium) ───────────────────────────────────

@router.get("/off-market")
async def off_market_listings(db: DbDep, user: AuthUserDep):
    """Liste les leads off-market publiés — accessibles aux agents premium."""
    result = await db.execute(
        select(Hunter)
        .where(Hunter.off_market_visible == True)
        .order_by(Hunter.created_at.desc())
        .limit(100)
    )
    items = result.scalars().all()
    # Masquer les coordonnées vendeur pour les non-propriétaires du lead
    out = []
    for h in items:
        is_owner = h.hunter_id == user.id
        out.append({
            "id": str(h.id),
            "address": h.address,
            "city": h.city,
            "description": h.description,
            "estimated_price": float(h.estimated_price) if h.estimated_price else None,
            "referral_amount": float(h.referral_amount) if h.referral_amount else None,
            "referral_type": h.referral_type,
            "status": h.status,
            "created_at": str(h.created_at),
            # Contact info uniquement si propriétaire du lead
            "contact_name":  h.contact_name  if is_owner else None,
            "contact_phone": h.contact_phone if is_owner else None,
            "contact_email": h.contact_email if is_owner else None,
        })
    return {"items": out, "total": len(out)}


# ── Pay referral via Stripe ───────────────────────────────────────────────────

class PayReferralPayload(BaseModel):
    hunter_stripe_account_id: str


@router.post("/{hunter_id}/pay-referral")
async def pay_referral(
    hunter_id: uuid.UUID,
    body: PayReferralPayload,
    db: DbDep,
    user: AuthUserDep,
):
    """
    Admin/agence déclenche le paiement du referral fee au hunter via Stripe Connect.
    Montant = hunters.referral_amount (CHF 50–500).
    """
    result = await db.execute(select(Hunter).where(Hunter.id == hunter_id))
    h = result.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "Lead non trouvé")
    if h.referral_paid:
        raise HTTPException(400, "Referral déjà payé")
    if not h.referral_amount or h.referral_amount < 50:
        raise HTTPException(400, "Montant referral invalide (min CHF 50)")

    amount_chf = float(h.referral_amount)
    if not (50 <= amount_chf <= 500):
        raise HTTPException(400, "Referral fee doit être entre CHF 50 et CHF 500")

    transfer_id: str | None = None
    if settings.STRIPE_SECRET_KEY:
        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            transfer = stripe.Transfer.create(
                amount=int(amount_chf * 100),  # centimes
                currency="chf",
                destination=body.hunter_stripe_account_id,
                description=f"Referral fee hunter — lead {hunter_id}",
            )
            transfer_id = transfer.id
        except Exception as e:
            raise HTTPException(502, f"Stripe error: {e}")

    h.referral_paid = True
    h.stripe_transfer_id = transfer_id
    h.status = "closed"
    h.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"paid": True, "amount": amount_chf, "stripe_transfer_id": transfer_id}
