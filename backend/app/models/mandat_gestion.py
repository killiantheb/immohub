"""Modèle SQLAlchemy — table mandats_gestion (Sprint 10 Lot 2).

Source de vérité schéma DB : migration 0051 §D.

§2.4.16 doctrine 2026-05-14 — `commission_pct_*` = **donnée contractuelle pure**
(apparaît dans le PDF du mandat). **AUCUN tracking transactionnel Althy** :
pas de Stripe Connect, pas de prélèvement, pas de webhook commission, pas de
calcul automatique. Sunimmo facture directement le propriétaire sur sa compta
interne.

Workflow états :
  draft → pending_signatures → active (les 2 ont signé via Skribble) →
  terminated (résiliation du mandat) | expired

RBAC strict (cf router mandats.py) :
  - Création : `agence` ou `super_admin` uniquement (proprio ne peut pas
    créer son propre mandat).
  - mandant_id doit pointer un User role=`proprio_solo` (validation côté
    serveur).
  - CHECK constraint DB : mandant_id <> agence_id.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.user import User


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

    mandant: Mapped[User] = relationship(
        "User",
        foreign_keys=[mandant_id],
        lazy="selectin",
    )
    agence: Mapped[User] = relationship(
        "User",
        foreign_keys=[agence_id],
        lazy="selectin",
    )

    @hybrid_property
    def fully_signed(self) -> bool:
        """True quand mandant (propriétaire) ET agence ont signé via Skribble."""
        return bool(self.signed_at_mandant) and bool(self.signed_at_agence)
