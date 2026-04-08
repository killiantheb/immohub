"""Schémas Pydantic v2 — biens."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class BienBase(BaseModel):
    adresse: str
    ville: str
    cp: str
    type: Literal[
        "appartement", "villa", "studio", "maison",
        "commerce", "bureau", "parking", "garage", "cave", "autre"
    ] = "appartement"
    surface: Optional[float] = None
    etage: Optional[int] = None
    loyer: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    statut: Literal["loue", "vacant", "en_travaux"] = "vacant"


class BienCreate(BienBase):
    owner_id: uuid.UUID


class BienUpdate(BaseModel):
    adresse: Optional[str] = None
    ville: Optional[str] = None
    cp: Optional[str] = None
    type: Optional[str] = None
    surface: Optional[float] = None
    etage: Optional[int] = None
    loyer: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    statut: Optional[Literal["loue", "vacant", "en_travaux"]] = None


class BienRead(BienBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
