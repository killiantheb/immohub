"""Modèle SQLAlchemy — table resiliations (Sprint 10).

Source de vérité schéma DB : migration 0051 §F.

ON DELETE RESTRICT sur contract_id : conservation légale CO 962 (10 ans).

Stub Lot 1.5 scaffolding — colonnes alignées sur la migration 0051. Logique
métier (calcul respect_preavis depuis Contract.notice_period_months, transition
statut envoyee → appliquee, hook EDL sortie) livrée par Lot 2.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from app.models.base import BaseModel
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class Resiliation(BaseModel):
    __tablename__ = "resiliations"

    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    initiateur: Mapped[str] = mapped_column(String(30), nullable=False)
    motif: Mapped[str | None] = mapped_column(String(200))

    date_resiliation: Mapped[date] = mapped_column(Date, nullable=False)
    date_envoi: Mapped[date] = mapped_column(Date, nullable=False)
    respect_preavis: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preavis_months: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    skribble_session_id: Mapped[str | None] = mapped_column(String(100))
    skribble_status: Mapped[str | None] = mapped_column(String(50))
    skribble_signed_pdf_url: Mapped[str | None] = mapped_column(Text)
    draft_pdf_url: Mapped[str | None] = mapped_column(Text)
    notification_envoyee_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
