"""Schémas Pydantic v2 — biens (refonte fusion).

Exports principaux :
    BienCreate / BienUpdate / BienRead / BienListItem / BienDetail / PaginatedBiens
    BienImageCreate / BienImageRead
    BienDocumentCreate / BienDocumentRead
    CatalogueEquipementRead
    SetEquipementsRequest
    AuditLogResponse
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ══════════════════════════════════════════════════════════════════════════════
# Literals
# ══════════════════════════════════════════════════════════════════════════════

BienTypeLiteral = Literal[
    "appartement", "villa", "studio", "maison",
    "commerce", "bureau", "parking", "garage", "cave", "autre",
]

BienStatutLiteral = Literal["loue", "vacant", "en_travaux"]

ParkingTypeLiteral = Literal[
    "exterieur", "exterieur_couvert", "interieur", "interieur_box",
]

EquipementCategorie = Literal[
    "cuisine", "literie", "salle_bain", "tech", "loisirs", "entretien", "confort",
]


# ══════════════════════════════════════════════════════════════════════════════
# Bien — schémas CRUD
# ══════════════════════════════════════════════════════════════════════════════


class BienBase(BaseModel):
    """Tous les champs éditables d'un bien."""

    # Localisation (obligatoire à la création)
    adresse: str
    ville: str
    cp: str
    canton: Optional[str] = None  # Auto-rempli par bien_service si cp connu

    # Identité
    building_name: Optional[str] = None
    unit_number: Optional[str] = None
    reference_number: Optional[str] = None

    # Type et statut
    type: BienTypeLiteral = "appartement"
    statut: BienStatutLiteral = "vacant"

    # Caractéristiques
    surface: Optional[float] = None
    etage: Optional[int] = None
    rooms: Optional[float] = Field(default=None, description="Peut être 3.5 (pièce 1/2 CH)")
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    annee_construction: Optional[int] = None
    annee_renovation: Optional[int] = None

    # Équipements booléens
    is_furnished: bool = False
    has_balcony: bool = False
    has_terrace: bool = False
    has_garden: bool = False
    has_storage: bool = False
    has_fireplace: bool = False
    has_laundry_private: bool = False
    has_laundry_building: bool = False
    classe_energetique: Optional[str] = Field(default=None, pattern=r"^[A-G]$")

    # Parking
    parking_type: Optional[ParkingTypeLiteral] = None

    # Règles
    pets_allowed: bool = False
    smoking_allowed: bool = False

    # Situation et transports
    distance_gare_minutes: Optional[int] = None
    distance_arret_bus_minutes: Optional[int] = None
    distance_telecabine_minutes: Optional[int] = None
    distance_lac_minutes: Optional[int] = None
    distance_aeroport_minutes: Optional[int] = None
    situation_notes: Optional[str] = None

    # Présentation
    description_lieu: Optional[str] = None
    description_logement: Optional[str] = None
    remarques: Optional[str] = None

    # Finances
    loyer: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    deposit: Optional[Decimal] = None

    # Opérationnel
    keys_count: Optional[int] = 3

    # Coordonnées
    lat: Optional[float] = None
    lng: Optional[float] = None


class BienCreate(BienBase):
    """Payload création — les champs obligatoires sont ceux de BienBase."""

    pass


class BienUpdate(BaseModel):
    """PATCH partiel — tous les champs optionnels."""

    adresse: Optional[str] = None
    ville: Optional[str] = None
    cp: Optional[str] = None
    canton: Optional[str] = None

    building_name: Optional[str] = None
    unit_number: Optional[str] = None
    reference_number: Optional[str] = None

    type: Optional[BienTypeLiteral] = None
    statut: Optional[BienStatutLiteral] = None

    surface: Optional[float] = None
    etage: Optional[int] = None
    rooms: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    annee_construction: Optional[int] = None
    annee_renovation: Optional[int] = None

    is_furnished: Optional[bool] = None
    has_balcony: Optional[bool] = None
    has_terrace: Optional[bool] = None
    has_garden: Optional[bool] = None
    has_storage: Optional[bool] = None
    has_fireplace: Optional[bool] = None
    has_laundry_private: Optional[bool] = None
    has_laundry_building: Optional[bool] = None
    classe_energetique: Optional[str] = Field(default=None, pattern=r"^[A-G]$")

    parking_type: Optional[ParkingTypeLiteral] = None

    pets_allowed: Optional[bool] = None
    smoking_allowed: Optional[bool] = None

    distance_gare_minutes: Optional[int] = None
    distance_arret_bus_minutes: Optional[int] = None
    distance_telecabine_minutes: Optional[int] = None
    distance_lac_minutes: Optional[int] = None
    distance_aeroport_minutes: Optional[int] = None
    situation_notes: Optional[str] = None

    description_lieu: Optional[str] = None
    description_logement: Optional[str] = None
    remarques: Optional[str] = None

    loyer: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    deposit: Optional[Decimal] = None
    keys_count: Optional[int] = None

    lat: Optional[float] = None
    lng: Optional[float] = None


class BienRead(BienBase):
    """Lecture d'un bien, avec champs systèmes."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    agency_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# Images
# ══════════════════════════════════════════════════════════════════════════════


class BienImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bien_id: uuid.UUID
    url: str
    order: int
    is_cover: bool
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# Documents
# ══════════════════════════════════════════════════════════════════════════════


class BienDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bien_id: uuid.UUID
    type: str
    url: str
    name: str
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# Catalogue équipements
# ══════════════════════════════════════════════════════════════════════════════


class CatalogueEquipementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nom: str
    categorie: EquipementCategorie
    icone: Optional[str] = None
    ordre_affichage: int


class SetEquipementsRequest(BaseModel):
    """Payload pour remplacer la liste d'équipements d'un bien en une seule op."""

    equipement_ids: list[uuid.UUID]


class BienEquipementRead(BaseModel):
    """Retourne un équipement attaché à un bien avec le détail catalogue."""

    id: uuid.UUID
    bien_id: uuid.UUID
    equipement: CatalogueEquipementRead


# ══════════════════════════════════════════════════════════════════════════════
# Détail + liste paginée
# ══════════════════════════════════════════════════════════════════════════════


class BienListItem(BienRead):
    """Lightweight pour la liste paginée — inclut l'image de couverture."""

    images: list[BienImageRead] = Field(default_factory=list)


class BienDetail(BienRead):
    """Détail complet : images + documents + équipements."""

    images: list[BienImageRead] = Field(default_factory=list)
    documents: list[BienDocumentRead] = Field(default_factory=list)
    equipements: list[CatalogueEquipementRead] = Field(default_factory=list)


class PaginatedBiens(BaseModel):
    items: list[BienListItem]
    total: int
    page: int
    size: int
    pages: int


# ══════════════════════════════════════════════════════════════════════════════
# AuditLog (history endpoint)
# ══════════════════════════════════════════════════════════════════════════════


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    resource_type: str
    resource_id: str
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    created_at: datetime
