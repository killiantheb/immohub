"""Modèle SQLAlchemy — table biens (biens immobiliers Althy)."""

from __future__ import annotations

import uuid
from datetime import date

from app.models.base import BaseModel
from sqlalchemy import Boolean, Date, Enum, Float, ForeignKey, Integer, Numeric, String, Text
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

TypeLocation = Enum(
    "annuelle",
    "saisonniere",
    name="type_location_enum",
)


class Bien(BaseModel):
    __tablename__ = "biens"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # ── Nommage métier ──────────────────────────────────────
    nom_immeuble: Mapped[str | None] = mapped_column(String(100))
    unite: Mapped[str | None] = mapped_column(String(20))
    nom_personnalise: Mapped[str | None] = mapped_column(String(100))

    # ── Localisation ────────────────────────────────────────
    adresse: Mapped[str] = mapped_column(String(300), nullable=False)
    ville: Mapped[str] = mapped_column(String(100), nullable=False)
    cp: Mapped[str] = mapped_column(String(10), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)

    # ── Type de bien & location ─────────────────────────────
    type: Mapped[str] = mapped_column(BienType, nullable=False, default="appartement")
    type_location: Mapped[str] = mapped_column(
        TypeLocation, nullable=False, default="annuelle", server_default="annuelle"
    )
    meuble: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    statut: Mapped[str] = mapped_column(
        BienStatut, nullable=False, default="vacant", server_default="vacant"
    )

    # ── Caractéristiques ────────────────────────────────────
    surface: Mapped[float | None] = mapped_column(Float)
    nb_pieces: Mapped[float | None] = mapped_column(Numeric(3, 1))
    nb_chambres: Mapped[int | None] = mapped_column(Integer)
    nb_salles_bain: Mapped[int | None] = mapped_column(Integer)
    etage: Mapped[int | None] = mapped_column(Integer)
    annee_construction: Mapped[int | None] = mapped_column(Integer)
    annee_renovation: Mapped[int | None] = mapped_column(Integer)
    classe_energetique: Mapped[str | None] = mapped_column(String(2))

    # ── Équipements ────────────────────────────────────────
    balcon: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    terrasse: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    jardin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    parking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    garage_inclus: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    cave: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    ascenseur: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    cheminee: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lave_vaisselle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    lave_linge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # ── Finances annuelle ──────────────────────────────────
    loyer: Mapped[float | None] = mapped_column(Numeric(10, 2))
    charges: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # ── Finances saisonnière ───────────────────────────────
    prix_nuit_basse_saison: Mapped[float | None] = mapped_column(Numeric(10, 2))
    prix_nuit_mi_saison: Mapped[float | None] = mapped_column(Numeric(10, 2))
    prix_nuit_haute_saison: Mapped[float | None] = mapped_column(Numeric(10, 2))
    taxe_sejour_par_nuit: Mapped[float | None] = mapped_column(Numeric(10, 2))
    frais_menage_fixe: Mapped[float | None] = mapped_column(Numeric(10, 2))
    nuitees_min: Mapped[int | None] = mapped_column(Integer)
    nuitees_max: Mapped[int | None] = mapped_column(Integer)

    # ── Texte libre & dispo ────────────────────────────────
    description: Mapped[str | None] = mapped_column(Text)
    disponible_des: Mapped[date | None] = mapped_column(Date)
