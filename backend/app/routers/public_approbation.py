"""Workflow approbation propriétaire — no-auth scoped via magic_link (Sprint 10 Lot 5).

§2.4.16 décision #3 — Interprétation A :
  Le bailleur (proprio_solo) approuve un candidat locataire issu d'une
  invitation existante. Magic link dédié `type='approbation_dossier'` pour
  les bailleurs sans compte authentifié.

  PAS de candidature spontanée marketplace. PAS de frais CHF 45.

Endpoints publics (no-auth — bearer token = magic_links.token, scope strict) :
  - GET  /api/v1/public/approbation/{token}          — lecture synthèse dossier
  - POST /api/v1/public/approbation/{token}/approve  — approuve le candidat
  - POST /api/v1/public/approbation/{token}/deny     — refuse avec motif

Le scope du token est borné au seul dossier_id ciblé (lecture/écriture
sur ce dossier uniquement). Token expire 14 jours après création (vs 7
jours pour invitation locataire).

Endpoint authentifié pré-validation :
  - POST /api/v1/agences/dossiers/{id}/pre-validate (RBAC agence|super_admin)
    cf router agences_dossiers.py

Doctrine §B.10 : pas de faux statut. Si magic_link invalide → 404.
Doctrine §B.12 : audit log via session isolée AsyncSessionLocal.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from app.core.database import AsyncSessionLocal, get_db
from app.models.locataire import DossierLocataire, Locataire
from app.models.bien import Bien
from app.models.contract import Contract
from app.models.user import User
from app.services.sprint10_emails import (
    send_approbation_donnee,
    send_candidat_refuse,
)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("althy.public_approbation")

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ──────────────────────────────────────────────────────────────────


class ApprobationPreview(BaseModel):
    """Synthèse anonymisée du dossier pour le propriétaire (LPD-friendly)."""
    dossier_id: uuid.UUID
    candidate_full_name: str
    candidate_dossier_summary: str
    bien_address: str
    monthly_rent: float | None
    cosignataires_count: int
    statut: str  # pending | approved | denied | expired | invalid
    expires_at: datetime
    owner_name: str


class ApprobationApprove(BaseModel):
    """Payload optionnel pour /approve (peut être vide — clic 1 bouton)."""
    commentaire: str | None = Field(None, max_length=500)


class ApprobationDeny(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _resolve_magic_link(
    db: AsyncSession, token: str
) -> tuple[uuid.UUID, dict, datetime, bool]:
    """Résout un token magic_link type='approbation_dossier'.

    Retourne (link_id, payload, expires_at, used). Raise 404 si invalide.
    """
    if not token or len(token) < 16:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token invalide")

    row = (
        await db.execute(
            text("""
                SELECT id, payload, expires_at, used
                FROM magic_links
                WHERE token = :token
                  AND type = 'approbation_dossier'
            """),
            {"token": token},
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lien d'approbation introuvable")

    return row.id, dict(row.payload or {}), row.expires_at, row.used


async def _load_dossier_context(
    db: AsyncSession, dossier_id: uuid.UUID
) -> dict:
    """Charge le dossier + locataire + user candidat + bien + owner pour la synthèse."""
    res = (
        await db.execute(
            text("""
                SELECT
                    dl.id AS dossier_id, dl.employeur, dl.poste, dl.salaire_net,
                    dl.type_contrat, dl.anciennete,
                    dl.proprio_approbation_at, dl.proprio_refus_at,
                    l.id AS locataire_id, l.user_id, l.loyer, l.cosignataires,
                    b.adresse, b.cp, b.ville, b.owner_id,
                    cu.first_name AS cand_first, cu.last_name AS cand_last,
                    ou.first_name AS own_first, ou.last_name AS own_last,
                    ou.email AS own_email
                FROM dossiers_locataires dl
                JOIN locataires l ON l.id = dl.locataire_id
                JOIN biens b ON b.id = l.bien_id
                LEFT JOIN users cu ON cu.id = l.user_id
                JOIN users ou ON ou.id = b.owner_id
                WHERE dl.id = :did
                LIMIT 1
            """),
            {"did": str(dossier_id)},
        )
    ).one_or_none()
    if res is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dossier introuvable")
    return dict(res._mapping)


def _build_dossier_summary(ctx: dict) -> str:
    parts: list[str] = []
    if ctx.get("poste"):
        parts.append(str(ctx["poste"]))
    if ctx.get("employeur"):
        parts.append(f"chez {ctx['employeur']}")
    if ctx.get("type_contrat"):
        parts.append(f"({str(ctx['type_contrat']).upper()})")
    if ctx.get("salaire_net"):
        sal = f"{float(ctx['salaire_net']):,.0f}".replace(",", "'")
        parts.append(f"— revenu net CHF {sal}")
    if ctx.get("anciennete"):
        parts.append(f"— {int(ctx['anciennete'])} mois d'ancienneté")
    return " ".join(parts) or "Dossier complet à 100%"


# ── GET /public/approbation/{token} — lecture synthèse ───────────────────────


@router.get("/public/approbation/{token}", response_model=ApprobationPreview)
async def get_approbation_preview(
    token: str,
    db: DbDep,
) -> ApprobationPreview:
    link_id, payload, expires_at, used = await _resolve_magic_link(db, token)

    now = datetime.now(UTC)
    statut: str
    if used:
        statut = "used"
    elif expires_at < now:
        statut = "expired"
    else:
        statut = "pending"

    dossier_id_str = payload.get("dossier_id")
    if not dossier_id_str:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Payload magic_link sans dossier_id"
        )
    try:
        dossier_id = uuid.UUID(dossier_id_str)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "dossier_id payload invalide")

    ctx = await _load_dossier_context(db, dossier_id)

    # Marqueurs finaux côté dossier (priorité sur statut magic_link)
    if ctx.get("proprio_approbation_at"):
        statut = "approved"
    elif ctx.get("proprio_refus_at"):
        statut = "denied"

    cosig = ctx.get("cosignataires") or []
    cosig_count = len(cosig) if isinstance(cosig, list) else 0

    candidate_full_name = " ".join(
        p for p in (ctx.get("cand_first"), ctx.get("cand_last")) if p
    ) or "Candidat"
    owner_name = " ".join(
        p for p in (ctx.get("own_first"), ctx.get("own_last")) if p
    ) or "Bailleur"
    bien_address = (
        f"{ctx.get('adresse','')}, {ctx.get('cp','')} {ctx.get('ville','')}"
    ).strip(", ")

    return ApprobationPreview(
        dossier_id=ctx["dossier_id"],
        candidate_full_name=candidate_full_name,
        candidate_dossier_summary=_build_dossier_summary(ctx),
        bien_address=bien_address or "—",
        monthly_rent=float(ctx["loyer"]) if ctx.get("loyer") is not None else None,
        cosignataires_count=cosig_count,
        statut=statut,
        expires_at=expires_at,
        owner_name=owner_name,
    )


# ── POST /public/approbation/{token}/approve ─────────────────────────────────


@router.post("/public/approbation/{token}/approve", response_model=ApprobationPreview)
async def approve_dossier(
    token: str,
    payload_body: ApprobationApprove,
    request: Request,
    db: DbDep,
) -> ApprobationPreview:
    link_id, payload, expires_at, used = await _resolve_magic_link(db, token)
    now = datetime.now(UTC)
    if used:
        raise HTTPException(status.HTTP_409_CONFLICT, "Lien déjà utilisé")
    if expires_at < now:
        raise HTTPException(status.HTTP_410_GONE, "Lien expiré")

    dossier_id_str = payload.get("dossier_id")
    owner_user_id_str = payload.get("owner_user_id")
    if not dossier_id_str:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Payload magic_link sans dossier_id"
        )
    dossier_id = uuid.UUID(dossier_id_str)
    owner_user_id = uuid.UUID(owner_user_id_str) if owner_user_id_str else None

    dossier = await db.get(DossierLocataire, dossier_id)
    if dossier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dossier introuvable")

    if dossier.proprio_approbation_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Dossier déjà approuvé"
        )
    if dossier.proprio_refus_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Dossier déjà refusé"
        )

    dossier.proprio_approbation_at = now
    dossier.proprio_approbation_ip = _client_ip(request)
    if owner_user_id:
        dossier.proprio_approbation_by_user_id = owner_user_id
    dossier.statut_proposition = "accepte"

    # Marque magic_link comme used + commentaire dans payload
    new_payload = dict(payload)
    new_payload["approved_at"] = now.isoformat()
    if payload_body.commentaire:
        new_payload["approve_commentaire"] = payload_body.commentaire
    await db.execute(
        text(
            "UPDATE magic_links SET used = TRUE, used_at = NOW(), "
            "payload = CAST(:p AS jsonb) WHERE id = :lid"
        ),
        {"p": json.dumps(new_payload), "lid": link_id},
    )
    await db.commit()

    # Email confirmation au bailleur (best-effort §B.12 — session isolée)
    try:
        await send_approbation_donnee(dossier_id)
    except Exception:
        logger.warning(
            "send_approbation_donnee failed for dossier %s", dossier_id, exc_info=True
        )

    # Retourne le preview à jour (re-fetch dans la même session)
    return await get_approbation_preview(token, db)


# ── POST /public/approbation/{token}/deny ────────────────────────────────────


@router.post("/public/approbation/{token}/deny", response_model=ApprobationPreview)
async def deny_dossier(
    token: str,
    payload_body: ApprobationDeny,
    request: Request,
    db: DbDep,
) -> ApprobationPreview:
    link_id, payload, expires_at, used = await _resolve_magic_link(db, token)
    now = datetime.now(UTC)
    if used:
        raise HTTPException(status.HTTP_409_CONFLICT, "Lien déjà utilisé")
    if expires_at < now:
        raise HTTPException(status.HTTP_410_GONE, "Lien expiré")

    dossier_id_str = payload.get("dossier_id")
    if not dossier_id_str:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Payload magic_link sans dossier_id"
        )
    dossier_id = uuid.UUID(dossier_id_str)

    dossier = await db.get(DossierLocataire, dossier_id)
    if dossier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dossier introuvable")

    if dossier.proprio_approbation_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Dossier déjà approuvé"
        )
    if dossier.proprio_refus_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Dossier déjà refusé"
        )

    dossier.proprio_refus_at = now
    dossier.proprio_refus_reason = payload_body.reason
    dossier.statut_proposition = "refuse"

    new_payload = dict(payload)
    new_payload["denied_at"] = now.isoformat()
    new_payload["deny_reason"] = payload_body.reason
    await db.execute(
        text(
            "UPDATE magic_links SET used = TRUE, used_at = NOW(), "
            "payload = CAST(:p AS jsonb) WHERE id = :lid"
        ),
        {"p": json.dumps(new_payload), "lid": link_id},
    )
    await db.commit()

    # Email au candidat refusé (best-effort)
    try:
        await send_candidat_refuse(dossier_id)
    except Exception:
        logger.warning(
            "send_candidat_refuse failed for dossier %s", dossier_id, exc_info=True
        )

    return await get_approbation_preview(token, db)
