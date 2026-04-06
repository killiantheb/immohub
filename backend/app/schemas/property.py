from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Literal types (must match SQLAlchemy Enum values in models/property.py) ──

PropertyType = Literal[
    "apartment", "villa", "parking", "garage", "box",
    "cave", "depot", "office", "commercial", "hotel",
]
PropertyStatus = Literal["available", "rented", "for_sale", "sold", "maintenance"]
DocumentType = Literal["lease", "inventory", "insurance", "notice", "deed", "diagnosis", "other"]


# ── Sub-resource responses ─────────────────────────────────────────────────────

class PropertyImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    order: int
    is_cover: bool
    created_at: datetime


class PropertyDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    url: str
    name: str
    created_at: datetime


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None
    action: str
    resource_type: str
    resource_id: str | None
    old_values: dict | None
    new_values: dict | None
    created_at: datetime


# ── Property request schemas ───────────────────────────────────────────────────

class PropertyCreate(BaseModel):
    type: PropertyType
    status: PropertyStatus = "available"
    address: str = Field(..., min_length=1, max_length=500)
    city: str = Field(..., min_length=1, max_length=100)
    zip_code: str = Field(..., min_length=1, max_length=10)
    country: str = Field("FR", min_length=2, max_length=2)
    surface: float | None = Field(None, gt=0)
    rooms: int | None = Field(None, gt=0)
    floor: int | None = None
    description: str | None = None
    monthly_rent: float | None = Field(None, ge=0)
    charges: float | None = Field(None, ge=0)
    deposit: float | None = Field(None, ge=0)
    price_sale: float | None = Field(None, ge=0)
    is_furnished: bool = False
    has_parking: bool = False
    pets_allowed: bool = False


class PropertyUpdate(BaseModel):
    type: PropertyType | None = None
    status: PropertyStatus | None = None
    address: str | None = Field(None, min_length=1, max_length=500)
    city: str | None = None
    zip_code: str | None = None
    country: str | None = None
    surface: float | None = None
    rooms: int | None = None
    floor: int | None = None
    description: str | None = None
    monthly_rent: float | None = None
    charges: float | None = None
    deposit: float | None = None
    price_sale: float | None = None
    is_furnished: bool | None = None
    has_parking: bool | None = None
    pets_allowed: bool | None = None


# ── Property response schemas ──────────────────────────────────────────────────

class PropertyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    agency_id: str | None
    created_by_id: str
    type: str
    status: str
    address: str
    city: str
    zip_code: str
    country: str
    surface: float | None
    rooms: int | None
    floor: int | None
    description: str | None
    monthly_rent: float | None
    charges: float | None
    deposit: float | None
    price_sale: float | None
    is_furnished: bool
    has_parking: bool
    pets_allowed: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PropertyDetail(PropertyRead):
    """Full property response including images and documents."""

    images: list[PropertyImageResponse] = []
    documents: list[PropertyDocumentResponse] = []


# ── Pagination ─────────────────────────────────────────────────────────────────

class PaginatedProperties(BaseModel):
    items: list[PropertyRead]
    total: int
    page: int
    size: int
    pages: int
