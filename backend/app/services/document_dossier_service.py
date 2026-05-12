"""Service métier — Module Dossier Locataire Phase 1.0.

Responsabilités :
  - RBAC : qui peut lire/écrire/valider quel dossier
  - Upload Supabase Storage (bucket privé `dossiers-locataires`)
  - URL signée à la demande (1h par défaut)
  - Suppression Supabase + DB symétrique
  - Calcul de progression 0-100 (à la volée, non persisté)

Pattern d'upload : Frontend → Backend (multipart) → Supabase via service_key.
Bucket privé, URLs jamais publiques (cf 4-PRODUIT.md §4.7 — données sensibles
locataire).

Décisions :
  - Path Supabase : `{locataire_id}/{type_document}/{document_id}.{ext}`
    → permet la liste par locataire ou par type via prefix navigation Supabase
  - Pas de helper partagé extrait de bien_service.py : duplication minime et
    locale pour éviter un refacto global (Sprint Hardening Auth Phase 2).
"""

from __future__ import annotations

import mimetypes
import uuid
from datetime import UTC, datetime, timedelta
from typing import Final

import httpx
from app.core.config import settings
from app.models.bien import Bien
from app.models.document_dossier import (
    ALLOWED_MIME_TYPES,
    MAX_SIZE_BYTES,
    POIDS_LOYER_CAUTION_VERSES,
    POIDS_RENSEIGNEMENTS,
    TYPE_DOCUMENT_POIDS,
    TYPES_AVEC_EQUIVALENT,
    TYPES_BAILLEUR,
    TYPES_LOCATAIRE,
    TYPES_MULTI_FICHIERS,
    DocumentDossier,
)
from app.models.locataire import DossierLocataire, Locataire
from app.models.user import User
from app.schemas.document_dossier import (
    DocumentDossierRead,
    DocumentDossierUserMini,
    DossierMetaRead,
    DossierProgressionResponse,
    TypeBreakdown,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

_BUCKET: Final[str] = "dossiers-locataires"
_STORAGE_HEADERS: Final[dict[str, str]] = {
    "apikey": settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
}
_TIMEOUT: Final[int] = 30


def _storage_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{_BUCKET}/{path}"


def _sign_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/sign/{_BUCKET}/{path}"


# ── RBAC helpers ──────────────────────────────────────────────────────────────


async def resolve_dossier_parties(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    current_user: User,
) -> tuple[Locataire, Bien, bool, bool, bool]:
    """Vérifie l'accès au dossier et retourne (locataire, bien, is_locataire,
    is_bailleur, is_super_admin).

    Règles :
      - super_admin → accès complet
      - locataire (Locataire.user_id == current_user.id) → SON dossier
      - bailleur (Bien.owner_id == current_user.id) → dossier des locataires
        de SES biens

    Levée 404 si locataire introuvable, 403 sinon.
    """
    row = await db.execute(
        select(Locataire, Bien)
        .join(Bien, Bien.id == Locataire.bien_id)
        .where(Locataire.id == locataire_id)
    )
    pair = row.one_or_none()
    if pair is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locataire introuvable")

    locataire, bien = pair
    is_super_admin = current_user.role == "super_admin"
    is_locataire = (
        locataire.user_id is not None and str(locataire.user_id) == str(current_user.id)
    )
    is_bailleur = str(bien.owner_id) == str(current_user.id) or (
        bien.agency_id is not None and str(bien.agency_id) == str(current_user.id)
    )

    if not (is_super_admin or is_locataire or is_bailleur):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous n'avez pas accès au dossier de ce locataire",
        )

    return locataire, bien, is_locataire, is_bailleur, is_super_admin


async def resolve_document_parties(
    db: AsyncSession,
    document_id: uuid.UUID,
    current_user: User,
) -> tuple[DocumentDossier, Locataire, Bien, bool, bool, bool]:
    """Récupère un document + valide l'accès. Retourne (doc, locataire, bien,
    is_locataire, is_bailleur, is_super_admin)."""
    row = await db.execute(
        select(DocumentDossier)
        .options(
            selectinload(DocumentDossier.uploaded_by),
            selectinload(DocumentDossier.valide_par),
        )
        .where(DocumentDossier.id == document_id)
    )
    doc = row.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")

    locataire, bien, is_locataire, is_bailleur, is_super_admin = (
        await resolve_dossier_parties(db, doc.locataire_id, current_user)
    )
    return doc, locataire, bien, is_locataire, is_bailleur, is_super_admin


