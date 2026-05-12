"""Router FastAPI — Module Dossier Locataire Phase 1.0.

Endpoints :
    Liés au locataire (prefix /locataires/{locataire_id}/dossier) :
      POST   .../documents                  → upload (multipart, locataire)
      GET    .../documents                  → liste + progression
      PATCH  .../renseignements             → étape 1 (locataire)
      PATCH  .../loyer-caution-verses       → étape 10 (bailleur)

    Liés au document (prefix /dossier/documents/{doc_id}) :
      DELETE  /                              → retrait (locataire, statut=uploaded)
      GET     /url                           → URL signée 1h
      PATCH   /valider                       → validation bailleur
      PATCH   /rejeter                       → rejet bailleur (commentaire requis)

Doctrine :
  - §B.10 : statuts honnêtes. Rejet exige `commentaire_rejet` (min 5 chars,
    enforcé schema + CHECK constraint DB).
  - §B.12 : `await db.commit()` explicite après chaque mutation. Rollback
    symétrique si l'upload Supabase échoue après l'INSERT.
  - §B.15 : aucune dépendance candidatures (Phase 2 dormant).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.document_dossier import (
    TYPE_DOCUMENT_POIDS,
    DocumentDossier,
)
from app.models.locataire import DossierLocataire
from app.models.user import User
from app.schemas.document_dossier import (
    DocumentDossierRead,
    DocumentDossierUserMini,
    DossierMetaRead,
    DossierProgressionResponse,
    LoyerCautionVersesRequest,
    RejectDocumentRequest,
    RenseignementsUpdate,
    SignedUrlResponse,
)
from app.services.document_dossier_service import (
    assert_can_add_one_more,
    can_upload_type,
    compute_progression,
    delete_from_storage,
    get_signed_url,
    purge_rejected_documents,
    renseignements_minimaux_remplis,
    resolve_document_parties,
    resolve_dossier_parties,
    upload_to_storage,
    validate_upload_payload,
)
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# ── Routers (2 prefixes distincts) ────────────────────────────────────────────
# - Routes par locataire : montées sur /api/v1/locataires/{locataire_id}/dossier
# - Routes par document : montées sur /api/v1/dossier
locataire_router = APIRouter()
document_router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ── Helper rendering (uploaded_by/valide_par déjà chargés via selectinload) ───


def _to_read(doc: DocumentDossier) -> DocumentDossierRead:
    """Sérialise un DocumentDossier en DocumentDossierRead avec relations user mini."""
    return DocumentDossierRead.model_validate(
        {
            **doc.__dict__,
            "uploaded_by": (
                DocumentDossierUserMini.model_validate(doc.uploaded_by)
                if doc.uploaded_by is not None
                else None
            ),
            "valide_par": (
                DocumentDossierUserMini.model_validate(doc.valide_par)
                if doc.valide_par is not None
                else None
            ),
        }
    )


# ══════════════════════════════════════════════════════════════════════════════
# POST /locataires/{locataire_id}/dossier/documents — upload (multipart)
# ══════════════════════════════════════════════════════════════════════════════


@locataire_router.post(
    "/{locataire_id}/dossier/documents",
    response_model=DocumentDossierRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
    type_document: str = Form(...),
    est_equivalent: bool = Form(False),
    equivalent_libelle: str | None = Form(None),
) -> DocumentDossierRead:
    """Upload un document dans le dossier d'un locataire.

    RBAC :
      - locataire (Locataire.user_id == current_user) → tout sauf bail_signe
      - bailleur (Bien.owner_id == current_user)      → bail_signe uniquement
      - super_admin                                    → tout

    Validation : type, mime, size (cf service.validate_upload_payload).
    Quota : fiches_salaire max 3, autres types max 1 actif (cf
    service.assert_can_add_one_more).
    """
    # 1. RBAC
    locataire, bien, is_locataire, is_bailleur, is_super_admin = (
        await resolve_dossier_parties(db, locataire_id, current_user)
    )
    if not can_upload_type(type_document, is_locataire, is_bailleur, is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Vous n'êtes pas autorisé à uploader un document de type {type_document}",
        )

    # 2. Lecture du fichier + validation
    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    validate_upload_payload(
        type_document=type_document,
        mime_type=mime_type,
        size_bytes=len(file_bytes),
        est_equivalent=est_equivalent,
        equivalent_libelle=equivalent_libelle,
    )

    # 3. Hard-delete des anciens documents REJETÉS du même type (DB + Storage).
    #    Évite la pollution UI côté locataire (cf Sprint 1B.1 polish 2026-05-12).
    #    Best-effort sur Storage : un échec n'empêche pas le nouvel upload, on
    #    laisse les orphelins éventuels au cleanup périodique Phase 2.
    await purge_rejected_documents(db, locataire_id, type_document)

    # 4. Quota par type (les rejetés viennent d'être purgés, donc ce check
    #    travaille uniquement sur uploaded + valide).
    await assert_can_add_one_more(db, locataire_id, type_document)

    # 4. INSERT en DB d'abord pour récupérer l'UUID stable utilisé dans le path.
    #    Pas de commit avant upload Supabase — si Supabase échoue, on rollback
    #    (§B.12 : pas de row orpheline qui pointerait vers un objet absent).
    document_id = uuid.uuid4()
    poids = TYPE_DOCUMENT_POIDS[type_document]
    new_doc = DocumentDossier(
        id=document_id,
        locataire_id=locataire_id,
        type_document=type_document,
        storage_key="",  # rempli post-upload, ré-assigné avant commit
        filename_original=file.filename or "fichier",
        mime_type=mime_type,
        size_bytes=len(file_bytes),
        statut="uploaded",
        poids_progression=poids,
        est_equivalent=est_equivalent,
        equivalent_libelle=(equivalent_libelle or "").strip() or None,
        uploaded_by_user_id=current_user.id,
    )

    # 5. Upload Supabase
    try:
        storage_key = await upload_to_storage(
            file_bytes=file_bytes,
            locataire_id=locataire_id,
            type_document=type_document,
            document_id=document_id,
            mime_type=mime_type,
        )
    except HTTPException:
        # Pas de db.commit() en amont, donc rien à rollback côté SQL — on
        # propage l'erreur Supabase telle quelle.
        raise

    # 6. INSERT effectif avec storage_key résolu, commit explicite (§B.12)
    new_doc.storage_key = storage_key
    db.add(new_doc)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        # Best-effort cleanup Supabase pour ne pas laisser de fichier orphelin
        try:
            await delete_from_storage(storage_key)
        except Exception:
            pass
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur persistance document : {exc!s:.200}",
        ) from exc

    # 7. Recharge avec selectinload pour la sérialisation Pydantic (hotfix
    #    bien_messages 2026-05-12 : éviter MissingGreenlet via lazy-load).
    reloaded = await db.execute(
        select(DocumentDossier)
        .options(
            selectinload(DocumentDossier.uploaded_by),
            selectinload(DocumentDossier.valide_par),
        )
        .where(DocumentDossier.id == document_id)
    )
    reloaded_doc = reloaded.scalar_one()
    _ = locataire, bien  # vars conservées pour audit explicite (RBAC OK)
    return _to_read(reloaded_doc)


# ══════════════════════════════════════════════════════════════════════════════
# GET /locataires/{locataire_id}/dossier/documents — liste + progression
# ══════════════════════════════════════════════════════════════════════════════


@locataire_router.get(
    "/{locataire_id}/dossier/documents",
    response_model=DossierProgressionResponse,
)
async def list_documents(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> DossierProgressionResponse:
    """Liste les documents d'un dossier + retourne la progression complète."""
    await resolve_dossier_parties(db, locataire_id, current_user)
    return await compute_progression(db, locataire_id)


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /dossier/documents/{doc_id} — retrait locataire (statut=uploaded)
# ══════════════════════════════════════════════════════════════════════════════


