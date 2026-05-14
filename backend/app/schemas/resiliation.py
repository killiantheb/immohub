"""Schemas Pydantic — Resiliation (Sprint 10 Lot 2).

Source de vérité valeurs enum : migration 0051 §F CHECK constraints.

Warning CO 266l : si initiateur=bailleur ET bail d'habitation, l'UI doit
afficher que la formule officielle cantonale reste obligatoire (Phase 1.0
ne la remplace pas — cf models/resiliation.py docstring).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ResiliationInitiateur = Literal["locataire", "bailleur", "agence_mandataire"]
ResiliationStatus = Literal[
    "draft", "pending_signatures", "signed", "envoyee", "appliquee", "annulee"
]


class ResiliationCreate(BaseModel):
    contract_id: uuid.UUID
    initiateur: ResiliationInitiateur
    motif: str | None = Field(None, max_length=200)
    date_resiliation: date
    date_envoi: date
    respect_preavis: bool = False
    preavis_months: int = Field(3, ge=0, le=12)


class ResiliationUpdate(BaseModel):
    motif: str | None = Field(None, max_length=200)
    date_resiliation: date | None = None
    date_envoi: date | None = None
    respect_preavis: bool | None = None
    preavis_months: int | None = Field(None, ge=0, le=12)
    status: ResiliationStatus | None = None


class ResiliationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contract_id: uuid.UUID
    agency_id: uuid.UUID | None
    reference: str
    initiateur: str
    motif: str | None

    date_resiliation: date
    date_envoi: date
    respect_preavis: bool
    preavis_months: int

    status: str
    signed_at: datetime | None

    skribble_session_id: str | None
    skribble_status: str | None
    skribble_signed_pdf_url: str | None
    draft_pdf_url: str | None
    notification_envoyee_at: datetime | None

    is_active: bool
    created_at: datetime
    updated_at: datetime


class ResiliationCreateResponse(ResiliationRead):
    """Réponse à POST /resiliations — inclut le warning CO 266l si applicable."""

    warning_co_266l: bool = False
    warning_message: str | None = None


class PaginatedResiliations(BaseModel):
    items: list[ResiliationRead]
    total: int
    page: int
    size: int
    pages: int
