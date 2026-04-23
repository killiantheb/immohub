"""Schémas Pydantic v2 — biens (refonte fusion).

Exports principaux :
    BienCreate / BienUpdate / BienRead / BienListItem / BienDetail / PaginatedBiens
    BienImageRead
    BienDocumentRead
    CatalogueEquipementRead
    SetEquipementsRequest
    BienEquipementRead
    AuditLogResponse

Note : pas de BienImageCreate / BienDocumentCreate — les uploads sont gérés
en multipart/form-data (file + form), pas en JSON.
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
    """Tous les champs éditables d'un bien.

    Contrat API minimal à la création : `adresse`, `ville`, `cp` suffisent.
    Les 40+ autres champs ont des defaults ou sont Optional (politique
    "backend permissif, UX discipline" — le wizard frontend impose les
    12 champs Niveau 1, pas le schema).
    """

    # ── Localisation (obligatoire à la création) ──────────────────────────────
    adresse: str = Field(min_length=1, max_length=300)
    ville: str = Field(min_length=1, max_length=100)
    cp: str = Field(min_length=4, max_length=10)  # pas de regex : multi-pays futur
    canton: Optional[str] = Field(default=None, max_length=2)  # auto-rempli si cp connu

    # ── Identité ──────────────────────────────────────────────────────────────
    building_name: Optional[str] = Field(default=None, max_length=200)
    unit_number: Optional[str] = Field(default=None, max_length=20)
    reference_number: Optional[str] = Field(default=None, max_length=50)

    # ── Type et statut ────────────────────────────────────────────────────────
    type: BienTypeLiteral = "appartement"
    statut: BienStatutLiteral = "vacant"

    # ── Caractéristiques ──────────────────────────────────────────────────────
    surface: Optional[float] = Field(default=None, ge=0)
    etage: Optional[int] = None  # peut être négatif (sous-sol)
    rooms: Optional[float] = Field(
        default=None, ge=0, description="Peut être 3.5 (pièce 1/2 CH)"
    )
    bedrooms: Optional[int] = Field(default=None, ge=0)
    bathrooms: Optional[int] = Field(default=None, ge=0)
    annee_construction: Optional[int] = Field(default=None, ge=1000, le=2100)
    annee_renovation: Optional[int] = Field(default=None, ge=1000, le=2100)

    # ── Équipements booléens ──────────────────────────────────────────────────
    is_furnished: bool = False
    has_balcony: bool = False
    has_terrace: bool = False
    has_garden: bool = False
    has_storage: bool = False
    has_fireplace: bool = False
    has_laundry_private: bool = False
    has_laundry_building: bool = False
    classe_energetique: Optional[str] = Field(default=None, pattern=r"^[A-G]$")

    # ── Parking ───────────────────────────────────────────────────────────────
    parking_type: Optional[ParkingTypeLiteral] = None

    # ── Règles ────────────────────────────────────────────────────────────────
    pets_allowed: bool = False
    smoking_allowed: bool = False

    # ── Situation et transports ───────────────────────────────────────────────
    distance_gare_minutes: Optional[int] = Field(default=None, ge=0)
    distance_arret_bus_minutes: Optional[int] = Field(default=None, ge=0)
    distance_telecabine_minutes: Optional[int] = Field(default=None, ge=0)
    distance_lac_minutes: Optional[int] = Field(default=None, ge=0)
    distance_aeroport_minutes: Optional[int] = Field(default=None, ge=0)
    situation_notes: Optional[str] = Field(default=None, max_length=5000)

    # ── Présentation ──────────────────────────────────────────────────────────
    description_lieu: Optional[str] = Field(default=None, max_length=5000)
    description_logement: Optional[str] = Field(default=None, max_length=5000)
    remarques: Optional[str] = Field(default=None, max_length=5000)

    # ── Finances ──────────────────────────────────────────────────────────────
    loyer: Optional[Decimal] = Field(default=None, ge=0)
    charges: Optional[Decimal] = Field(default=None, ge=0)
    deposit: Optional[Decimal] = Field(default=None, ge=0)

    # ── Opérationnel ──────────────────────────────────────────────────────────
    keys_count: Optional[int] = Field(default=3, ge=0)

    # ── Coordonnées ───────────────────────────────────────────────────────────
    lat: Optional[float] = None
    lng: Optional[float] = None


class BienCreate(BienBase):
    """Payload création — les champs obligatoires sont ceux de BienBase."""

    pass


class BienUpdate(BaseModel):
    """PATCH partiel — tous les champs optionnels, contraintes héritées de BienBase."""

    # ── Localisation ──────────────────────────────────────────────────────────
    adresse: Optional[str] = Field(default=None, min_length=1, max_length=300)
    ville: Optional[str] = Field(default=None, min_length=1, max_length=100)
    cp: Optional[str] = Field(default=None, min_length=4, max_length=10)
    canton: Optional[str] = Field(default=None, max_length=2)

    # ── Identité ──────────────────────────────────────────────────────────────
    building_name: Optional[str] = Field(default=None, max_length=200)
    unit_number: Optional[str] = Field(default=None, max_length=20)
    reference_number: Optional[str] = Field(default=None, max_length=50)

    # ── Type et statut ────────────────────────────────────────────────────────
    type: Optional[BienTypeLiteral] = None
    statut: Optional[BienStatutLiteral] = None

    # ── Caractéristiques ──────────────────────────────────────────────────────
    surface: Optional[float] = Field(default=None, ge=0)
    etage: Optional[int] = None
    rooms: Optional[float] = Field(default=None, ge=0)
    bedrooms: Optional[int] = Field(default=None, ge=0)
    bathrooms: Optional[int] = Field(default=None, ge=0)
    annee_construction: Optional[int] = Field(default=None, ge=1000, le=2100)
    annee_renovation: Optional[int] = Field(default=None, ge=1000, le=2100)

    # ── Équipements ───────────────────────────────────────────────────────────
    is_furnished: Optional[bool] = None
    has_balcony: Optional[bool] = None
    has_terrace: Optional[bool] = None
    has_garden: Optional[bool] = None
    has_storage: Optional[bool] = None
    has_fireplace: Optional[bool] = None
    has_laundry_private: Optional[bool] = None
    has_laundry_building: Optional[bool] = None
    classe_energetique: Optional[str] = Field(default=None, pattern=r"^[A-G]$")

    # ── Parking ───────────────────────────────────────────────────────────────
    parking_type: Optional[ParkingTypeLiteral] = None

    # ── Règles ────────────────────────────────────────────────────────────────
    pets_allowed: Optional[bool] = None
    smoking_allowed: Optional[bool] = None

    # ── Situation et transports ───────────────────────────────────────────────
    distance_gare_minutes: Optional[int] = Field(default=None, ge=0)
    distance_arret_bus_minutes: Optional[int] = Field(default=None, ge=0)
    distance_telecabine_minutes: Optional[int] = Field(default=None, ge=0)
    distance_lac_minutes: Optional[int] = Field(default=None, ge=0)
    distance_aeroport_minutes: Optional[int] = Field(default=None, ge=0)
    situation_notes: Optional[str] = Field(default=None, max_length=5000)

    # ── Présentation ──────────────────────────────────────────────────────────
    description_lieu: Optional[str] = Field(default=None, max_length=5000)
    description_logement: Optional[str] = Field(default=None, max_length=5000)
    remarques: Optional[str] = Field(default=None, max_length=5000)

    # ── Finances ──────────────────────────────────────────────────────────────
    loyer: Optional[Decimal] = Field(default=None, ge=0)
    charges: Optional[Decimal] = Field(default=None, ge=0)
    deposit: Optional[Decimal] = Field(default=None, ge=0)
    keys_count: Optional[int] = Field(default=None, ge=0)

    # ── Coordonnées ───────────────────────────────────────────────────────────
    lat: Optional[float] = None
    lng: Optional[float] = None


class BienRead(BienBase):
    """Lecture d'un bien, avec champs systèmes."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    agency_id: Optional[uuid.UUID] = None
    created_by_id: uuid.UUID  # NOT NULL cohérent avec migration 0029 + modèle
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

    model_config = ConfigDict(from_attributes=True)

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


# ══════════════════════════════════════════════════════════════════════════════
# Generate description IA
# ══════════════════════════════════════════════════════════════════════════════


class GenerateDescriptionResponse(BaseModel):
    """Réponse de l'endpoint IA de génération de description."""

    description: str


# ══════════════════════════════════════════════════════════════════════════════
# Potentiel IA (analyse 7 blocs pour la fiche bien)
# ══════════════════════════════════════════════════════════════════════════════


class PotentielIAResponse(BaseModel):
    """7 blocs d'analyse IA pour un bien.

    Bloc 1–4 : calculs financiers (valeurs, rendements, marché).
    Bloc 5–7 : sortie Claude (recommandations, fiscal, prochaine action).
    """

    valeur_min: float
    valeur_max: float
    rendement_brut: float
    rendement_net: float
    loyer_actuel: float
    loyer_marche: float
    ecart_marche_pct: float
    score_investissement: float
    recommandations: list[str]
    conseil_fiscal: str
    prochaine_action: str
