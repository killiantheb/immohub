import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String
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
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False
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

    __table_args__ = (
        Index("ix_contracts_reference", "reference"),
        Index("ix_contracts_owner_id", "owner_id"),
        Index("ix_contracts_property_id", "property_id"),
        Index("ix_contracts_tenant_id", "tenant_id"),
        Index("ix_contracts_agency_id", "agency_id"),
        Index("ix_contracts_status", "status"),
        Index("ix_contracts_type", "type"),
        Index("ix_contracts_start_date", "start_date"),
    )