@document_router.delete(
    "/documents/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_document(
    doc_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    """Supprime un document. Conditions :

      - statut == 'uploaded' (un doc validé ou rejeté ne peut plus être retiré
        par le locataire — il devra demander au bailleur).
      - current_user est le locataire propriétaire du dossier OU super_admin.

    Le fichier Supabase est aussi supprimé (best-effort, 404 toléré).
    """
    doc, locataire, _bien, is_locataire, _is_bailleur, is_super_admin = (
        await resolve_document_parties(db, doc_id, current_user)
    )
    if not (is_locataire or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le locataire peut retirer un document",
        )
    if doc.statut != "uploaded":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Document non supprimable (statut actuel : {doc.statut}). "
            "Demandez au bailleur de le rejeter d'abord.",
        )
    storage_key = doc.storage_key
    await db.delete(doc)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur suppression DB : {exc!s:.200}",
        ) from exc
    # DB committed : best-effort cleanup Supabase. Si ça échoue, le fichier
    # reste orphelin mais c'est juste de l'espace disque (URL inaccessible
    # car la row a disparu) — pas critique.
    try:
        await delete_from_storage(storage_key)
    except Exception:
        pass
    _ = locataire  # ok


# ══════════════════════════════════════════════════════════════════════════════
# GET /dossier/documents/{doc_id}/url — URL signée 1h
# ══════════════════════════════════════════════════════════════════════════════


