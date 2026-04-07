"""
RFQ — Request For Quote (Appel d'offre)

Lifecycle:
  draft → published → quotes_received → accepted → in_progress → completed → rated
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

RFQCategory = Enum(
    "plumbing",
    "electricity",
    "cleaning",
    "painting",
    "locksmith",
    "roofing",
    "gardening",
    "masonry",
    "hvac",
    "renovation",
    "other",
    name="rfq_category_enum",
)

RFQStatus = Enum(
    "draft",
    "published",
    "quotes_received",
    "accepted",
    "in_progress",
    "completed",
    "rated",
    "cancelled",
    name="rfq_status_enum",
)

RFQUrgency = Enum("low", "medium", "high", "emergency", name="rfq_urgency_enum")

RFQQuoteStatus = Enum(
    "pending",
    "accepted",
    "rejected",
    "completed",
    name="rfq_quote_status_enum",
)


class RFQ(BaseModel):
    __tablename__ = "rfqs"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL")
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(RFQCategory, nullable=False)
    ai_detected: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")

    status: Mapped[str] = mapped_column(
        RFQStatus, nullable=False, default="draft", server_default="'draft'"
    )
    urgency: Mapped[str] = mapped_column(
        RFQUrgency, nullable=False, default="medium", server_default="'medium'"
    )

    city: Mapped[str | None] = mapped_column(String(100))
    zip_code: Mapped[str | None] = mapped_column(String(10))

    budget_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    budget_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    scheduled_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Filled once a quote is accepted
    selected_quote_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    commission_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # Timestamps
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Rating (after completion)
    rating_given: Mapped[float | None] = mapped_column(Numeric(3, 2))
    rating_comment: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_rfqs_owner_id", "owner_id"),
        Index("ix_rfqs_status", "status"),
        Index("ix_rfqs_category", "category"),
    )


class RFQQuote(BaseModel):
    __tablename__ = "rfq_quotes"

    rfq_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    delay_days: Mapped[int | None] = mapped_column(Integer)
    warranty_months: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(
        RFQQuoteStatus, nullable=False, default="pending", server_default="'pending'"
    )

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_rfq_quotes_rfq_id", "rfq_id"),
        Index("ix_rfq_quotes_company_id", "company_id"),
        Index("ix_rfq_quotes_status", "status"),
    )
