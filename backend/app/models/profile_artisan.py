"""Modèle SQLAlchemy — table profiles_artisans."""

from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Boolean, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column


class ProfileArtisan(BaseModel):
    __tablename__ = "profiles_artisans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # ── Identité ──────────────────────────────────────────────────────────────
    raison_sociale: Mapped[str | None] = mapped_column(String(300))
    uid_ide: Mapped[str | None] = mapped_column(String(20))          # CHE-xxx.xxx.xxx
    numero_tva: Mapped[str | None] = mapped_column(String(30))
    statut_juridique: Mapped[str | None] = mapped_column(String(30)) # independant/sarl/sa
    annees_experience: Mapped[int | None] = mapped_column(Integer)
    site_web: Mapped[str | None] = mapped_column(String(300))

    # ── Activité ──────────────────────────────────────────────────────────────
    specialites: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    rayon_km: Mapped[int] = mapped_column(Integer, nullable=False, default=30, server_default="30")
    note_moyenne: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    nb_chantiers: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    assurance_rc: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)

    # ── Préférences charge ────────────────────────────────────────────────────
    montant_min_mission: Mapped[float | None] = mapped_column(Numeric(8, 2))
    urgences_acceptees: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    majoration_urgence_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    chantiers_simultanees: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")

    # ── Paiement & facturation ────────────────────────────────────────────────
    iban: Mapped[str | None] = mapped_column(String(34))
    delai_paiement_jours: Mapped[int] = mapped_column(Integer, nullable=False, default=30, server_default="30")
    billing_name: Mapped[str | None] = mapped_column(String(200))
    billing_adresse: Mapped[str | None] = mapped_column(String(300))
    virement_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    facturation_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    relance_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