@document_router.get(
    "/documents/{doc_id}/url",
    response_model=SignedUrlResponse,
)
async def get_document_url(
    doc_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> SignedUrlResponse:
    """Génère une URL pré-signée pour télécharger le document (TTL 1h).

    Accès : locataire propriétaire OU bailleur du bien OU super_admin (cf
    resolve_document_parties).
    """
    doc, _loc, _bien, _il, _ib, _isa = await resolve_document_parties(
        db, doc_id, current_user
    )
    url, expires_at = await get_signed_url(doc.storage_key, expires_in=3600)
    return SignedUrlResponse(url=url, expires_at=expires_at)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /dossier/documents/{doc_id}/valider — bailleur valide
# ══════════════════════════════════════════════════════════════════════════════


@document_router.patch(
    "/documents/{doc_id}/valider",
    response_model=DocumentDossierRead,
)
async def validate_document(
    doc_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> DocumentDossierRead:
    """Marque un document comme `valide`.

    RBAC : bailleur du bien correspondant OU super_admin.
    Statut requis : `uploaded` (refusé si déjà validé ou rejeté — §B.10
    transparence).
    """
    doc, _loc, _bien, _il, is_bailleur, is_super_admin = (
        await resolve_document_parties(db, doc_id, current_user)
    )
    if not (is_bailleur or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le bailleur peut valider un document",
        )
    if doc.statut != "uploaded":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Document déjà traité (statut : {doc.statut})",
        )

    doc.statut = "valide"
    doc.valide_par_user_id = current_user.id
    doc.valide_at = datetime.now(UTC)
    doc.commentaire_rejet = None  # nettoyage défensif
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur validation : {exc!s:.200}",
        ) from exc

    reloaded = await db.execute(
        select(DocumentDossier)
        .options(
            selectinload(DocumentDossier.uploaded_by),
            selectinload(DocumentDossier.valide_par),
        )
        .where(DocumentDossier.id == doc_id)
    )
    return _to_read(reloaded.scalar_one())


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /dossier/documents/{doc_id}/rejeter — bailleur rejette
# ══════════════════════════════════════════════════════════════════════════════