def can_upload_type(
    type_document: str,
    is_locataire: bool,
    is_bailleur: bool,
    is_super_admin: bool,
) -> bool:
    """Détermine si l'utilisateur peut uploader ce type de document.

    Règles Phase 1.0 :
      - bail_signe : uploadé uniquement par bailleur (Sprint 3) ou super_admin
      - autres types : uploadés uniquement par locataire ou super_admin
    """
    if is_super_admin:
        return True
    if type_document in TYPES_BAILLEUR:
        return is_bailleur
    if type_document in TYPES_LOCATAIRE:
        return is_locataire
    return False


# ── Storage helpers ───────────────────────────────────────────────────────────


def _ext_from_mime(mime_type: str) -> str:
    """Retourne l'extension fichier à partir du mime — déterministe."""
    mapping = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
    }
    return mapping.get(mime_type, mimetypes.guess_extension(mime_type) or ".bin")


async def upload_to_storage(
    *,
    file_bytes: bytes,
    locataire_id: uuid.UUID,
    type_document: str,
    document_id: uuid.UUID,
    mime_type: str,
) -> str:
    """Upload un fichier dans le bucket `dossiers-locataires`.

    Path : `{locataire_id}/{type_document}/{document_id}.{ext}` — permet :
      - navigation par locataire (prefix) côté Supabase Studio
      - filtre par type (sub-prefix)
      - unicité garantie par UUID du doc

    Retourne le storage_key persisté en DB.
    Lève HTTPException 502 si Supabase rejette.
    """
    ext = _ext_from_mime(mime_type)
    storage_key = f"{locataire_id}/{type_document}/{document_id}{ext}"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _storage_url(storage_key),
            content=file_bytes,
            headers={**_STORAGE_HEADERS, "Content-Type": mime_type},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Échec upload Supabase Storage : {resp.text[:200]}",
        )
    return storage_key


async def get_signed_url(storage_key: str, expires_in: int = 3600) -> tuple[str, datetime]:
    """Génère une URL pré-signée pour télécharger un document.

    Retourne (url_complète, expires_at). TTL 1h par défaut.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            _sign_url(storage_key),
            headers={**_STORAGE_HEADERS, "Content-Type": "application/json"},
            json={"expiresIn": expires_in},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Échec génération URL signée : {resp.text[:200]}",
        )
    signed_path = resp.json().get("signedURL", "")
    if not signed_path:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Supabase n'a pas retourné de signedURL",
        )
    url = f"{settings.SUPABASE_URL}/storage/v1{signed_path}"
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    return url, expires_at


async def delete_from_storage(storage_key: str) -> None:
    """Supprime un fichier du bucket. Best-effort : ne lève pas si 404 Supabase."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.delete(_storage_url(storage_key), headers=_STORAGE_HEADERS)
    if resp.status_code not in (200, 204, 404):
        # 404 toléré (idempotence — fichier déjà absent)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Échec suppression Supabase Storage : {resp.text[:200]}",
        )


# ── Validation pré-upload ─────────────────────────────────────────────────────


def validate_upload_payload(
    *,
    type_document: str,
    mime_type: str,
    size_bytes: int,
    est_equivalent: bool,
    equivalent_libelle: str | None,
) -> None:
    """Lève HTTPException si le payload est invalide. À appeler AVANT upload."""
    if type_document not in TYPE_DOCUMENT_POIDS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Type de document inconnu : {type_document}",
        )
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Format non supporté : {mime_type}. Accepté : PDF, JPG, PNG.",
        )
    if size_bytes <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Fichier vide",
        )
    if size_bytes > MAX_SIZE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Fichier trop volumineux ({size_bytes} octets, max {MAX_SIZE_BYTES})",
        )
    if est_equivalent and type_document not in TYPES_AVEC_EQUIVALENT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Le type {type_document} n'accepte pas d'équivalent",
        )
    if est_equivalent and (not equivalent_libelle or len(equivalent_libelle.strip()) < 3):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Précisez la nature de l'équivalent (min 3 caractères)",
        )


async def assert_can_add_one_more(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    type_document: str,
) -> None:
    """Vérifie le quota max-fichiers pour ce type.

    - fiches_salaire : max 3 fichiers actifs (toutes statuts confondus sauf
      'rejete' qui libère le slot).
    - autres types : max 1 fichier actif (statut != 'rejete').
    """
    rows = await db.execute(
        select(DocumentDossier.statut).where(
            DocumentDossier.locataire_id == locataire_id,
            DocumentDossier.type_document == type_document,
        )
    )
    statuts = [r for r in rows.scalars()]
    actifs = sum(1 for s in statuts if s != "rejete")
    max_allowed = TYPES_MULTI_FICHIERS.get(type_document, 1)
    if actifs >= max_allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Limite atteinte pour {type_document} : {actifs}/{max_allowed} "
            f"déjà uploadé(s). Supprimez d'abord un fichier rejeté ou attendez "
            f"la décision du bailleur.",
        )


