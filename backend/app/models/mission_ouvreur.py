"""Modèles SQLAlchemy — tables missions_ouvreurs + profiles_ouvreurs."""

from __future__ import annotations

import uuid
from datetime import time

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

MissionType = Enum(
    "visite",
    "edl_entree",
    "edl_sortie",
    "remise_cles",
    "expertise",
    name="mission_ouvreur_type_enum",
)

MissionStatut = Enum(
    "proposee",
    "acceptee",
    "effectuee",
    "annulee",
    name="mission_ouvreur_statut_enum",
)


class MissionOuvreur(BaseModel):
    __tablename__ = "missions_ouvreurs"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    ouvreur_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[str] = mapped_column(MissionType, nullable=False)
    date_mission: Mapped[str | None] = mapped_column(String(20))  # ISO date
    creneau_debut: Mapped[time | None] = mapped_column(Time)
    creneau_fin: Mapped[time | None] = mapped_column(Time)
    nb_candidats: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    instructions: Mapped[str | None] = mapped_column(Text)
    remuneration: Mapped[float | None] = mapped_column(Numeric(8, 2))
    statut: Mapped[str] = mapped_column(
        MissionStatut, nullable=False, default="proposee", server_default="proposee"
    )
    rayon_km: Mapped[int] = mapped_column(Integer, nullable=False, default=20, server_default="20")


class ProfileOuvreur(BaseModel):
    __tablename__ = "profiles_ouvreurs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    rayon_km: Mapped[int] = mapped_column(Integer, nullable=False, default=20, server_default="20")
    jours_dispo: Mapped[list[int] | None] = mapped_column(ARRAY(Integer))  # 0=lun … 6=dim
    heure_debut: Mapped[time | None] = mapped_column(Time)
    heure_fin: Mapped[time | None] = mapped_column(Time)
    types_missions: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    note_moyenne: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    nb_missions: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    vehicule: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
