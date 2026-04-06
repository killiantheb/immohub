import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Index, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel

MissionType = Enum(
    "visit", "check_in", "check_out", "inspection", "photography", "other",
    name="mission_type_enum",
)

MissionStatus = Enum(
    "pending", "confirmed", "in_progress", "completed", "cancelled",
    name="mission_status_enum",
)


class Opener(BaseModel):
    __tablename__ = "openers"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )

    bio: Mapped[str | None] = mapped_column(Text)
    radius_km: Mapped[float | None] = mapped_column(Float)
    hourly_rate: Mapped[float | None] = mapped_column(Numeric(8, 2))

    # Geolocation — centre of their operating area
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    # Optional skill tags stored as text array: ["visit", "photography", ...]
    skills: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    is_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2))
    total_missions: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    __table_args__ = (
        Index("ix_openers_user_id", "user_id"),
        Index("ix_openers_is_available", "is_available"),
        Index("ix_openers_rating", "rating"),
    )


class Mission(BaseModel):
    __tablename__ = "missions"

    # Who requested this mission (owner / agency / tenant)
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    # Assigned opener (set at creation or after auto-matching)
    opener_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("openers.id", ondelete="RESTRICT")
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False
    )

    type: Mapped[str] = mapped_column(MissionType, nullable=False)
    status: Mapped[str] = mapped_column(MissionStatus, nullable=False, default="pending")

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_reason: Mapped[str | None] = mapped_column(String(255))

    # Property coordinates at mission creation (for distance calc without geocoding)
    property_lat: Mapped[float | None] = mapped_column(Float)
    property_lng: Mapped[float | None] = mapped_column(Float)

    price: Mapped[float | None] = mapped_column(Numeric(8, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    # Completion deliverables
    report_text: Mapped[str | None] = mapped_column(Text)
    report_url: Mapped[str | None] = mapped_column(Text)
    photos_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    # Rating (from requester → opener)
    rating_given: Mapped[float | None] = mapped_column(Numeric(3, 2))
    rating_comment: Mapped[str | None] = mapped_column(Text)

    # Payment
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255))

    __table_args__ = (
        Index("ix_missions_requester_id", "requester_id"),
        Index("ix_missions_opener_id", "opener_id"),
        Index("ix_missions_property_id", "property_id"),
        Index("ix_missions_status", "status"),
        Index("ix_missions_scheduled_at", "scheduled_at"),
        Index("ix_missions_type", "type"),
    )
