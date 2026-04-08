"""Modèle SQLAlchemy — table notifications."""

from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    titre: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    lu: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lien: Mapped[str | None] = mapped_column(String(500))
