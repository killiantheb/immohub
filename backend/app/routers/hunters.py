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
