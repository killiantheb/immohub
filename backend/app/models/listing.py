import uuid
from datetime import datetime
from typing import Any

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric, String, Text
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

    # ── Marketplace fields ────────────────────────────────────────────────────
    transaction_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="location", server_default="location"
    )
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    adresse_affichee: Mapped[str | None] = mapped_column(Text)
    photos: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    tags_ia: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    is_premium: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    expire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    swipes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    contacts_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # ── Source tracing (migration 0027) ───────────────────────────────────────
    source_site: Mapped[str | None] = mapped_column(String(100))
    source_id:   Mapped[str | None] = mapped_column(String(100))
    source_url:  Mapped[str | None] = mapped_column(String(500))

    __table_args__ = (
        Index("ix_listings_property_id", "property_id"),
        Index("ix_listings_status", "status"),
        Index("ix_listings_published_at", "published_at"),
        Index("ix_listings_portals", "portals", postgresql_using="gin"),
        Index("ix_listings_transaction_type", "transaction_type"),
        Index("ix_listings_geopoint", "lat", "lng"),
        Index("ix_listings_tags_ia", "tags_ia", postgresql_using="gin"),
    )
