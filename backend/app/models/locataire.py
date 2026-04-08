"""Modèles SQLAlchemy — tables locataires + dossiers_locataires."""

from __future__ import annotations

import uuid
from datetime import date

from app.models.base import BaseModel
from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

LocataireStatut = Enum("actif", "sorti", name="locataire_statut_enum")
TypeCaution = Enum("cash", "compte_bloque", "organisme", name="type_caution_enum")
TypeContrat = Enum("cdi", "cdd", "independant", "retraite", "autre", name="type_contrat_enum")


class Locataire(BaseModel):
    __tablename__ = "locataires"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Infos bail
    date_entree: Mapped[date | None] = mapped_column(Date)
    date_sortie: Mapped[date | None] = mapped_column(Date)
    loyer: Mapped[float | None] = mapped_column(Numeric(10, 2))
    charges: Mapped[float | None] = mapped_column(Numeric(10, 2))
    depot_garantie: Mapped[float | None] = mapped_column(Numeric(10, 2))
    # Caution
    type_caution: Mapped[str | None] = mapped_column(TypeCaution)
    banque_caution: Mapped[str | None] = mapped_column(String(200))
    iban_caution: Mapped[str | None] = mapped_column(String(34))
    # Statut
    statut: Mapped[str] = mapped_column(
        LocataireStatut, nullable=False, default="actif", server_default="actif"
    )
    motif_depart: Mapped[str | None] = mapped_column(String(300))
    note_interne: Mapped[str | None] = mapped_column(Text)


class DossierLocataire(BaseModel):
    __tablename__ = "dossiers_locataires"

    locataire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locataires.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # Emploi
    employeur: Mapped[str | None] = mapped_column(String(200))
    poste: Mapped[str | None] = mapped_column(String(200))
    type_contrat: Mapped[str | None] = mapped_column(TypeContrat)
    salaire_net: Mapped[float | None] = mapped_column(Numeric(10, 2))
    anciennete: Mapped[int | None] = mapped_column(Integer)  # mois
    # Assurance RC
    assureur_rc: Mapped[str | None] = mapped_column(String(200))
    numero_police: Mapped[str | None] = mapped_column(String(100))
    validite_assurance: Mapped[date | None] = mapped_column(Date)
    # Poursuites
    resultat_poursuites: Mapped[str | None] = mapped_column(String(100))
    date_poursuites: Mapped[date | None] = mapped_column(Date)
    office_poursuites: Mapped[str | None] = mapped_column(String(200))
