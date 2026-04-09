"""Modèle SQLAlchemy — table paiements."""

from __future__ import annotations

import uuid
from datetime import date

from app.models.base import BaseModel
from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

PaiementStatut = Enum("recu", "en_attente", "retard", name="paiement_statut_enum")


class Paiement(BaseModel):
    __tablename__ = "paiements"

    locataire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locataires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mois: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    montant: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # net_montant = montant - frais Althy 4% — affiché comme "loyer net reçu"
    net_montant: Mapped[float | None] = mapped_column(Numeric(10, 2))
    date_echeance: Mapped[date] = mapped_column(Date, nullable=False)
    date_paiement: Mapped[date | None] = mapped_column(Date)
    statut: Mapped[str] = mapped_column(
        PaiementStatut, nullable=False, default="en_attente", server_default="en_attente"
    )
    jours_retard: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Stripe
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(100), index=True)
    stripe_charge_id: Mapped[str | None] = mapped_column(String(100))
