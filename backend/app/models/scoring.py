"""Modèle SQLAlchemy — table scoring_locataires."""

from __future__ import annotations

import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class ScoringLocataire(BaseModel):
    __tablename__ = "scoring_locataires"

    locataire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locataires.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    ponctualite: Mapped[float] = mapped_column(Float, nullable=False, default=5.0, server_default="5")
    solvabilite: Mapped[float] = mapped_column(Float, nullable=False, default=5.0, server_default="5")
    communication: Mapped[float] = mapped_column(Float, nullable=False, default=5.0, server_default="5")
    etat_logement: Mapped[float] = mapped_column(Float, nullable=False, default=5.0, server_default="5")
    score_global: Mapped[float] = mapped_column(Float, nullable=False, default=5.0, server_default="5")
    nb_retards: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
