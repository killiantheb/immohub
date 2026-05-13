"""Schémas Pydantic v2 — interventions + devis."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Intervention photos (relation) ────────────────────────────────────────────

class InterventionPhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    intervention_id: uuid.UUID
    url: str
    order: int
    created_at: datetime


# ── Intervention ──────────────────────────────────────────────────────────────

class InterventionBase(BaseModel):
    bien_id: uuid.UUID
    titre: str
    description: str | None = None
    categorie: Literal[
        "plomberie", "electricite", "menuiserie",
        "peinture", "serrurerie", "chauffage", "autre"
    ] = "autre"
    urgence: Literal["faible", "moderee", "urgente", "tres_urgente"] = "moderee"
    statut: Literal["nouveau", "en_cours", "planifie", "resolu"] = "nouveau"
    avancement: int = Field(default=0, ge=0, le=100)
    date_signalement: date | None = None
    date_intervention: date | None = None
    cout: Decimal | None = None
    photos: list[str] | None = None
    artisan_id: uuid.UUID | None = None
    note_cloture: str | None = None
    closed_at: datetime | None = None


class InterventionCreate(InterventionBase):
    pass


class InterventionUpdate(BaseModel):
    titre: str | None = None
    description: str | None = None
    categorie: str | None = None
    urgence: str | None = None
    statut: Literal["nouveau", "en_cours", "planifie", "resolu"] | None = None
    avancement: int | None = Field(default=None, ge=0, le=100)
    date_intervention: date | None = None
    cout: Decimal | None = None
    photos: list[str] | None = None
    artisan_id: uuid.UUID | None = None
    note_cloture: str | None = None


class InterventionRead(InterventionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    signale_par_id: uuid.UUID
    created_at: datetime
    images: list[InterventionPhotoRead] = []
    # Sprint 6 K6 — progression dérivée du statut (0/33/66/100). Calculée
    # côté model via @hybrid_property → exposée ici en lecture seule. Le
    # frontend l'utilise pour la progress bar §B.4 (Or → Prussian → Vert).
    progression: int = 0


# ── Devis ─────────────────────────────────────────────────────────────────────

class DevisBase(BaseModel):
    intervention_id: uuid.UUID
    artisan_id: uuid.UUID
    montant: Decimal
    description: str | None = None
    statut: Literal["en_attente", "accepte", "refuse"] = "en_attente"
    date_envoi: date | None = None
    date_reponse: date | None = None


class DevisCreate(DevisBase):
    pass


class DevisUpdate(BaseModel):
    montant: Decimal | None = None
    description: str | None = None
    statut: Literal["en_attente", "accepte", "refuse"] | None = None
    date_reponse: date | None = None


class DevisRead(DevisBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
