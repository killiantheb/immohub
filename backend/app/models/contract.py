import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

ContractType = Enum(
    "long_term",
    "seasonal",
    "short_term",
    "sale",
    name="contract_type_enum",
)

ContractStatus = Enum(
    "draft",
    "active",
    "terminated",
    "expired",
    name="contract_status_enum",
)


class Contract(BaseModel):
    __tablename__ = "contracts"

    # reference generated at creation time e.g. CTR-202501-A1B2C3D4
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="RESTRICT"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    type: Mapped[str] = mapped_column(ContractType, nullable=False)
    status: Mapped[str] = mapped_column(ContractStatus, nullable=False, default="draft")

    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    monthly_rent: Mapped[float | None] = mapped_column(Numeric(12, 2))
    charges: Mapped[float | None] = mapped_column(Numeric(12, 2))
    deposit: Mapped[float | None] = mapped_column(Numeric(12, 2))

    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_ip: Mapped[str | None] = mapped_column(String(45))  # IPv6 max length
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Extended fields — document generation
    is_furnished: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_day: Mapped[int] = mapped_column(Integer, default=5)
    notice_period_months: Mapped[int] = mapped_column(Integer, default=3)
    notice_deadline_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    partial_period_days: Mapped[int | None] = mapped_column(Integer)
    partial_period_rent: Mapped[float | None] = mapped_column(Numeric(12, 2))
    tourist_tax_amount: Mapped[float | None] = mapped_column(Numeric(8, 2))
    cleaning_fee_hourly: Mapped[float] = mapped_column(Numeric(8, 2), default=42)
    linen_fee_included: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_fee: Mapped[float] = mapped_column(Numeric(8, 2), default=35)
    late_interest_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=6)
    mortgage_rate_ref: Mapped[float | None] = mapped_column(Numeric(5, 3))
    cpi_index_ref: Mapped[float | None] = mapped_column(Numeric(8, 2))
    deposit_type: Mapped[str] = mapped_column(String(20), default="gocaution")
    deposit_payment_deadline_days: Mapped[int] = mapped_column(Integer, default=10)
    early_termination_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=270)
    payment_communication: Mapped[str | None] = mapped_column(String(200))
    subletting_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    animals_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    smoking_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_for_sale: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at_city: Mapped[str | None] = mapped_column(String(100))
    canton: Mapped[str] = mapped_column(String(2), default="VS")
    bank_name: Mapped[str | None] = mapped_column(String(100))
    bank_iban: Mapped[str | None] = mapped_column(String(34))
    bank_bic: Mapped[str | None] = mapped_column(String(11))
    occupants_count: Mapped[int | None] = mapped_column(Integer)
    tenant_nationality: Mapped[str | None] = mapped_column(String(50))

    __table_args__ = (
        Index("ix_contracts_reference", "reference"),
        Index("ix_contracts_owner_id", "owner_id"),
        Index("ix_contracts_bien_id", "bien_id"),
        Index("ix_contracts_tenant_id", "tenant_id"),
        Index("ix_contracts_agency_id", "agency_id"),
        Index("ix_contracts_status", "status"),
        Index("ix_contracts_type", "type"),
        Index("ix_contracts_start_date", "start_date"),
    )
