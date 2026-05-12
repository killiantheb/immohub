"""Schémas Pydantic v2 — profiles_artisans."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProfileArtisanBase(BaseModel):
    # Identité
    raison_sociale: str | None = None
    uid_ide: str | None = None
    numero_tva: str | None = None
    statut_juridique: str | None = None   # independant/sarl/sa
    annees_experience: int | None = None
    site_web: str | None = None
    # Activité
    specialites: list[str] | None = None
    rayon_km: int = 30
    assurance_rc: bool = False
    lat: float | None = None
    lng: float | None = None
    # Préférences charge
    montant_min_mission: float | None = None
    urgences_acceptees: bool = False
    majoration_urgence_pct: int = 0
    chantiers_simultanees: int = 3
    # Paiement
    iban: str | None = None
    delai_paiement_jours: int = 30
    billing_name: str | None = None
    billing_adresse: str | None = None
    virement_auto: bool = False
    facturation_auto: bool = False
    relance_auto: bool = False
    # Marketplace M1 (migration 0036)
    canton: str | None = None
    specialties: list[str] | None = None


class ProfileArtisanCreate(ProfileArtisanBase):
    user_id: uuid.UUID


class ProfileArtisanUpdate(BaseModel):
    raison_sociale: str | None = None
    uid_ide: str | None = None
    numero_tva: str | None = None
    statut_juridique: str | None = None
    annees_experience: int | None = None
    site_web: str | None = None
    specialites: list[str] | None = None
    rayon_km: int | None = None
    assurance_rc: bool | None = None
    lat: float | None = None
    lng: float | None = None
    montant_min_mission: float | None = None
    urgences_acceptees: bool | None = None
    majoration_urgence_pct: int | None = None
    chantiers_simultanees: int | None = None
    iban: str | None = None
    delai_paiement_jours: int | None = None
    billing_name: str | None = None
    billing_adresse: str | None = None
    virement_auto: bool | None = None
    facturation_auto: bool | None = None
    relance_auto: bool | None = None
    # Marketplace M1
    canton: str | None = None
    specialties: list[str] | None = None


class ProfileArtisanRead(ProfileArtisanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    note_moyenne: float
    nb_chantiers: int
    created_at: datetime
    subscription_plan: str | None = None
    is_founding_member: bool = False
    stripe_connect_id: str | None = None
    stripe_connect_ready: bool = False
    subscription_activated_at: datetime | None = None


# ── Subscribe (marketplace M1) ───────────────────────────────────────────────

class ArtisanSubscribeRequest(BaseModel):
    """Requête de souscription marketplace — décide plan final (founding si dispo)."""
    canton: str
    specialties: list[str]
    # Si desired_plan = artisan_free_early mais le canton est plein → fallback verified.
    desired_plan: str = "artisan_free_early"


class ArtisanSubscribeResponse(BaseModel):
    assigned_plan: str               # artisan_free_early ou artisan_verified
    is_founding_member: bool
    founding_spots_remaining: int    # sur 50
    requires_stripe_kyc: bool
    requires_payment: bool           # false si fondateur, true sinon


class FoundingSpotRead(BaseModel):
    canton: str
    total_spots: int
    taken: int
    remaining: int
