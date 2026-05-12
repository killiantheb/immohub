"""Schémas Pydantic v2 — documents_dossier + extension DossierLocataire (P1.0).

Référence : docs/4-PRODUIT.md §4.7 (espace locataire), migration 0041,
models/document_dossier.py (constantes métier).

Types de documents (8) :
  piece_identite | permis_sejour | contrat_travail | fiches_salaire |
  assurance_rc  | caution       | extrait_poursuites | bail_signe

Statuts (3) : uploaded | valide | rejete (§B.10 — pas de faux statut).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Types Literal (source unique côté Pydantic — doivent matcher
# models/document_dossier.py:TYPE_DOCUMENT_POIDS keys).
TypeDocument = Literal[
    "piece_identite",
    "permis_sejour",
    "contrat_travail",
    "fiches_salaire",
    "assurance_rc",
    "caution",
    "extrait_poursuites",
    "bail_signe",
]
StatutDocument = Literal["uploaded", "valide", "rejete"]


# ── User mini (pour relations sender/valide_par) ──────────────────────────────


class DocumentDossierUserMini(BaseModel):
    """Sous-set minimal de UserProfile retourné dans les relations."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None


# ── DocumentDossier ───────────────────────────────────────────────────────────


class DocumentDossierBase(BaseModel):
    """Champs partagés Create/Read."""

    type_document: TypeDocument
    est_equivalent: bool = False
    equivalent_libelle: str | None = Field(None, max_length=200)


class DocumentDossierRead(DocumentDossierBase):
    """Réponse API — un document avec ses relations légères."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    locataire_id: uuid.UUID
    storage_key: str
    filename_original: str
    mime_type: str
    size_bytes: int
    statut: StatutDocument
    poids_progression: int
    commentaire_rejet: str | None = None
    uploaded_by_user_id: uuid.UUID
    uploaded_by: DocumentDossierUserMini | None = None
    valide_par_user_id: uuid.UUID | None = None
    valide_par: DocumentDossierUserMini | None = None
    valide_at: datetime | None = None
    ai_score_at: datetime | None = None
    ai_recommendation: Literal["approve", "review", "reject"] | None = None
    ai_details: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime | None = None


class RejectDocumentRequest(BaseModel):
    """Body PATCH /dossier/documents/{id}/rejeter — commentaire OBLIGATOIRE."""

    commentaire_rejet: str = Field(..., min_length=5, max_length=2000)

    @field_validator("commentaire_rejet")
    @classmethod
    def _trim_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 5:
            raise ValueError(
                "Le commentaire de rejet doit faire au moins 5 caractères significatifs"
            )
        return trimmed


# ── Renseignements (étape 1 dossiers_locataires) ──────────────────────────────


class RenseignementsUpdate(BaseModel):
    """Body PATCH /locataires/{id}/dossier/renseignements.

    Le locataire saisit son emploi + assurance + poursuites. Le passage à
    `renseignements_complets = TRUE` est automatique côté backend dès qu'au
    moins (employeur, type_contrat, salaire_net) sont remplis (heuristique
    Phase 1.0 — règle exacte à confirmer Killian).
    """

    # Emploi
    employeur: str | None = Field(None, max_length=200)
    poste: str | None = Field(None, max_length=200)
    type_contrat: Literal["cdi", "cdd", "independant", "retraite", "autre"] | None = None
    salaire_net: Decimal | None = Field(None, ge=0)
    anciennete: int | None = Field(None, ge=0, description="mois")
    # Assurance RC
    assureur_rc: str | None = Field(None, max_length=200)
    numero_police: str | None = Field(None, max_length=100)
    validite_assurance: date | None = None
    # Poursuites
    resultat_poursuites: str | None = Field(None, max_length=100)
    date_poursuites: date | None = None
    office_poursuites: str | None = Field(None, max_length=200)


class LoyerCautionVersesRequest(BaseModel):
    """Body PATCH /locataires/{id}/dossier/loyer-caution-verses (bailleur).

    Body optionnel — peut être vide. Si `loyer_montant` / `caution_montant`
    fournis, ils sont uniquement informatifs (pas persistés dans cette table —
    le montant officiel reste sur `locataires.loyer` / `locataires.depot_garantie`).
    """

    loyer_montant: Decimal | None = Field(None, ge=0)
    caution_montant: Decimal | None = Field(None, ge=0)


class DossierMetaRead(BaseModel):
    """Sous-set des champs dossiers_locataires utiles pour la progression."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    locataire_id: uuid.UUID
    # Emploi + Assurance + Poursuites (lecture seule via cet endpoint)
    employeur: str | None = None
    poste: str | None = None
    type_contrat: str | None = None
    salaire_net: Decimal | None = None
    anciennete: int | None = None
    assureur_rc: str | None = None
    numero_police: str | None = None
    validite_assurance: date | None = None
    resultat_poursuites: str | None = None
    date_poursuites: date | None = None
    office_poursuites: str | None = None
    # Étapes Phase 1.0
    renseignements_complets: bool
    renseignements_completed_at: datetime | None = None
    loyer_caution_verses: bool
    loyer_caution_verses_at: datetime | None = None
    loyer_caution_verses_by: uuid.UUID | None = None
    created_at: datetime


# ── Progression dossier (réponse GET /locataires/{id}/dossier/documents) ──────


class TypeBreakdown(BaseModel):
    """Détail par type_document : poids + count par statut."""

    poids: int
    poids_max: int
    poids_acquis: int
    count_uploaded: int
    count_valide: int
    count_rejete: int
    max_fichiers: int  # 1 ou 3 (fiches_salaire)


class DossierProgressionResponse(BaseModel):
    """Réponse globale : progression + documents + métadonnées + breakdown."""

    progression: int = Field(..., ge=0, le=100)
    renseignements_complets: bool
    loyer_caution_verses: bool
    dossier: DossierMetaRead | None = None
    documents: list[DocumentDossierRead]
    breakdown: dict[str, TypeBreakdown]


# ── Réponses utilitaires ──────────────────────────────────────────────────────


class SignedUrlResponse(BaseModel):
    """Réponse GET /dossier/documents/{id}/url."""

    url: str
    expires_at: datetime
