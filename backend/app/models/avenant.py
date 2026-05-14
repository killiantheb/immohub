"""Modèle SQLAlchemy — table avenants (Sprint 10 Lot 2).

Source de vérité schéma DB : migration 0051 §E.

Extension par-table (vs polymorphic SignableDocument) — cf AUDIT_SPRINT10.md §3.5.

Workflow états (cf CHECK constraint migration 0051) :
  draft → pending_signatures → signed → terminated

Skribble webhook (Lot 2 §C) muta `skribble_status` selon les événements reçus :
  - signature_request.created    → skribble_status='created'
  - signature_request.signed     → skribble_status='partial_signed' (un signataire OK)
  - signature_request.completed  → skribble_status='completed' + status='signed' +
                                    signed_at_locataire + signed_at_agence posés
  - signature_request.declined   → skribble_status='declined'
  - signature_request.expired    → skribble_status='expired'
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from app.models.base import BaseModel
from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.contract import Contract


class Avenant(BaseModel):
    __tablename__ = "avenants"

    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    avenant_type: Mapped[str] = mapped_column(String(40), nullable=False)
    objet: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text)
    effective_date: Mapped[date | None] = mapped_column(Date)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")

    signed_at_locataire: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_at_agence: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    skribble_session_id: Mapped[str | None] = mapped_column(String(100))
    skribble_status: Mapped[str | None] = mapped_column(String(50))
    skribble_signed_pdf_url: Mapped[str | None] = mapped_column(Text)
    draft_pdf_url: Mapped[str | None] = mapped_column(Text)

    contract: Mapped[Contract] = relationship(
        "Contract",
        foreign_keys=[contract_id],
        lazy="selectin",
    )

    @hybrid_property
    def fully_signed(self) -> bool:
        """True quand locataire ET agence-mandataire ont signé l'avenant."""
        return bool(self.signed_at_locataire) and bool(self.signed_at_agence)
