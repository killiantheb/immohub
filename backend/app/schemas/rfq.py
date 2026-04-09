from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RFQCategory = Literal[
    "plumbing",
    "electricity",
    "cleaning",
    "painting",
    "locksmith",
    "roofing",
    "gardening",
    "masonry",
    "hvac",
    "renovation",
    "other",
]
RFQStatus = Literal[
    "draft",
    "published",
    "quotes_received",
    "accepted",
    "in_progress",
    "completed",
    "rated",
    "cancelled",
]
RFQUrgency = Literal["low", "medium", "high", "emergency"]


# ── RFQ ───────────────────────────────────────────────────────────────────────


class RFQCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    category: RFQCategory
    urgency: RFQUrgency = "medium"
    city: str | None = None
    zip_code: str | None = None
    budget_min: float | None = Field(None, ge=0)
    budget_max: float | None = Field(None, ge=0)
    scheduled_date: datetime | None = None
    property_id: uuid.UUID | None = None


class RFQRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    property_id: uuid.UUID | None
    title: str
    description: str
    category: str
    ai_detected: bool
    status: str
    urgency: str
    city: str | None
    zip_code: str | None
    budget_min: float | None
    budget_max: float | None
    scheduled_date: datetime | None
    selected_quote_id: uuid.UUID | None
    commission_amount: float | None
    published_at: datetime | None
    accepted_at: datetime | None
    completed_at: datetime | None
    rating_given: float | None
    rating_comment: str | None
    is_active: bool
    created_at: datetime
    quotes: list[RFQQuoteRead] = []


class PaginatedRFQs(BaseModel):
    items: list[RFQRead]
    total: int
    page: int
    size: int
    pages: int


class AIQualifyRequest(BaseModel):
    description: str = Field(..., min_length=10)


class AIQualifyResponse(BaseModel):
    category: RFQCategory
    suggested_title: str
    urgency: RFQUrgency
    confidence: float


# ── RFQ Quote ─────────────────────────────────────────────────────────────────


class RFQQuoteCreate(BaseModel):
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=20)
    delay_days: int | None = Field(None, ge=1, le=365)
    warranty_months: int | None = Field(None, ge=0, le=120)
    notes: str | None = None


class RFQQuoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rfq_id: uuid.UUID
    company_id: uuid.UUID
    amount: float
    description: str
    delay_days: int | None
    warranty_months: int | None
    notes: str | None
    status: str
    submitted_at: datetime | None
    accepted_at: datetime | None
    completed_at: datetime | None
    is_active: bool
    created_at: datetime


class RFQRating(BaseModel):
    rating: float = Field(..., ge=1, le=5)
    comment: str | None = None


# ── Company marketplace ────────────────────────────────────────────────────────


class CompanyMarketplaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    description: str | None
    rating: float | None
    total_jobs: int
    city: str | None
    zip_code: str | None


# Update forward refs
RFQRead.model_rebuild()
