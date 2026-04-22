"""Modèle SQLAlchemy — table biens (biens immobiliers Althy)."""

from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Enum, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

BienType = Enum(
    "appartement",
    "villa",
    "studio",
    "maison",
    "commerce",
    "bureau",
    "parking",
    "garage",
    "cave",
    "autre",
    name="bien_type_enum",
)

BienStatut = Enum(
    "loue",
    "vacant",
    "en_travaux",
    name="bien_statut_enum",
)


class Bien(BaseModel):
    __tablename__ = "biens"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    adresse: Mapped[str] = mapped_column(String(300), nullable=False)
    ville: Mapped[str] = mapped_column(String(100), nullable=False)
    cp: Mapped[str] = mapped_column(String(10), nullable=False)
    type: Mapped[str] = mapped_column(BienType, nullable=False, default="appartement")
    surface: Mapped[float | None] = mapped_column(Float)
    etage: Mapped[int | None] = mapped_column(Integer)
    loyer: Mapped[float | None] = mapped_column(Numeric(10, 2))
    charges: Mapped[float | None] = mapped_column(Numeric(10, 2))
    statut: Mapped[str] = mapped_column(BienStatut, nullable=False, default="vacant", server_default="vacant")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
