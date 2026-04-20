"""Partners — modèles SQLAlchemy (migration 0035).

Structure 4 tables :
  partners            : partenaire commercial (verticale, région, clé API chiffrée)
  partner_deals       : contrat(s) actif(s) avec ce partenaire
  partner_leads       : leads envoyés (RGPD: consent_id obligatoire)
  partner_commissions : rollup mensuel facturé au partenaire

Toutes les opérations critiques (création, envoi lead) passent par
app.services.partner_service.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from app.models.base import BaseModel
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


VERTICALS = (
    "insurance",
    "caution",
    "mortgage",
    "moving",
    "energy",
    "telecom",
    "other",
)

DEAL_TYPES = (
    "affiliation",
    "exclusive_with_minimum",
    "strategic",
    "revenue_share",
)

LEAD_STATUSES = ("sent", "qualified", "signed", "rejected", "expired")


class Partner(BaseModel):
    """Partenaire commercial Althy."""

    __tablename__ = "partners"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    vertical: Mapped[str] = mapped_column(String(16), nullable=False)
    country: Mapped[str] = mapped_column(String(2), default="CH", server_default="CH")
    region: Mapped[str | None] = mapped_column(String(32))
    website: Mapped[str | None] = mapped_column(Text)
    api_base_url: Mapped[str | None] = mapped_column(Text)
    api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(16), default="active", server_default="active"
    )
    contact_person: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(Text)
    contract_start_date: Mapped[date | None] = mapped_column(Date)
    contract_end_date: Mapped[date | None] = mapped_column(Date)
    exclusivity_region: Mapped[str | None] = mapped_column(String(64))

    deals: Mapped[list["PartnerDeal"]] = relationship(
        "PartnerDeal", back_populates="partner", cascade="all, delete-orphan"
    )
    leads: Mapped[list["PartnerLead"]] = relationship(
        "PartnerLead", back_populates="partner"
    )
    commissions: Mapped[list["PartnerCommission"]] = relationship(
        "PartnerCommission", back_populates="partner"
    )

    __table_args__ = (
        Index("ix_partners_vertical", "vertical"),
        Index("ix_partners_status", "status"),
        Index("ix_partners_region", "region"),
    )


class PartnerDeal(BaseModel):
    """Contrat commercial avec un partenaire (peut en avoir plusieurs successifs)."""

    __tablename__ = "partner_deals"

    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
    )
    deal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    min_monthly_guarantee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=0, server_default="0"
    )
    per_contract_commission: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    per_lead_commission: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    revenue_share_percentage: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(16), default="active", server_default="active"
    )
    notes: Mapped[str | None] = mapped_column(Text)

    partner: Mapped[Partner] = relationship("Partner", back_populates="deals")

    __table_args__ = (
        Index("ix_partner_deals_partner", "partner_id"),
        Index("ix_partner_deals_status", "status"),
        Index("ix_partner_deals_period", "start_date", "end_date"),
    )


class PartnerLead(BaseModel):
    """Lead envoyé à un partenaire. RGPD : consent_id obligatoire à la création."""

    __tablename__ = "partner_leads"

    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
    )
    vertical: Mapped[str] = mapped_column(String(16), nullable=False)
    lead_data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    status: Mapped[str] = mapped_column(
        String(16), default="sent", server_default="sent"
    )
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    qualified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    commission_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    commission_paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_reference: Mapped[str | None] = mapped_column(Text)
    consent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("consents.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    partner: Mapped[Partner] = relationship("Partner", back_populates="leads")

    __table_args__ = (
        Index("ix_partner_leads_partner", "partner_id"),
        Index("ix_partner_leads_user", "user_id"),
        Index("ix_partner_leads_vertical", "vertical"),
        Index("ix_partner_leads_status", "status"),
        Index("ix_partner_leads_sent_at", "sent_at"),
    )


class PartnerCommission(BaseModel):
    """Rollup mensuel facturé au partenaire — max(min_guarantee, variable)."""

    __tablename__ = "partner_commissions"

    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    total_leads: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_signed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    minimum_guarantee_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    variable_commission_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    invoice_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    partner: Mapped[Partner] = relationship("Partner", back_populates="commissions")

    __table_args__ = (
        UniqueConstraint(
            "partner_id", "period_start", "period_end",
            name="uq_partner_commissions_period",
        ),
        Index("ix_partner_commissions_period", "period_start"),
    )
