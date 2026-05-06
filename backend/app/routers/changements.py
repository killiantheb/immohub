"""Router FastAPI — /api/v1/biens/{bien_id}/changement et /api/v1/changements/{id}.

Gestion du cycle complet de changement de locataire :
  Phase 1 – Départ annoncé   (depart_annonce)
  Phase 2 – Recherche        (recherche)
  Phase 3 – Check-out / EDL  (checkout)
  Phase 4 – Check-in         (checkin)

Deux APIRouter distincts dans ce module :
  - `router`             monté à `/api/v1/biens` → routes nestées par bien_id.
  - `edl_photos_router`  monté à `/api/v1/changements` → photos EDL adressées
    par changement_id (le bien_id est résolu côté serveur via jointure).
"""

from __future__ import annotations

import mimetypes
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.changement_locataire import EdlPiece
from app.services.bien_service import (
    ALLOWED_IMAGE_TYPES,
    MAX_FILE_SIZE,
    _delete_from_storage,
    _upload_to_storage,
    create_signed_url,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
edl_photos_router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

# ── Helpers ───────────────────────────────────────────────────────────────────

PHASES_ORDRE = ["depart_annonce", "recherche", "checkout", "checkin", "termine"]


async def _get_bien_owner(bien_id: str, user: User, db: AsyncSession) -> None:
    """Vérifie que l'utilisateur est propriétaire du bien."""
    row = await db.execute(
        text("SELECT owner_id FROM biens WHERE id = :id"),
        {"id": bien_id},
    )
    bien = row.fetchone()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    if user.role not in ("admin", "super_admin") and str(bien.owner_id) != str(user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")


async def _get_changement(changement_id: str, bien_id: str, db: AsyncSession) -> dict:
    row = await db.execute(
        text("""
            SELECT id, bien_id, phase, statut, date_depart_prevu,
                   checklist_depart, annonce_publiee, date_checkout,
                   edl_sortie, caution_retenue, caution_motif,
                   date_checkin, edl_entree, nouveau_locataire_id,
                   bail_signe, premier_loyer_envoye, created_at, updated_at
            FROM changements_locataire
            WHERE id = :id AND bien_id = :bien_id
        """),
        {"id": changement_id, "bien_id": bien_id},
    )
    ch = row.fetchone()
    if not ch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Changement introuvable")
    return dict(ch._mapping)


# ── Schémas ───────────────────────────────────────────────────────────────────

class ChangementCreer(BaseModel):
    date_depart_prevu: date | None = None   # ISO date YYYY-MM-DD


class EdlUpdate(BaseModel):
    type: str                               # "sortie" | "entree"
    pieces: list[EdlPiece]                  # validé via schemas/changement_locataire.py
    inventaire: dict[str, Any] | None = None
    caution_retenue: float | None = None
    caution_motif: str | None = None


class FinaliserDepart(BaseModel):
    date_checkout: date | None = None       # ISO date


class FinaliserEntree(BaseModel):
    date_checkin: date | None = None        # ISO date
    nouveau_locataire_id: str | None = None
    bail_signe: bool = False
    premier_loyer_envoye: bool = False


class ChecklistUpdate(BaseModel):
    checklist: list[dict[str, Any]]         # [{ id, label, done }]


# ── GET actif ─────────────────────────────────────────────────────────────────

@router.get("/{bien_id}/changement/actif")
async def get_changement_actif(bien_id: str, user: AuthDep, db: DbDep):
    """Retourne le changement en cours pour ce bien, ou null."""
    await _get_bien_owner(bien_id, user, db)
    row = await db.execute(
        text("""
            SELECT id, bien_id, phase, statut, date_depart_prevu,
                   checklist_depart, annonce_publiee, date_checkout,
                   edl_sortie, caution_retenue, caution_motif,
                   date_checkin, edl_entree, nouveau_locataire_id,
                   bail_signe, premier_loyer_envoye, created_at, updated_at
            FROM changements_locataire
            WHERE bien_id = :bien_id AND statut = 'en_cours'
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"bien_id": bien_id},
    )
    ch = row.fetchone()
    if not ch:
        return None
    return dict(ch._mapping)


# ── POST creer ────────────────────────────────────────────────────────────────

@router.post("/{bien_id}/changement/creer", status_code=status.HTTP_201_CREATED)
async def creer_changement(
    bien_id: str,
    payload: ChangementCreer,
    user: AuthDep,
    db: DbDep,
):
    """Démarre un nouveau cycle de changement de locataire (Phase 1)."""
    await _get_bien_owner(bien_id, user, db)

    # Vérifier qu'il n'y a pas déjà un changement en cours
    existing = await db.execute(
        text("SELECT id FROM changements_locataire WHERE bien_id = :bid AND statut = 'en_cours'"),
        {"bid": bien_id},
    )
    if existing.fetchone():
        raise HTTPException(status.HTTP_409_CONFLICT, "Un changement est déjà en cours pour ce bien")

    checklist_defaut = [
        {"id": "notif_3mois",    "label": "Notifier le locataire (3 mois avant)",   "done": False},
        {"id": "notif_1mois",    "label": "Confirmer la date de départ (1 mois)",    "done": False},
        {"id": "etat_lieux",     "label": "Planifier l'état des lieux de sortie",    "done": False},
        {"id": "cle_retour",     "label": "Prévoir la remise des clés",              "done": False},
        {"id": "annonce_draft",  "label": "Préparer l'annonce pour le nouveau loc.", "done": False},
    ]

    import json as _json
    new_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO changements_locataire
                (id, bien_id, phase, statut, date_depart_prevu, checklist_depart)
            VALUES
                (:id, :bien_id, 'depart_annonce', 'en_cours', :date_depart, CAST(:checklist AS jsonb))
        """),
        {
            "id": new_id,
            "bien_id": bien_id,
            "date_depart": payload.date_depart_prevu,
            "checklist": _json.dumps(checklist_defaut),
        },
    )
    await db.commit()
    return await _get_changement(new_id, bien_id, db)


# ── PUT checklist ─────────────────────────────────────────────────────────────

@router.put("/{bien_id}/changement/{changement_id}/checklist")
async def update_checklist(
    bien_id: str,
    changement_id: str,
    payload: ChecklistUpdate,
    user: AuthDep,
    db: DbDep,
):
    """Met à jour la checklist de départ."""
    await _get_bien_owner(bien_id, user, db)
    ch = await _get_changement(changement_id, bien_id, db)
    if ch["statut"] != "en_cours":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Changement déjà terminé")

    import json
    await db.execute(
        text("UPDATE changements_locataire SET checklist_depart = CAST(:cl AS jsonb) WHERE id = :id"),
        {"cl": json.dumps(payload.checklist), "id": changement_id},
    )
    await db.commit()
    return await _get_changement(changement_id, bien_id, db)


# ── POST passer-recherche ─────────────────────────────────────────────────────

@router.post("/{bien_id}/changement/{changement_id}/passer-recherche")
async def passer_recherche(
    bien_id: str,
    changement_id: str,
    user: AuthDep,
    db: DbDep,
):
    """Passe en Phase 2 — Recherche locataire."""
    await _get_bien_owner(bien_id, user, db)
    ch = await _get_changement(changement_id, bien_id, db)
    if ch["phase"] != "depart_annonce":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phase invalide pour cette transition")

    await db.execute(
        text("UPDATE changements_locataire SET phase = 'recherche', annonce_publiee = true WHERE id = :id"),
        {"id": changement_id},
    )
    await db.commit()
    return await _get_changement(changement_id, bien_id, db)


# ── PUT edl ───────────────────────────────────────────────────────────────────

@router.put("/{bien_id}/changement/{changement_id}/edl")
async def update_edl(
    bien_id: str,
    changement_id: str,
    payload: EdlUpdate,
    user: AuthDep,
    db: DbDep,
):
    """Sauvegarde l'EDL de sortie ou d'entrée."""
    await _get_bien_owner(bien_id, user, db)
    ch = await _get_changement(changement_id, bien_id, db)
    if ch["statut"] != "en_cours":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Changement déjà terminé")

    import json
    edl_data = json.dumps({
        "pieces": [p.model_dump() for p in payload.pieces],
        "inventaire": payload.inventaire or {},
    })

    if payload.type == "sortie":
        await db.execute(
            text("""
                UPDATE changements_locataire
                SET edl_sortie = CAST(:edl AS jsonb),
                    caution_retenue = :caution,
                    caution_motif = :motif,
                    phase = CASE WHEN phase = 'recherche' THEN 'checkout' ELSE phase END
                WHERE id = :id
            """),
            {
                "edl": edl_data,
                "caution": payload.caution_retenue,
                "motif": payload.caution_motif,
                "id": changement_id,
            },
        )
    elif payload.type == "entree":
        await db.execute(
            text("""
                UPDATE changements_locataire
                SET edl_entree = CAST(:edl AS jsonb),
                    phase = CASE WHEN phase = 'checkout' THEN 'checkin' ELSE phase END
                WHERE id = :id
            """),
            {"edl": edl_data, "id": changement_id},
        )
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "type doit être 'sortie' ou 'entree'")

    await db.commit()
    return await _get_changement(changement_id, bien_id, db)


# ── POST finaliser-depart ─────────────────────────────────────────────────────

@router.post("/{bien_id}/changement/{changement_id}/finaliser-depart")
async def finaliser_depart(
    bien_id: str,
    changement_id: str,
    payload: FinaliserDepart,
    user: AuthDep,
    db: DbDep,
):
    """Valide le check-out — passe en phase checkout."""
    await _get_bien_owner(bien_id, user, db)
    ch = await _get_changement(changement_id, bien_id, db)
    if ch["statut"] != "en_cours":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Changement déjà terminé")

    await db.execute(
        text("""
            UPDATE changements_locataire
            SET phase = 'checkout', date_checkout = :date
            WHERE id = :id
        """),
        {"date": payload.date_checkout, "id": changement_id},
    )
    await db.commit()
    return await _get_changement(changement_id, bien_id, db)


# ── POST finaliser-entree ─────────────────────────────────────────────────────

@router.post("/{bien_id}/changement/{changement_id}/finaliser-entree")
async def finaliser_entree(
    bien_id: str,
    changement_id: str,
    payload: FinaliserEntree,
    user: AuthDep,
    db: DbDep,
):
    """Valide le check-in — termine le cycle."""
    await _get_bien_owner(bien_id, user, db)
    ch = await _get_changement(changement_id, bien_id, db)
    if ch["statut"] != "en_cours":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Changement déjà terminé")

    await db.execute(
        text("""
            UPDATE changements_locataire
            SET phase = 'termine',
                statut = 'termine',
                date_checkin = :date,
                nouveau_locataire_id = :loc_id,
                bail_signe = :bail,
                premier_loyer_envoye = :loyer
            WHERE id = :id
        """),
        {
            "date": payload.date_checkin,
            "loc_id": payload.nouveau_locataire_id,
            "bail": payload.bail_signe,
            "loyer": payload.premier_loyer_envoye,
            "id": changement_id,
        },
    )
    await db.commit()
    return await _get_changement(changement_id, bien_id, db)


# ════════════════════════════════════════════════════════════════════════════
# EDL Photos — bucket privé `edl-photos`, signed URLs
# ════════════════════════════════════════════════════════════════════════════
#
# Routes adressées par changement_id (pas par bien_id) → router séparé monté
# sur /api/v1/changements/. Le bien_id est résolu côté serveur via jointure
# pour vérifier l'ownership.
#
# Path Storage : {changement_id}/{edl_type}/piece_{piece_idx}/{uuid}.jpg
# Le path retourné par POST est exactement celui à persister dans le JSONB
# `edl_sortie.pieces[i].photos[]` (et passé tel quel à DELETE).

EDL_TYPES = {"entree", "sortie"}


class DeleteEdlPhotoBody(BaseModel):
    path: str


class UploadEdlPhotoResponse(BaseModel):
    url: str   # signed URL TTL 1h, à utiliser pour <img src="..." />
    path: str  # path relatif dans le bucket — à persister dans le JSONB


# TTL aligné sur create_signed_url (1 h) — exposé en constante pour que
# l'`expires_at` retourné côté GET /sign reste cohérent avec la signature
# effective côté Supabase.
_SIGNED_URL_TTL_SECONDS = 3600


class SignEdlPhotoResponse(BaseModel):
    url: str
    expires_at: str  # ISO 8601 UTC — now + 1 h


async def _get_changement_for_user(
    changement_id: str, user: User, db: AsyncSession
) -> dict:
    """Charge un changement et vérifie l'ownership du bien rattaché.

    Lève 404 si le changement n'existe pas, 403 si l'utilisateur n'est pas
    propriétaire du bien (ni super_admin).
    """
    row = await db.execute(
        text("""
            SELECT cl.id, cl.bien_id, b.owner_id
            FROM changements_locataire cl
            JOIN biens b ON b.id = cl.bien_id
            WHERE cl.id = :id
        """),
        {"id": changement_id},
    )
    ch = row.fetchone()
    if not ch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Changement introuvable")
    if user.role not in ("admin", "super_admin") and str(ch.owner_id) != str(user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    return {"id": str(ch.id), "bien_id": str(ch.bien_id)}


@edl_photos_router.post(
    "/{changement_id}/edl-photos",
    response_model=UploadEdlPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_edl_photo(
    changement_id: str,
    user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
    piece_idx: int = Form(...),
    edl_type: str = Form(...),
) -> UploadEdlPhotoResponse:
    """Upload une photo d'EDL pour une pièce donnée.

    Renvoie un `path` (à persister dans le JSONB) et une `url` signée 1h
    (à utiliser immédiatement côté UI pour afficher la miniature).
    """
    if edl_type not in EDL_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "edl_type doit être 'entree' ou 'sortie'",
        )
    if piece_idx < 0:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "piece_idx doit être >= 0",
        )

    await _get_changement_for_user(changement_id, user, db)

    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Format image non supporté : {content_type}",
        )

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "Fichier trop gros (max 10 MB)",
        )

    ext = mimetypes.guess_extension(content_type) or ".jpg"
    photo_id = uuid.uuid4()
    path = f"{changement_id}/{edl_type}/piece_{piece_idx}/{photo_id}{ext}"

    # _upload_to_storage retourne une URL publique — on l'ignore (bucket privé,
    # cette URL serait inutilisable). On signe le path à la place.
    await _upload_to_storage(
        settings.SUPABASE_BUCKET_EDL_PHOTOS, path, data, content_type
    )
    signed = await create_signed_url(settings.SUPABASE_BUCKET_EDL_PHOTOS, path)

    return UploadEdlPhotoResponse(url=signed, path=path)


