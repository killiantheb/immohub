"""Schémas Pydantic v2 — interventions + devis."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Intervention ──────────────────────────────────────────────────────────────

class InterventionBase(BaseModel):
    bien_id: uuid.UUID
    titre: str
    description: Optional[str] = None
    categorie: Literal[
        "plomberie", "electricite", "menuiserie",
        "peinture", "serrurerie", "chauffage", "autre"
    ] = "autre"
    urgence: Literal["faible", "moderee", "urgente", "tres_urgente"] = "moderee"
    statut: Literal["brouillon", "publie", "nouveau", "en_cours", "planifie", "resolu"] = "nouveau"
    avancement: int = Field(default=0, ge=0, le=100)
    date_signalement: Optional[date] = None
    date_intervention: Optional[date] = None
    cout: Optional[Decimal] = None
    photos: Optional[list[str]] = None
    artisan_id: Optional[uuid.UUID] = None


class InterventionCreate(InterventionBase):
    pass


class InterventionUpdate(BaseModel):
    titre: Optional[str] = None
    description: Optional[str] = None
    categorie: Optional[str] = None
    urgence: Optional[str] = None
    statut: Optional[Literal["brouillon", "publie", "nouveau", "en_cours", "planifie", "resolu"]] = None
    avancement: Optional[int] = Field(default=None, ge=0, le=100)
    date_intervention: Optional[date] = None
    cout: Optional[Decimal] = None
    photos: Optional[list[str]] = None
    artisan_id: Optional[uuid.UUID] = None


class InterventionRead(InterventionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    signale_par_id: uuid.UUID
    created_at: datetime


# ── Devis ─────────────────────────────────────────────────────────────────────

class DevisBase(BaseModel):
    intervention_id: uuid.UUID
    artisan_id: uuid.UUID
    montant: Decimal
    description: Optional[str] = None
    statut: Literal["en_attente", "accepte", "refuse"] = "en_attente"
    date_envoi: Optional[date] = None
    date_reponse: Optional[date] = None


class DevisCreate(DevisBase):
    pass


class DevisUpdate(BaseModel):
    montant: Optional[Decimal] = None
    description: Optional[str] = None
    statut: Optional[Literal["en_attente", "accepte", "refuse"]] = None
    date_reponse: Optional[date] = None


class DevisRead(DevisBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
