import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class Interest(BaseModel):
    __tablename__ = "interests"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Connecté : user_id ; anonyme : session_id
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    session_id: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="pending")
    message: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_interests_user_listing"),
        UniqueConstraint("session_id", "listing_id", name="uq_interests_session_listing"),
        CheckConstraint("user_id IS NOT NULL OR session_id IS NOT NULL", name="interests_requires_identity"),
        Index("ix_interests_listing_id", "listing_id"),
        Index("ix_interests_user_id", "user_id"),
        Index("ix_interests_session_id", "session_id"),
        Index("ix_interests_status", "status"),
    )
