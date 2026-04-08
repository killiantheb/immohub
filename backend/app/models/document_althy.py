"""Modèle SQLAlchemy — table documents (GED Althy)."""

from __future__ import annotations

import uuid
from datetime import date

from app.models.base import BaseModel
from sqlalchemy import Boolean, Date, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

DocumentType = Enum(
    "bail",
    "edl_entree",
    "edl_sortie",
    "quittance",
    "attestation_assurance",
    "contrat_travail",
    "fiche_salaire",
    "extrait_poursuites",
    "attestation_caution",
    "autre",
    name="document_althy_type_enum",
)


class DocumentAlthy(BaseModel):
    __tablename__ = "documents"

    bien_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="CASCADE"), index=True
    )
    locataire_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locataires.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[str] = mapped_column(DocumentType, nullable=False)
    url_storage: Mapped[str] = mapped_column(Text, nullable=False)
    date_document: Mapped[date | None] = mapped_column(Date)
    genere_par_ia: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
