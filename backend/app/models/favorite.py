"""Favorite model — biens favoris d'un utilisateur (locataire ou autre)."""
from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class Favorite(BaseModel):
    __tablename__ = "favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    bien_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "bien_id", name="uq_favorites_user_bien"),
        Index("ix_favorites_user", "user_id"),
    )
