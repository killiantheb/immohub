"""Inspection — modèle DORMANT, Phase 2 EDL standalone (signatures électroniques).

Aucune migration Alembic ne crée la table `inspections` : ce modèle est
réservé pour la Phase 2 où l'EDL deviendra un objet de premier ordre
indépendant du cycle changement_locataire (signature électronique
opposable, EDL sans changement de locataire, EDL réguliers, etc.).

Phase 1 (PR-EDL-1, 2026-05-06) : l'EDL est embarqué dans le JSONB
`changements_locataire.edl_sortie` / `edl_entree` et les photos vont dans
le bucket privé `edl-photos`. Pas de signature, pas de table dédiée.

Tant que ce modèle reste dormant, NE PAS le réveiller pour des chantiers
Phase 1 — créer un schéma JSONB inline sur `changements_locataire` ou un
nouveau modèle scope-Phase-1 plutôt que d'étendre celui-ci.
"""

import uuid
from datetime import datetime

from app.models.base import BaseModel
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

InspectionType = Enum(
    "entry",
    "exit",
    name="inspection_type_enum",
)

InspectionCondition = Enum(
    "good",
    "fair",
    "poor",
    name="inspection_condition_enum",
)


class Inspection(BaseModel):
    __tablename__ = "inspections"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="RESTRICT"), nullable=False
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="SET NULL")
    )
    inspector_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    type: Mapped[str] = mapped_column(InspectionType, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    report_url: Mapped[str | None] = mapped_column(Text)
    photos_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    condition: Mapped[str] = mapped_column(InspectionCondition, nullable=False, default="good")
    notes: Mapped[str | None] = mapped_column(Text)

    # Signatures stored as base64 data URIs or external URLs
    signature_tenant: Mapped[str | None] = mapped_column(Text)
    signature_owner: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_inspections_bien_id", "bien_id"),
        Index("ix_inspections_contract_id", "contract_id"),
        Index("ix_inspections_inspector_id", "inspector_id"),
        Index("ix_inspections_type", "type"),
        Index("ix_inspections_date", "date"),
    )
