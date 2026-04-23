import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

TransactionType = Enum(
    "rent",
    "commission",
    "deposit",
    "service",
    "quote",
    name="transaction_type_enum",
)

TransactionStatus = Enum(
    "pending",
    "paid",
    "late",
    "cancelled",
    name="transaction_status_enum",
)


class Transaction(BaseModel):
    __tablename__ = "transactions"

    # reference generated at creation e.g. TXN-20250101-A1B2C3
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="SET NULL")
    )
    bien_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="SET NULL")
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    type: Mapped[str] = mapped_column(TransactionType, nullable=False)
    status: Mapped[str] = mapped_column(TransactionStatus, nullable=False, default="pending")

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    commission_front_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    commission_back_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    commission_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))

    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    stripe_payment_id: Mapped[str | None] = mapped_column(String(255))

    __table_args__ = (
        Index("ix_transactions_reference", "reference"),
        Index("ix_transactions_contract_id", "contract_id"),
        Index("ix_transactions_bien_id", "bien_id"),
        Index("ix_transactions_owner_id", "owner_id"),
        Index("ix_transactions_tenant_id", "tenant_id"),
        Index("ix_transactions_status", "status"),
        Index("ix_transactions_type", "type"),
        Index("ix_transactions_due_date", "due_date"),
    )
