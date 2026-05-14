"""Schemas Pydantic — MandatGestion (Sprint 10 Lot 2).

Source de vérité valeurs enum : migration 0051 §D CHECK constraints.

§2.4.16 — commission_pct_* = DATA contractuelle pure, AUCUN tracking
transactionnel Althy.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MandatStatus = Literal["draft", "pending_signatures", "active", "terminated", "expired"]


class MandatGestionCreate(BaseModel):
    mandant_id: uuid.UUID
    agence_id: uuid.UUID
    bien_id: uuid.UUID | None = None

    commission_pct_annee: Decimal = Field(Decimal("10.00"), ge=0, le=100)
    commission_pct_saison: Decimal = Field(Decimal("15.00"), ge=0, le=100)
    commission_pct_semaine: Decimal = Field(Decimal("20.00"), ge=0, le=100)

    notes: str | None = None
    for_juridique: str = Field("Sierre", max_length=100)

    start_date: date
    end_date: date | None = None
    notice_period_months: int = Field(3, ge=0, le=24)
    notice_deadline_month_day: str | None = Field(None, max_length=10)

    @model_validator(mode="after")
    def _distinct_parties(self) -> "MandatGestionCreate":
        if self.mandant_id == self.agence_id:
            raise ValueError("mandant_id et agence_id doivent être distincts")
        return self

    @model_validator(mode="after")
    def _end_after_start(self) -> "MandatGestionCreate":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date doit être >= start_date")
        return self


class MandatGestionUpdate(BaseModel):
    bien_id: uuid.UUID | None = None
    commission_pct_annee: Decimal | None = Field(None, ge=0, le=100)
    commission_pct_saison: Decimal | None = Field(None, ge=0, le=100)
    commission_pct_semaine: Decimal | None = Field(None, ge=0, le=100)
    notes: str | None = None
    for_juridique: str | None = Field(None, max_length=100)
    end_date: date | None = None
    notice_period_months: int | None = Field(None, ge=0, le=24)
    notice_deadline_month_day: str | None = Field(None, max_length=10)
    status: MandatStatus | None = None


class MandatGestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mandant_id: uuid.UUID
    agence_id: uuid.UUID
    bien_id: uuid.UUID | None
    reference: str
    status: str

    signed_at_mandant: datetime | None
    signed_ip_mandant: str | None
    signed_at_agence: datetime | None
    signed_ip_agence: str | None
    fully_signed: bool = False

    skribble_session_id: str | None
    skribble_status: str | None
    skribble_signed_pdf_url: str | None

    commission_pct_annee: Decimal
    commission_pct_saison: Decimal
    commission_pct_semaine: Decimal

    notes: str | None
    for_juridique: str

    start_date: date
    end_date: date | None
    notice_period_months: int
    notice_deadline_month_day: str | None

    terminated_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PaginatedMandats(BaseModel):
    items: list[MandatGestionRead]
    total: int
    page: int
    size: int
    pages: int
