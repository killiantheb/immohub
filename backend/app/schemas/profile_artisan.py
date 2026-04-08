"""Schémas Pydantic v2 — profiles_artisans."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProfileArtisanBase(BaseModel):
    raison_sociale: Optional[str] = None
    uid_ide: Optional[str] = None
    numero_tva: Optional[str] = None
    specialites: Optional[list[str]] = None
    rayon_km: int = 30
    assurance_rc: bool = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    iban: Optional[str] = None
    delai_paiement_jours: int = 30


class ProfileArtisanCreate(ProfileArtisanBase):
    user_id: uuid.UUID


class ProfileArtisanUpdate(ProfileArtisanBase):
    rayon_km: Optional[int] = None  # type: ignore[assignment]
    assurance_rc: Optional[bool] = None  # type: ignore[assignment]
    delai_paiement_jours: Optional[int] = None  # type: ignore[assignment]


class ProfileArtisanRead(ProfileArtisanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_chantiers: int
    created_at: datetime
