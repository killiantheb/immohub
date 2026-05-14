"""Router agences — pré-validation dossier + création magic_link approbation.

Sprint 10 Lot 5. §2.4.16 décision #3 (Interprétation A) :
  L'agence (ou super_admin Phase 1.0) pré-valide un dossier locataire 100%
  complet (renseignements_complets + loyer_caution_verses + documents requis),
  puis génère un magic_link `type='approbation_dossier'` envoyé au
  propriétaire par email pour approbation finale.

Endpoint :
  POST /api/v1/agences/dossiers/{dossier_id}/pre-validate
       RBAC : agence | super_admin

Pré-conditions vérifiées :
  - DossierLocataire existe et appartient à un bien dont l'agence est mandataire
    (ou super_admin)
  - renseignements_complets = TRUE
  - loyer_caution_verses peut être FALSE (le bailleur le confirmera après)
  - proprio_approbation_at IS NULL (pas déjà approuvé)
  - proprio_refus_at IS NULL (pas déjà refusé)

Side-effects :
  - Crée magic_link `type='approbation_dossier'` (TTL 14j) avec payload
    {dossier_id, bien_id, owner_user_id, candidate_user_id, pre_validated_by}
  - Envoie email `approbation_proprietaire` au propriétaire (best-effort)
  - Retourne la URL magic link + expires_at
"""

from __future__ import annotations

import json
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.sprint10_emails import send_approbation_proprietaire
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("althy.agences_dossiers")

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ──────────────────────────────────────────────────────────────────


class PreValidateResponse(BaseModel):
    dossier_id: uuid.UUID
    magic_link_id: uuid.UUID
    magic_link_token: str
    approbation_url: str
    expires_at: datetime
    email_sent: bool


# ── POST /agences/dossiers/{dossier_id}/pre-validate ─────────────────────────


@router.post(
    "/agences/dossiers/{dossier_id}/pre-validate",
    response_model=PreValidateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def pre_validate_dossier(
    dossier_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PreValidateResponse:
    if current_user.role not in ("agence", "super_admin"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seuls les rôles 'agence' et 'super_admin' peuvent pré-valider un dossier",
        )

    # Charge contexte
    row = (
        await db.execute(
            text("""
                SELECT
                    dl.id AS dossier_id,
                    dl.renseignements_complets, dl.loyer_caution_verses,
                    dl.proprio_approbation_at, dl.proprio_refus_at,
                    l.id AS locataire_id, l.user_id AS candidate_user_id,
                    b.id AS bien_id, b.owner_id, b.agence_id
                FROM dossiers_locataires dl
                JOIN locataires l ON l.id = dl.locataire_id
                JOIN biens b ON b.id = l.bien_id
                WHERE dl.id = :did
                LIMIT 1
            """),
            {"did": str(dossier_id)},
        )
    ).one_or_none()

    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dossier introuvable")

    # RBAC granulaire : si rôle agence, vérifier que c'est l'agence du bien
    if (
        current_user.role == "agence"
        and row.agence_id is not None
        and str(row.agence_id) != str(current_user.id)
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous n'êtes pas l'agence mandataire de ce bien",
        )

    # Pré-conditions métier
    if not row.renseignements_complets:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Dossier incomplet — renseignements_complets doit être TRUE",
        )
    if row.proprio_approbation_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Dossier déjà approuvé par le propriétaire"
        )
    if row.proprio_refus_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Dossier déjà refusé par le propriétaire"
        )

    # Récupère email owner (pour envoi email + idempotence anti-double-magic-link)
    owner_row = (
        await db.execute(
            text("SELECT email, first_name, last_name FROM users WHERE id = :uid"),
            {"uid": str(row.owner_id)},
        )
    ).one_or_none()
    if owner_row is None or not owner_row.email:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Propriétaire du bien sans email — impossible d'envoyer l'approbation",
        )

    # Idempotence : si un magic_link approbation_dossier non-expiré non-utilisé
    # existe déjà pour ce dossier_id → retourne-le.
    existing = (
        await db.execute(
            text("""
                SELECT id, token, expires_at
                FROM magic_links
                WHERE type = 'approbation_dossier'
                  AND used = FALSE
                  AND expires_at > NOW()
                  AND payload->>'dossier_id' = :did
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"did": str(dossier_id)},
        )
    ).one_or_none()

    if existing is not None:
        approval_url = f"{settings.FRONTEND_URL}/approuver/{existing.token}"
        return PreValidateResponse(
            dossier_id=dossier_id,
            magic_link_id=existing.id,
            magic_link_token=existing.token,
            approbation_url=approval_url,
            expires_at=existing.expires_at,
            email_sent=False,  # déjà envoyé lors de la création initiale
        )

    # Crée nouveau magic_link
    token = secrets.token_urlsafe(32)
    link_id = uuid.uuid4()
    expires_at = datetime.now(UTC) + timedelta(days=14)
    payload = {
        "dossier_id": str(dossier_id),
        "bien_id": str(row.bien_id),
        "owner_user_id": str(row.owner_id),
        "candidate_user_id": (
            str(row.candidate_user_id) if row.candidate_user_id else None
        ),
        "pre_validated_by": str(current_user.id),
        "pre_validated_at": datetime.now(UTC).isoformat(),
    }
    await db.execute(
        text("""
            INSERT INTO magic_links
                (id, token, type, created_by, target_email, target_role, payload, expires_at)
            VALUES
                (:id, :token, 'approbation_dossier', :by, :email, 'proprio_solo',
                 CAST(:payload AS jsonb), :exp)
        """),
        {
            "id": link_id,
            "token": token,
            "by": current_user.id,
            "email": owner_row.email.lower(),
            "payload": json.dumps(payload),
            "exp": expires_at,
        },
    )
    await db.commit()

    approval_url = f"{settings.FRONTEND_URL}/approuver/{token}"

    # Envoi email approbation (best-effort)
    email_sent = False
    try:
        msg_id = await send_approbation_proprietaire(
            dossier_id, approval_token=token, deny_token=token
        )
        email_sent = msg_id is not None and msg_id != "dev-no-send"
    except Exception:
        logger.warning(
            "send_approbation_proprietaire failed for dossier %s", dossier_id,
            exc_info=True,
        )

    return PreValidateResponse(
        dossier_id=dossier_id,
        magic_link_id=link_id,
        magic_link_token=token,
        approbation_url=approval_url,
        expires_at=expires_at,
        email_sent=email_sent,
    )
