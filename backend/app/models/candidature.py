import uuid
from datetime import datetime
from typing import Any

from decimal import Decimal

from app.models.base import BaseModel
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column


class Candidature(BaseModel):
    __tablename__ = "candidatures"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    statut: Mapped[str] = mapped_column(
        String(20), nullable=False, default="en_attente", server_default="en_attente"
    )
    # Liste de docs uploadés : [{type: "cni"|"fiche_salaire"|"reference"|"autre", url, nom}]
    documents: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    message: Mapped[str | None] = mapped_column(Text)

    # Scoring IA (0-100, null jusqu'au calcul)
    score_ia: Mapped[int | None] = mapped_column(Integer)
    score_details: Mapped[Any | None] = mapped_column(JSONB)  # {recommendation, risk_flags, summary}

    # ── Facturation propriétaire (CHF 45 à l'acceptation — pivot 2026-04-20) ──
    owner_fee_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("45.00"), server_default="45.00"
    )
    owner_fee_paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_fee_stripe_intent_id: Mapped[str | None] = mapped_column(Text)
    owner_fee_failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_fee_failure_reason: Mapped[str | None] = mapped_column(Text)

    # ── Legacy (tenant CHF 90) — conservées pour audit, plus jamais écrites ───
    frais_payes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    stripe_pi_id: Mapped[str | None] = mapped_column(Text)

    # Proposition de visite via ouvreur
    visite_proposee_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ouvreur_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_candidature_user_listing"),
        Index("ix_candidatures_listing_id", "listing_id"),
        Index("ix_candidatures_user_id", "user_id"),
        Index("ix_candidatures_statut", "statut"),
        Index("ix_candidatures_score", "score_ia"),
    )
