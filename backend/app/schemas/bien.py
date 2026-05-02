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

from app.common.enums import BienStatutLiteral, BienTypeLiteral


# ══════════════════════════════════════════════════════════════════════════════
# Literals
# ══════════════════════════════════════════════════════════════════════════════

# BienTypeLiteral + BienStatutLiteral : source unique dans app.common.enums
# (ré-importés ci-dessus pour rester utilisables via app.schemas.bien).

ParkingTypeLiteral = Literal[
    "exterieur", "exterieur_couvert", "interieur", "interieur_box",
]

# Estimation IA enrichie (PR-A9.1) — déclarés ici pour être résolus par
# BienBase / BienUpdate (référencés plus bas dans EstimationIAEnrichie).
ResidenceType = Literal["principale", "secondaire", "mixte"]
LocationType = Literal["annuelle", "saisonniere", "semaine"]
LocationTypeActuel = Literal["annuelle", "saisonniere", "semaine", "vide"]
TendanceMarche = Literal["hausse", "stable", "baisse"]

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

    # ── Estimation IA enrichie (PR-A9.1) ─────────────────────────────────────
    residence_type: Optional[ResidenceType] = None
    location_type_actuel: Optional[LocationTypeActuel] = None


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

    # ── Estimation IA enrichie (PR-A9.1) ─────────────────────────────────────
    residence_type: Optional[ResidenceType] = None
    location_type_actuel: Optional[LocationTypeActuel] = None


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


class BienImageUpdate(BaseModel):
    """PATCH partiel d'une image attachée à un bien.

    Champs supportés :
      - is_cover : bascule la couverture (le service force l'unicité par bien)
      - order    : repositionne une image individuellement (0-based)

    Tous les champs sont optionnels — un body vide est accepté (no-op).
    """

    is_cover: bool | None = None
    order: int | None = Field(default=None, ge=0)


class BienImagesReorderRequest(BaseModel):
    """Payload du batch reorder.

    Le tableau doit contenir TOUS les IDs d'images du bien, dans le nouvel
    ordre désiré. Le service vérifie l'égalité des ensembles
    (manquants ou inconnus → 400) et écrit `order = idx` séquentiellement.
    """

    order: list[uuid.UUID] = Field(..., min_length=1)


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


# ══════════════════════════════════════════════════════════════════════════════
# Rendement net (PR-B sprint 12)
# ══════════════════════════════════════════════════════════════════════════════


RendementDeductionType = Literal[
    "interventions",
    "commission_althy",   # Phase 2
    "commission_agence",  # Phase 2
    "charges_proprio",    # Phase 2
]


class RendementDeduction(BaseModel):
    """Une ligne de déduction du rendement net.

    Phase 1 : seul `type='interventions'` est utilisé.
    Phase 2-3 : ajout commission Althy 3 %, commission agence,
    charges proprio. Le type Literal sert d'enum extensible —
    aucune rupture API quand on ajoute une valeur.
    """

    type: RendementDeductionType
    montant: Decimal = Field(..., ge=0, description="Montant en CHF")
    label: str = Field(..., max_length=200)


class RendementNetResponse(BaseModel):
    """Réponse de GET /biens/{id}/rendement-net.

    Schéma extensible : Phase 2-3 ajoutera des entrées dans `deductions`
    sans changer la structure (ni casser les clients Phase 1).
    """

    annee: int = Field(..., ge=2020, le=2100)
    loyer_brut_annuel: Decimal = Field(..., ge=0)
    deductions: list[RendementDeduction] = Field(default_factory=list)
    rendement_net_chf: Decimal = Field(..., ge=0)
    rendement_net_pct: Decimal = Field(..., ge=0, le=100)


# ══════════════════════════════════════════════════════════════════════════════
# Estimation IA enrichie v2 (PR-A9.1 sprint 12)
# Refonte de l'ancien PotentielIAResponse — endpoint parallèle /potentiel-v2.
# Ancien endpoint /potentiel conservé (Phase 1) pour rétro-compat.
# ══════════════════════════════════════════════════════════════════════════════


