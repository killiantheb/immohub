"""Modèle SQLAlchemy — table loyer_transactions (Sprint 7 Lot A).

Cf migration `0047_loyer_transactions.py` pour le schéma SQL exact et
l'historique du fix §B.13 (table fantôme régularisée).

Note architecture : ce modèle ne hérite **pas** de `BaseModel` car la
table prod legacy n'a pas la colonne `is_active`. On utilise `Base`
directement pour éviter un mismatch ORM ↔ DB qui ferait planter tout
SELECT. La normalisation vers `BaseModel` pourra se faire Phase 2 si
nécessaire (ADD COLUMN + backfill).

Pas de relations déclarées (les 4 fichiers consommateurs utilisent
encore raw SQL `text()`) — les ajouter progressivement Phase 1.1 quand
on refacto loyers.py vers ORM.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from app.models.base import Base
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    func,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class LoyerTransaction(Base):
    __tablename__ = "loyer_transactions"

    # ── PK + relations ───────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Référence libre vers locataires.id (pas de FK — choix historique
    # cohérent avec changements_locataire.nouveau_locataire_id).
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # ── Montants ─────────────────────────────────────────────────────────────
    montant_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    commission_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    commission_montant: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0, server_default="0"
    )
    montant_reverse: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # ── QR & statut ──────────────────────────────────────────────────────────
    qr_reference: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="en_attente",
        server_default="en_attente",
    )

    # ── Calendrier ───────────────────────────────────────────────────────────
    mois_concerne: Mapped[date] = mapped_column(Date, nullable=False)
    date_reception: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    date_reversement: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reference_virement_sortant: Mapped[str | None] = mapped_column(Text)

    # ── Audit timestamps (pas via BaseModel — voir docstring module) ─────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "statut IN ('en_attente', 'recu', 'reverse', 'en_retard', 'conteste')",
            name="ck_loyer_transactions_statut",
        ),
        Index("ix_loyer_transactions_bien_id", "bien_id"),
        Index("ix_loyer_transactions_owner_id", "owner_id"),
        Index("ix_loyer_transactions_tenant_id", "tenant_id"),
        Index("ix_loyer_transactions_statut", "statut"),
        Index("ix_loyer_transactions_mois", "mois_concerne"),
    )