@edl_photos_router.delete(
    "/{changement_id}/edl-photos",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_edl_photo(
    changement_id: str,
    payload: DeleteEdlPhotoBody,
    user: AuthDep,
    db: DbDep,
) -> None:
    """Supprime une photo EDL du bucket Supabase Storage.

    Le path doit appartenir au changement courant : on rejette toute tentative
    de suppression cross-changement (bypass RLS si signed-URL leak).
    """
    await _get_changement_for_user(changement_id, user, db)

    expected_prefix = f"{changement_id}/"
    if not payload.path.startswith(expected_prefix) or ".." in payload.path:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "path n'appartient pas à ce changement",
        )

    await _delete_from_storage(settings.SUPABASE_BUCKET_EDL_PHOTOS, payload.path)
    return None


@edl_photos_router.get(
    "/{changement_id}/edl-photos/sign",
    response_model=SignEdlPhotoResponse,
)
async def sign_edl_photo(
    changement_id: str,
    user: AuthDep,
    db: DbDep,
    path: str = Query(..., description="Path relatif stocké dans le JSONB"),
) -> SignEdlPhotoResponse:
    """Resigne une URL pour un path EDL persisté en JSONB.

    PR-EDL-1bis — résout la limitation : les paths du JSONB ne sont pas signés,
    et la signed URL renvoyée à l'upload expire après 1 h. Au reload de page,
    le frontend appelle cet endpoint pour chaque path à afficher.

    Sécurité : on rejette toute path hors prefix `{changement_id}/` ou
    contenant `..` (anti-traversal + anti-cross-changement même si la RLS
    Supabase le bloquerait déjà côté SELECT).
    """
    await _get_changement_for_user(changement_id, user, db)

    expected_prefix = f"{changement_id}/"
    if not path.startswith(expected_prefix) or ".." in path:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "path n'appartient pas à ce changement",
        )

    signed = await create_signed_url(
        settings.SUPABASE_BUCKET_EDL_PHOTOS, path, expires_in=_SIGNED_URL_TTL_SECONDS
    )
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=_SIGNED_URL_TTL_SECONDS)
    ).isoformat()

    return SignEdlPhotoResponse(url=signed, expires_at=expires_at)
