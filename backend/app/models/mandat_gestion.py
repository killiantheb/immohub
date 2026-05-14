"""Modèle SQLAlchemy — table mandats_gestion (Sprint 10).

Source de vérité schéma DB : migration 0051 §D.

§2.4.16 doctrine 2026-05-14 — commission_pct_* = donnée contractuelle pure
(apparaît dans le PDF du mandat). AUCUN tracking transactionnel Althy :
pas de Stripe Connect, pas de prélèvement, pas de webhook commission.
Sunimmo facture directement le propriétaire sur sa compta interne.

Stub Lot 1.5 scaffolding — colonnes alignées sur la migration 0051. Les
relationships, hybrid properties et méthodes business sont livrées par
Lot 2 (services Skribble + signature_orchestrator).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from app.models.base import BaseModel
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class MandatGestion(BaseModel):
    __tablename__ = "mandats_gestion"

    mandant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    agence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    bien_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="SET NULL"),
    )

    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")

    signed_at_mandant: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_ip_mandant: Mapped[str | None] = mapped_column(String(50))
    signed_at_agence: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_ip_agence: Mapped[str | None] = mapped_column(String(50))

    skribble_session_id: Mapped[str | None] = mapped_column(String(100))
    skribble_status: Mapped[str | None] = mapped_column(String(50))
    skribble_signed_pdf_url: Mapped[str | None] = mapped_column(Text)

    # §2.4.16 — DATA contractuelle pure. Pas de prélèvement Althy.
    commission_pct_annee: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("10.00")
    )
    commission_pct_saison: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("15.00")
    )
    commission_pct_semaine: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("20.00")
    )

    notes: Mapped[str | None] = mapped_column(Text)
    for_juridique: Mapped[str] = mapped_column(String(100), nullable=False, default="Sierre")

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    notice_period_months: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    notice_deadline_month_day: Mapped[str | None] = mapped_column(String(10))

    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