@document_router.patch(
    "/documents/{doc_id}/rejeter",
    response_model=DocumentDossierRead,
)
async def reject_document(
    doc_id: uuid.UUID,
    payload: RejectDocumentRequest,
    current_user: AuthDep,
    db: DbDep,
) -> DocumentDossierRead:
    """Marque un document comme `rejete` avec un `commentaire_rejet` obligatoire
    (min 5 chars — enforcé schema + CHECK constraint DB).

    Doctrine §B.10 : transparence locataire. Le motif est exposé tel quel côté
    UI locataire — soyez précis et factuel.
    """
    doc, _loc, _bien, _il, is_bailleur, is_super_admin = (
        await resolve_document_parties(db, doc_id, current_user)
    )
    if not (is_bailleur or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le bailleur peut rejeter un document",
        )
    if doc.statut != "uploaded":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Document déjà traité (statut : {doc.statut})",
        )

    doc.statut = "rejete"
    doc.commentaire_rejet = payload.commentaire_rejet
    doc.valide_par_user_id = current_user.id
    doc.valide_at = datetime.now(UTC)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur rejet : {exc!s:.200}",
        ) from exc

    reloaded = await db.execute(
        select(DocumentDossier)
        .options(
            selectinload(DocumentDossier.uploaded_by),
            selectinload(DocumentDossier.valide_par),
        )
        .where(DocumentDossier.id == doc_id)
    )
    return _to_read(reloaded.scalar_one())


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /locataires/{locataire_id}/dossier/renseignements — étape 1 locataire
# ══════════════════════════════════════════════════════════════════════════════


@locataire_router.patch(
    "/{locataire_id}/dossier/renseignements",
    response_model=DossierMetaRead,
)
async def update_renseignements(
    locataire_id: uuid.UUID,
    payload: RenseignementsUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> DossierMetaRead:
    """Le locataire saisit ses renseignements (étape 1 / 15% progression).

    Upsert sur `dossiers_locataires` (créé si absent). Si les champs minimaux
    (employeur + type_contrat + salaire_net) sont remplis, on bascule
    `renseignements_complets = TRUE` + horodate.
    """
    locataire, _bien, is_locataire, _is_bailleur, is_super_admin = (
        await resolve_dossier_parties(db, locataire_id, current_user)
    )
    if not (is_locataire or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le locataire peut renseigner son dossier",
        )

    # Upsert dossier
    row = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    dossier = row.scalar_one_or_none()
    if dossier is None:
        dossier = DossierLocataire(locataire_id=locataire_id)
        db.add(dossier)

    # Appliquer les champs fournis (None laisse intact)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(dossier, field, value)

    # Auto-flip si renseignements minimaux remplis et pas déjà flag-é
    if renseignements_minimaux_remplis(dossier) and not dossier.renseignements_complets:
        dossier.renseignements_complets = True
        dossier.renseignements_completed_at = datetime.now(UTC)

    try:
        await db.commit()
        await db.refresh(dossier)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur mise à jour renseignements : {exc!s:.200}",
        ) from exc

    _ = locataire
    return DossierMetaRead.model_validate(dossier)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /locataires/{locataire_id}/dossier/loyer-caution-verses — étape 10
# ══════════════════════════════════════════════════════════════════════════════


@locataire_router.patch(
    "/{locataire_id}/dossier/loyer-caution-verses",
    response_model=DossierMetaRead,
)
async def mark_loyer_caution_verses(
    locataire_id: uuid.UUID,
    payload: LoyerCautionVersesRequest,
    current_user: AuthDep,
    db: DbDep,
) -> DossierMetaRead:
    """Le bailleur confirme que le 1er loyer + la caution sont versés.

    Étape 10 / 5% progression. Idempotent : un appel sur un dossier déjà
    flag-é renvoie le même état (pas d'erreur).
    """
    _loc, _bien, _il, is_bailleur, is_super_admin = await resolve_dossier_parties(
        db, locataire_id, current_user
    )
    if not (is_bailleur or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le bailleur peut confirmer le versement loyer + caution",
        )

    # Upsert dossier
    row = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    dossier = row.scalar_one_or_none()
    if dossier is None:
        dossier = DossierLocataire(locataire_id=locataire_id)
        db.add(dossier)
        await db.flush()  # nécessaire pour l'auto-id avant les setattr

    if not dossier.loyer_caution_verses:
        dossier.loyer_caution_verses = True
        dossier.loyer_caution_verses_at = datetime.now(UTC)
        dossier.loyer_caution_verses_by = current_user.id

    try:
        await db.commit()
        await db.refresh(dossier)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur confirmation versement : {exc!s:.200}",
        ) from exc

    _ = payload  # body optionnel non persisté dans cette table (cf schema)
    return DossierMetaRead.model_validate(dossier)
