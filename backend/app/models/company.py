import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

CompanyType = Enum(
    "plumber",
    "electrician",
    "cleaner",
    "painter",
    "locksmith",
    "other",
    name="company_type_enum",
)

QuoteStatus = Enum(
    "pending",
    "accepted",
    "rejected",
    "completed",
    name="quote_status_enum",
)


class Company(BaseModel):
    __tablename__ = "companies"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(CompanyType, nullable=False)
    siret: Mapped[str | None] = mapped_column(String(14), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2))
    total_jobs: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    commission_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    city: Mapped[str | None] = mapped_column(String(100))
    zip_code: Mapped[str | None] = mapped_column(String(10))

    __table_args__ = (
        Index("ix_companies_user_id", "user_id"),
        Index("ix_companies_type", "type"),
        Index("ix_companies_siret", "siret"),
    )


class Quote(BaseModel):
    __tablename__ = "quotes"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(QuoteStatus, nullable=False, default="pending")
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_quotes_company_id", "company_id"),
        Index("ix_quotes_property_id", "property_id"),
        Index("ix_quotes_owner_id", "owner_id"),
        Index("ix_quotes_status", "status"),
    )