class EstimationLocalite(BaseModel):
    """Analyse du marché local (canton / ville / quartier)."""

    canton: str = Field(..., max_length=2)
    ville: str = Field(..., max_length=100)
    quartier: Optional[str] = Field(default=None, max_length=120)
    prix_moyen_m2_vente_chf: Decimal = Field(..., ge=0)
    prix_moyen_m2_loyer_an_chf: Decimal = Field(..., ge=0)
    tendance_12_mois: TendanceMarche
    delai_vente_moyen_jours: int = Field(..., ge=0)
    note_attractivite: int = Field(..., ge=1, le=10)
    notes_locales: str = Field(..., max_length=2000)


class EstimationLocation(BaseModel):
    """Revenus estimés selon un type de location (annuelle/saisonnière/semaine)."""

    type: LocationType
    revenu_brut_an_chf_min: Decimal = Field(..., ge=0)
    revenu_brut_an_chf_max: Decimal = Field(..., ge=0)
    taux_occupation_estime_pct: Decimal = Field(..., ge=0, le=100)
    rendement_brut_pct: Decimal = Field(..., ge=0)
    rendement_net_estime_pct: Decimal = Field(..., ge=0)
    contraintes: list[str] = Field(default_factory=list)
    avantages: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(
        default_factory=list,
        description="Avertissements légaux (LRA Valais, Lex Weber, permis communal).",
    )
    recommandation: str = Field(..., max_length=2000)


class EstimationFiscalite(BaseModel):
    """Optimisation fiscale CH selon résidence + canton."""

    impot_revenu_locatif_estime_chf_an: Decimal = Field(..., ge=0)
    deductions_possibles: list[str] = Field(default_factory=list)
    valeur_locative_estimee_chf: Optional[Decimal] = Field(default=None, ge=0)
    conseil_fiscal_principal: str = Field(..., max_length=2000)


class EstimationIAEnrichie(BaseModel):
    """Réponse complète de l'estimation IA enrichie (PR-A9.1).

    Schéma extensible : Phase 2 ajoutera notamment des sources marché
    réelles (Comparis / Homegate Open Data) sans rupture API.
    """

    # ── Métadonnées ──────────────────────────────────────────────────────────
    bien_id: uuid.UUID
    generated_at: datetime
    model_used: str = Field(..., max_length=80)
    confidence_score: Decimal = Field(..., ge=0, le=10)
    disclaimer: str = Field(
        default=(
            "Estimation IA indicative. Vérifier auprès d'un expert agréé "
            "avant toute décision financière. Ne constitue pas une expertise "
            "formelle au sens de la LSFin."
        ),
        max_length=500,
    )

    # ── Configuration analysée ───────────────────────────────────────────────
    meuble: bool
    residence_type: ResidenceType
    location_type_actuel: Optional[LocationTypeActuel] = None

    # ── 1. Estimation valeur ─────────────────────────────────────────────────
    valeur_estimee_chf_min: Decimal = Field(..., ge=0)
    valeur_estimee_chf_max: Decimal = Field(..., ge=0)
    valeur_par_m2_estimee_chf: Decimal = Field(..., ge=0)

    # ── 2. Localité ──────────────────────────────────────────────────────────
    localite: EstimationLocalite

    # ── 3. Locations (3 scénarios) ───────────────────────────────────────────
    location_annuelle: EstimationLocation
    location_saisonniere: EstimationLocation
    location_semaine: EstimationLocation
    location_recommandee: LocationType
    raison_recommandation: str = Field(..., max_length=2000)

    # ── 4. Fiscalité ─────────────────────────────────────────────────────────
    fiscalite: EstimationFiscalite

    # ── 5. Recommandations ───────────────────────────────────────────────────
    points_forts: list[str] = Field(default_factory=list)
    points_amelioration: list[str] = Field(default_factory=list)
    actions_recommandees: list[str] = Field(default_factory=list)
    prochaine_action_prioritaire: str = Field(..., max_length=500)

    # ── 6. Scores ────────────────────────────────────────────────────────────
    score_investissement: int = Field(..., ge=0, le=10)
    score_locatif: int = Field(..., ge=0, le=10)
    score_revente: int = Field(..., ge=0, le=10)
