"""AgencySettings — paramètres configurables par agence/propriétaire."""
from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import Boolean, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class AgencySettings(BaseModel):
    __tablename__ = "agency_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)

    # ── Commissions ───────────────────────────────────────────────────────────
    commission_location_pct: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=8.33, server_default="8.33"
    )  # % du premier loyer pour trouver locataire (standard: 1 mois = ~8.33% annuel)
    commission_management_pct: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=5.0, server_default="5.0"
    )  # % mensuel pour gérance
    commission_sale_pct: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=3.0, server_default="3.0"
    )  # % pour vente
    deposit_months: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
    )  # mois de dépôt (max 3 selon CO)

    # ── Défauts contrat ───────────────────────────────────────────────────────
    default_contract_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="long_term", server_default="'long_term'"
    )
    default_notice_months: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
    )
    default_included_charges: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # ── Identité agence ───────────────────────────────────────────────────────
    agency_name: Mapped[str | None] = mapped_column(String(200))
    agency_address: Mapped[str | None] = mapped_column(String(300))
    agency_phone: Mapped[str | None] = mapped_column(String(30))
    agency_email: Mapped[str | None] = mapped_column(String(200))
    agency_rc_number: Mapped[str | None] = mapped_column(String(50))
    agency_da_number: Mapped[str | None] = mapped_column(String(50))
    agency_website: Mapped[str | None] = mapped_column(String(300))
    agency_logo_url: Mapped[str | None] = mapped_column(Text)
    agency_description: Mapped[str | None] = mapped_column(Text)

    # ── Notifications ─────────────────────────────────────────────────────────
    notify_late_rent_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
    )
    notify_expiry_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60, server_default="60"
    )
    notify_via_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_via_whatsapp: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    whatsapp_number: Mapped[str | None] = mapped_column(String(30))

    # ── Préférences IA ────────────────────────────────────────────────────────
    ai_auto_actions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )  # Si true : IA agit sans validation humaine

    __table_args__ = (
        Index("ix_agency_settings_user", "user_id"),
    )
