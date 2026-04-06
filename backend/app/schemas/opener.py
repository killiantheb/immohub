from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MissionType = Literal["visit", "check_in", "check_out", "inspection", "photography", "other"]
MissionStatus = Literal["pending", "confirmed", "in_progress", "completed", "cancelled"]

# ── Opener ────────────────────────────────────────────────────────────────────

class OpenerProfileCreate(BaseModel):
    """Create or fully-replace the caller's opener profile."""
    bio: str | None = None
    radius_km: float = Field(20.0, gt=0, le=200)
    hourly_rate: float | None = Field(None, ge=0)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    skills: list[str] = Field(default_factory=list)
    is_available: bool = True


class OpenerProfileUpdate(BaseModel):
    bio: str | None = None
    radius_km: float | None = Field(None, gt=0, le=200)
    hourly_rate: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    skills: list[str] | None = None
    is_available: bool | None = None


class OpenerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    bio: str | None
    radius_km: float | None
    hourly_rate: float | None
    latitude: float | None
    longitude: float | None
    skills: list[str] | None
    is_available: bool
    rating: float | None
    total_missions: int
    created_at: datetime


class OpenerWithDistance(OpenerRead):
    """OpenerRead enriched with computed distance from a reference point."""
    distance_km: float


# ── Mission ───────────────────────────────────────────────────────────────────

class MissionCreate(BaseModel):
    property_id: str
    type: MissionType
    scheduled_at: datetime
    notes: str | None = None
    # Property coordinates provided by the requester (from browser geoloc or address geocoding)
    property_lat: float | None = Field(None, ge=-90, le=90)
    property_lng: float | None = Field(None, ge=-180, le=180)
    # If provided, pre-assigns this opener; otherwise auto-matched
    opener_id: str | None = None


class MissionComplete(BaseModel):
    report_text: str | None = None
    photos_urls: list[str] = Field(default_factory=list)
    report_url: str | None = None


class MissionRate(BaseModel):
    rating: float = Field(..., ge=1, le=5)
    comment: str | None = None


class MissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requester_id: str
    opener_id: str | None
    property_id: str
    type: str
    status: str
    scheduled_at: datetime
    accepted_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancelled_reason: str | None
    property_lat: float | None
    property_lng: float | None
    price: float | None
    notes: str | None
    report_text: str | None
    report_url: str | None
    photos_urls: list[str] | None
    rating_given: float | None
    rating_comment: str | None
    stripe_payment_intent_id: str | None
    is_active: bool
    created_at: datetime


class PaginatedMissions(BaseModel):
    items: list[MissionRead]
    total: int
    page: int
    size: int
    pages: int


class MissionPriceEstimate(BaseModel):
    mission_type: str
    distance_km: float
    base_price: float
    distance_surcharge: float
    total: float
