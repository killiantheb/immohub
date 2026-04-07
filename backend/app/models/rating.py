"""Rating model — notation universelle pour locataires, entreprises, ouvreurs, assurances."""
from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class Rating(BaseModel):
    __tablename__ = "ratings"

    # Qui a noté
    rater_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    rater_role: Mapped[str] = mapped_column(String(30), nullable=False)

    # Ce qui est noté
    entity_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # "user" | "company" | "property" | "mission"
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Note
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Contexte optionnel
    contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    rfq_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mission_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_ratings_entity", "entity_type", "entity_id"),
        Index("ix_ratings_rater", "rater_id"),
    )
