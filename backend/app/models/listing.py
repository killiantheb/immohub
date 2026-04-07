import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

ListingStatus = Enum(
    "draft",
    "active",
    "paused",
    "archived",
    name="listing_status_enum",
)


class Listing(BaseModel):
    __tablename__ = "listings"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # one listing per property
    )

    title: Mapped[str | None] = mapped_column(Text)
    description_ai: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(ListingStatus, nullable=False, default="draft")

    # e.g. {"airbnb": true, "booking": false, "leboncoin": true}
    portals: Mapped[dict | None] = mapped_column(JSONB)

    ai_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    leads_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_listings_property_id", "property_id"),
        Index("ix_listings_status", "status"),
        Index("ix_listings_published_at", "published_at"),
        Index("ix_listings_portals", "portals", postgresql_using="gin"),
    )
