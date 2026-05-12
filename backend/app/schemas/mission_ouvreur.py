"""Schémas Pydantic v2 — missions_ouvreurs + profiles_ouvreurs."""

from __future__ import annotations

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

# ── Mission ouvreur ───────────────────────────────────────────────────────────

class MissionOuvreurBase(BaseModel):
    bien_id: uuid.UUID
    agence_id: uuid.UUID | None = None
    ouvreur_id: uuid.UUID | None = None
    type: Literal["visite", "edl_entree", "edl_sortie", "remise_cles", "expertise"]
    date_mission: str | None = None  # YYYY-MM-DD
    creneau_debut: time | None = None
    creneau_fin: time | None = None
    nb_candidats: int = 0
    instructions: str | None = None
    remuneration: Decimal | None = None
    statut: Literal["brouillon", "proposee", "publiee", "acceptee", "effectuee", "annulee"] = "proposee"
    rayon_km: int = 20


class MissionOuvreurCreate(MissionOuvreurBase):
    pass


class MissionOuvreurUpdate(BaseModel):
    ouvreur_id: uuid.UUID | None = None
    date_mission: str | None = None
    creneau_debut: time | None = None
    creneau_fin: time | None = None
    nb_candidats: int | None = None
    instructions: str | None = None
    remuneration: Decimal | None = None
    statut: Literal["brouillon", "proposee", "publiee", "acceptee", "effectuee", "annulee"] | None = None


class MissionOuvreurRead(MissionOuvreurBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ── Profile ouvreur ───────────────────────────────────────────────────────────

class ProfileOuvreurBase(BaseModel):
    # Identité
    statut_ouvreur: str | None = None   # independant/employe_agence
    numero_avs: str | None = None
    permis_conduire: bool = False
    vehicule: bool = False
    # Zone & dispo
    rayon_km: int = 20
    jours_dispo: list[int] | None = None
    heure_debut: time | None = None
    heure_fin: time | None = None
    types_missions: list[str] | None = None
    lat: float | None = None
    lng: float | None = None
    # Préférences charge
    montant_min_mission: float | None = None
    urgences_acceptees: bool = False
    majoration_urgence_pct: int = 0
    missions_par_jour: int = 5
    # Paiement
    iban: str | None = None
    bic: str | None = None
    bank_account_holder: str | None = None
    billing_name: str | None = None
    billing_adresse: str | None = None
    virement_auto: bool = False


class ProfileOuvreurCreate(ProfileOuvreurBase):
    user_id: uuid.UUID


class ProfileOuvreurUpdate(BaseModel):
    statut_ouvreur: str | None = None
    numero_avs: str | None = None
    permis_conduire: bool | None = None
    vehicule: bool | None = None
    rayon_km: int | None = None
    jours_dispo: list[int] | None = None
    heure_debut: time | None = None
    heure_fin: time | None = None
    types_missions: list[str] | None = None
    lat: float | None = None
    lng: float | None = None
    montant_min_mission: float | None = None
    urgences_acceptees: bool | None = None
    majoration_urgence_pct: int | None = None
    missions_par_jour: int | None = None
    iban: str | None = None
    bic: str | None = None
    bank_account_holder: str | None = None
    billing_name: str | None = None
    billing_adresse: str | None = None
    virement_auto: bool | None = None


class ProfileOuvreurRead(ProfileOuvreurBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_missions: int
    created_at: datetime
