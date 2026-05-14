"""Modèle SQLAlchemy — table avenants (Sprint 10).

Source de vérité schéma DB : migration 0051 §E.

Extension par-table (vs polymorphic SignableDocument) — cf AUDIT_SPRINT10.md §3.5.

Stub Lot 1.5 scaffolding — colonnes alignées sur la migration 0051. Les
relationships avec Contract + hybrid `fully_signed` + workflow états sont
livrées par Lot 2.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from app.models.base import BaseModel
from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column


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