# ── Progression (calcul à la volée) ───────────────────────────────────────────


def _compute_breakdown(
    documents: list[DocumentDossier],
) -> dict[str, TypeBreakdown]:
    """Calcule le breakdown par type + poids acquis."""
    breakdown: dict[str, TypeBreakdown] = {}
    for type_doc, poids_max in TYPE_DOCUMENT_POIDS.items():
        max_fichiers = TYPES_MULTI_FICHIERS.get(type_doc, 1)
        docs_type = [d for d in documents if d.type_document == type_doc]
        count_uploaded = sum(1 for d in docs_type if d.statut == "uploaded")
        count_valide = sum(1 for d in docs_type if d.statut == "valide")
        count_rejete = sum(1 for d in docs_type if d.statut == "rejete")

        # Poids acquis : prorata pour multi-fichiers, binaire sinon.
        # Un doc compte dès qu'il est `uploaded` ou `valide` (statut `rejete`
        # ne compte pas — il libère le slot mais ne progresse pas).
        actifs = count_uploaded + count_valide
        if type_doc in TYPES_MULTI_FICHIERS:
            # Prorata : 1 fiche sur 3 = poids_max // 3, plafonné à poids_max
            poids_acquis = min(poids_max, (actifs * poids_max) // max_fichiers)
        else:
            poids_acquis = poids_max if actifs > 0 else 0

        breakdown[type_doc] = TypeBreakdown(
            poids=poids_max,
            poids_max=poids_max,
            poids_acquis=poids_acquis,
            count_uploaded=count_uploaded,
            count_valide=count_valide,
            count_rejete=count_rejete,
            max_fichiers=max_fichiers,
        )
    return breakdown


async def compute_progression(
    db: AsyncSession,
    locataire_id: uuid.UUID,
) -> DossierProgressionResponse:
    """Construit la réponse complète : progression + dossier + documents + breakdown.

    Algorithme :
      progression = 0
      if dossier.renseignements_complets:   progression += 15
      progression += sum(breakdown[type].poids_acquis)
      if dossier.loyer_caution_verses:      progression += 5
      → max 100

    Le résultat n'est PAS persisté (calculé à la volée à chaque GET).
    """
    # 1. Charger les documents avec relations user mini
    rows = await db.execute(
        select(DocumentDossier)
        .options(
            selectinload(DocumentDossier.uploaded_by),
            selectinload(DocumentDossier.valide_par),
        )
        .where(DocumentDossier.locataire_id == locataire_id)
        .order_by(DocumentDossier.created_at.desc())
    )
    documents = list(rows.scalars())

    # 2. Charger le DossierLocataire (1:1, peut ne pas exister Phase 1.0 si
    #    le bailleur n'a pas encore créé la fiche dossier)
    dossier_row = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    dossier = dossier_row.scalar_one_or_none()

    renseignements_complets = bool(dossier and dossier.renseignements_complets)
    loyer_caution_verses = bool(dossier and dossier.loyer_caution_verses)

    # 3. Calcul progression
    breakdown = _compute_breakdown(documents)
    poids_documents = sum(b.poids_acquis for b in breakdown.values())
    progression = poids_documents
    if renseignements_complets:
        progression += POIDS_RENSEIGNEMENTS
    if loyer_caution_verses:
        progression += POIDS_LOYER_CAUTION_VERSES
    progression = min(100, max(0, progression))

    # 4. Mapping Pydantic
    documents_read = [
        DocumentDossierRead.model_validate(
            {
                **d.__dict__,
                "uploaded_by": (
                    DocumentDossierUserMini.model_validate(d.uploaded_by)
                    if d.uploaded_by is not None
                    else None
                ),
                "valide_par": (
                    DocumentDossierUserMini.model_validate(d.valide_par)
                    if d.valide_par is not None
                    else None
                ),
            }
        )
        for d in documents
    ]
    dossier_read = DossierMetaRead.model_validate(dossier) if dossier else None

    return DossierProgressionResponse(
        progression=progression,
        renseignements_complets=renseignements_complets,
        loyer_caution_verses=loyer_caution_verses,
        dossier=dossier_read,
        documents=documents_read,
        breakdown=breakdown,
    )


# ── Auto-flip renseignements_complets ─────────────────────────────────────────


def renseignements_minimaux_remplis(dossier: DossierLocataire) -> bool:
    """Heuristique Phase 1.0 : renseignements considérés complets dès que
    (employeur, type_contrat, salaire_net) sont tous remplis.

    À ajuster avec Killian si insuffisant — pour l'instant on prend le
    triptyque le plus discriminant côté scoring IA Sprint 2.
    """
    return bool(
        dossier.employeur
        and dossier.type_contrat
        and dossier.salaire_net is not None
        and dossier.salaire_net > 0
    )
