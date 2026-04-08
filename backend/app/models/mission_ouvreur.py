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
    # ── Identité ──────────────────────────────────────────────────────────────
    statut_ouvreur: Mapped[str | None] = mapped_column(String(30))   # independant/employe_agence
    numero_avs: Mapped[str | None] = mapped_column(String(20))
    permis_conduire: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    vehicule: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # ── Zone & dispo ──────────────────────────────────────────────────────────
    rayon_km: Mapped[int] = mapped_column(Integer, nullable=False, default=20, server_default="20")
    jours_dispo: Mapped[list[int] | None] = mapped_column(ARRAY(Integer))  # 0=lun … 6=dim
    heure_debut: Mapped[time | None] = mapped_column(Time)
    heure_fin: Mapped[time | None] = mapped_column(Time)
    types_missions: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)

    # ── Stats ─────────────────────────────────────────────────────────────────
    note_moyenne: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    nb_missions: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # ── Préférences charge ────────────────────────────────────────────────────
    montant_min_mission: Mapped[float | None] = mapped_column(Numeric(8, 2))
    urgences_acceptees: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    majoration_urgence_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    missions_par_jour: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default="5")

    # ── Paiement ─────────────────────────────────────────────────────────────
    iban: Mapped[str | None] = mapped_column(String(34))
    bic: Mapped[str | None] = mapped_column(String(11))
    bank_account_holder: Mapped[str | None] = mapped_column(String(200))
    billing_name: Mapped[str | None] = mapped_column(String(200))
    billing_adresse: Mapped[str | None] = mapped_column(String(300))
    virement_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
