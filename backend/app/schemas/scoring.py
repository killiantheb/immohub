"""Schémas Pydantic v2 — scoring_locataires."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ScoringLocataireBase(BaseModel):
    locataire_id: uuid.UUID
    ponctualite: float = Field(default=5.0, ge=0, le=10)
    solvabilite: float = Field(default=5.0, ge=0, le=10)
    communication: float = Field(default=5.0, ge=0, le=10)
    etat_logement: float = Field(default=5.0, ge=0, le=10)
    nb_retards: int = 0


class ScoringLocataireCreate(ScoringLocataireBase):
    pass


class ScoringLocataireUpdate(BaseModel):
    ponctualite: Optional[float] = Field(default=None, ge=0, le=10)
    solvabilite: Optional[float] = Field(default=None, ge=0, le=10)
    communication: Optional[float] = Field(default=None, ge=0, le=10)
    etat_logement: Optional[float] = Field(default=None, ge=0, le=10)
    nb_retards: Optional[int] = None


class ScoringLocataireRead(ScoringLocataireBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    score_global: float
    updated_at: Optional[datetime] = None
    created_at: datetime
