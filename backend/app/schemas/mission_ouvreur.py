"""Schémas Pydantic v2 — missions_ouvreurs + profiles_ouvreurs."""

from __future__ import annotations

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


# ── Mission ouvreur ───────────────────────────────────────────────────────────

class MissionOuvreurBase(BaseModel):
    bien_id: uuid.UUID
    agence_id: Optional[uuid.UUID] = None
    ouvreur_id: Optional[uuid.UUID] = None
    type: Literal["visite", "edl_entree", "edl_sortie", "remise_cles", "expertise"]
    date_mission: Optional[str] = None  # YYYY-MM-DD
    creneau_debut: Optional[time] = None
    creneau_fin: Optional[time] = None
    nb_candidats: int = 0
    instructions: Optional[str] = None
    remuneration: Optional[Decimal] = None
    statut: Literal["proposee", "acceptee", "effectuee", "annulee"] = "proposee"
    rayon_km: int = 20


class MissionOuvreurCreate(MissionOuvreurBase):
    pass


class MissionOuvreurUpdate(BaseModel):
    ouvreur_id: Optional[uuid.UUID] = None
    date_mission: Optional[str] = None
    creneau_debut: Optional[time] = None
    creneau_fin: Optional[time] = None
    nb_candidats: Optional[int] = None
    instructions: Optional[str] = None
    remuneration: Optional[Decimal] = None
    statut: Optional[Literal["proposee", "acceptee", "effectuee", "annulee"]] = None


class MissionOuvreurRead(MissionOuvreurBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ── Profile ouvreur ───────────────────────────────────────────────────────────

class ProfileOuvreurBase(BaseModel):
    # Identité
    statut_ouvreur: Optional[str] = None   # independant/employe_agence
    numero_avs: Optional[str] = None
    permis_conduire: bool = False
    vehicule: bool = False
    # Zone & dispo
    rayon_km: int = 20
    jours_dispo: Optional[list[int]] = None
    heure_debut: Optional[time] = None
    heure_fin: Optional[time] = None
    types_missions: Optional[list[str]] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    # Préférences charge
    montant_min_mission: Optional[float] = None
    urgences_acceptees: bool = False
    majoration_urgence_pct: int = 0
    missions_par_jour: int = 5
    # Paiement
    iban: Optional[str] = None
    bic: Optional[str] = None
    bank_account_holder: Optional[str] = None
    billing_name: Optional[str] = None
    billing_adresse: Optional[str] = None
    virement_auto: bool = False


class ProfileOuvreurCreate(ProfileOuvreurBase):
    user_id: uuid.UUID


class ProfileOuvreurUpdate(BaseModel):
    statut_ouvreur: Optional[str] = None
    numero_avs: Optional[str] = None
    permis_conduire: Optional[bool] = None
    vehicule: Optional[bool] = None
    rayon_km: Optional[int] = None
    jours_dispo: Optional[list[int]] = None
    heure_debut: Optional[time] = None
    heure_fin: Optional[time] = None
    types_missions: Optional[list[str]] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    montant_min_mission: Optional[float] = None
    urgences_acceptees: Optional[bool] = None
    majoration_urgence_pct: Optional[int] = None
    missions_par_jour: Optional[int] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    bank_account_holder: Optional[str] = None
    billing_name: Optional[str] = None
    billing_adresse: Optional[str] = None
    virement_auto: Optional[bool] = None


class ProfileOuvreurRead(ProfileOuvreurBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_missions: int
    created_at: datetime
