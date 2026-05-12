"""Modèles SQLAlchemy — tables locataires + dossiers_locataires."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from app.models.base import BaseModel
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    # Relations Phase 1.0 — documents dossier (1:N, cascade DELETE).
    # Type forward-ref pour éviter l'import circulaire avec models/document_dossier.py.
    documents_dossier: Mapped[list["DocumentDossier"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "DocumentDossier",
        back_populates="locataire",
        cascade="all, delete-orphan",
    )


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

    # ── Étapes de complétion Phase 1.0 (migration 0041) ─────────────────────
    # Étape 1 — locataire saisit ses renseignements (15% progression).
    renseignements_complets: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    renseignements_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # Étape 10 — bailleur confirme versement loyer + caution (5% progression).
    loyer_caution_verses: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    loyer_caution_verses_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    loyer_caution_verses_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
