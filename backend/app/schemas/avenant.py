"""Schemas Pydantic — Avenant (Sprint 10 Lot 2).

Source de vérité valeurs enum : migration 0051 §E CHECK constraints.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

AvenantType = Literal[
    "animaux",
    "modification_loyer",
    "modification_date",
    "prolongation",
    "resiliation_anticipee",
    "changement_proprietaire",
    "changement_locataire",
    "charge_electrique",
    "accord_specifique",
]

AvenantStatus = Literal["draft", "pending_signatures", "signed", "terminated"]


class AvenantCreate(BaseModel):
    contract_id: uuid.UUID
    avenant_type: AvenantType
    objet: str = Field(..., min_length=3, max_length=2000)
    body_text: str | None = None
    effective_date: date | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class AvenantUpdate(BaseModel):
    avenant_type: AvenantType | None = None
    objet: str | None = Field(None, min_length=3, max_length=2000)
    body_text: str | None = None
    effective_date: date | None = None
    data: dict[str, Any] | None = None
    status: AvenantStatus | None = None


class AvenantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contract_id: uuid.UUID
    agency_id: uuid.UUID | None
    reference: str
    avenant_type: str
    objet: str
    body_text: str | None
    effective_date: date | None
    data: dict[str, Any]
    status: str

    signed_at_locataire: datetime | None
    signed_at_agence: datetime | None
    fully_signed: bool = False

    skribble_session_id: str | None
    skribble_status: str | None
    skribble_signed_pdf_url: str | None
    draft_pdf_url: str | None

    is_active: bool
    created_at: datetime
    updated_at: datetime


class PaginatedAvenants(BaseModel):
    items: list[AvenantRead]
    total: int
    page: int
    size: int
    pages: int
