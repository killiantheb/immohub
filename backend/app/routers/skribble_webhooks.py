"""Webhook Skribble — réception événements signature (Sprint 10 Lot 2).

Pipeline :
  1. Vérifie HMAC-SHA256 du body avec `settings.SKRIBBLE_WEBHOOK_SECRET`.
  2. Parse JSON.
  3. Résout le document (Contract|Avenant|Resiliation|MandatGestion|EDL)
     via `skribble_session_id` matching.
  4. Dispatche sur l'event_type.
  5. Pour `signature_request.completed` : download PDF signé Skribble → upload
     bucket signable-documents → MAJ row + trigger post-signature hook
     (loyer_activation pour bail, apply avenant.data pour avenant, etc.).

Doctrine §B.10 : retourne 200 OK uniquement si la mutation a réussi.
Doctrine §B.12 : log audit via session dédiée AsyncSessionLocal() englobante.
Doctrine §B.15 : pour Mandat completed, mandat.status='active' (PAS de
                  side-effect financier — commission_pct_* reste data pure).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.models.avenant import Avenant
from app.models.contract import Contract
from app.models.mandat_gestion import MandatGestion
from app.models.resiliation import Resiliation
from app.services.loyer_activation import activate_first_rent
from app.services.skribble_service import (
    SkribbleAPIError,
    get_skribble_client,
    verify_webhook_signature,
)
from app.services.storage import upload_pdf
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("althy.skribble.webhook")

router = APIRouter()


# ── Resolver : trouve l'entité associée à un skribble_session_id ─────────────


async def _resolve_document(
    db: AsyncSession, session_id: str
) -> tuple[str, Any] | None:
    """Cherche le document associé à un skribble_session_id.

    Retourne (table_label, model_instance_or_row_dict) ou None si introuvable.
    Table_label ∈ {contract, avenant, resiliation, mandat, edl_entree,
                   edl_sortie, convention_sortie}.
    """
    # Contracts
    contract = (
        await db.execute(
            select(Contract).where(Contract.skribble_session_id == session_id)
        )
    ).scalar_one_or_none()
    if contract is not None:
        return ("contract", contract)

    # Avenants
    avenant = (
        await db.execute(
            select(Avenant).where(Avenant.skribble_session_id == session_id)
        )
    ).scalar_one_or_none()
    if avenant is not None:
        return ("avenant", avenant)

    # Resiliations
    resiliation = (
        await db.execute(
            select(Resiliation).where(Resiliation.skribble_session_id == session_id)
        )
    ).scalar_one_or_none()
    if resiliation is not None:
        return ("resiliation", resiliation)

    # Mandats
    mandat = (
        await db.execute(
            select(MandatGestion).where(MandatGestion.skribble_session_id == session_id)
        )
    ).scalar_one_or_none()
    if mandat is not None:
        return ("mandat", mandat)

    # Changements locataire — recherche dans 3 JSONB (edl_entree/sortie/convention)
    # via SQL brut (pas de modèle SQLAlchemy pour cette table).
    for col, label in (
        ("edl_entree", "edl_entree"),
        ("edl_sortie", "edl_sortie"),
        ("convention_sortie", "convention_sortie"),
    ):
        row = (
            await db.execute(
                text(f"""
                    SELECT id, bien_id, edl_entree, edl_sortie, convention_sortie
                    FROM changements_locataire
                    WHERE {col}->>'skribble_session_id' = :sid
                    LIMIT 1
                """),
                {"sid": session_id},
            )
        ).fetchone()
        if row is not None:
            return (label, dict(row._mapping))

    return None


# ── Event handlers ───────────────────────────────────────────────────────────


async def _handle_completed(
    db: AsyncSession, doc_label: str, doc: Any, session_id: str, event: dict
) -> None:
    """Tous signataires OK : download PDF signé + MAJ row + post-hooks."""
    client = get_skribble_client()
    try:
        signed_pdf = await client.download_signed_pdf(session_id)
    except SkribbleAPIError as exc:
        # §B.10 : on ne valide PAS le webhook si on ne peut pas récupérer le PDF.
        # On laisse Skribble re-livrer le webhook (retry côté Skribble).
        logger.error("skribble.completed.download_failed session=%s err=%s", session_id, exc)
        raise

    now = datetime.now(UTC)

    if doc_label == "contract":
        contract: Contract = doc
        key = await upload_pdf(
            user_id=str(contract.owner_id),
            bien_id=str(contract.bien_id),
            doc_type="bail-signed",
            mois=contract.reference,
            pdf_bytes=signed_pdf,
            bucket=settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS,
        )
        contract.skribble_status = "completed"
        contract.skribble_signed_pdf_url = key
        # Plan A : on ne touche PAS contract.signed_at / tenant_signed_at
        # (réservés Plan B Sprint 8). On utilise les colonnes Skribble.
        contract.status = "active"
        # Post-hook : activation 1re loyer_transaction (existant Sprint 8)
        await activate_first_rent(db, contract)
        logger.info(
            "skribble.completed.contract id=%s session=%s loyer_activated",
            contract.id, session_id,
        )
        return

    if doc_label == "avenant":
        avenant: Avenant = doc
        key = await upload_pdf(
            user_id=str(avenant.contract.owner_id) if avenant.contract else "unknown",
            bien_id=str(avenant.contract.bien_id) if avenant.contract else "unknown",
            doc_type="avenant-signed",
            mois=avenant.reference,
            pdf_bytes=signed_pdf,
            bucket=settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS,
        )
        avenant.skribble_status = "completed"
        avenant.skribble_signed_pdf_url = key
        avenant.signed_at_locataire = now
        avenant.signed_at_agence = now
        avenant.status = "signed"

        # Post-hook : appliquer avenant.data au Contract selon avenant_type
        if avenant.contract:
            data = avenant.data or {}
            if avenant.avenant_type == "modification_loyer" and "nouveau_loyer" in data:
                avenant.contract.monthly_rent = data["nouveau_loyer"]
            elif avenant.avenant_type == "modification_date" and "nouvelle_date_fin" in data:
                try:
                    avenant.contract.end_date = datetime.fromisoformat(
                        data["nouvelle_date_fin"]
                    )
                except (ValueError, TypeError):
                    logger.warning(
                        "avenant.completed.invalid_date avenant=%s data=%s",
                        avenant.id, data,
                    )
            elif avenant.avenant_type == "prolongation" and "nouvelle_date_fin" in data:
                try:
                    avenant.contract.end_date = datetime.fromisoformat(
                        data["nouvelle_date_fin"]
                    )
                except (ValueError, TypeError):
                    pass
            # Autres avenant_type : pas de mutation automatique du Contract,
            # le contenu reste dans avenant.data + PDF signé.

        logger.info("skribble.completed.avenant id=%s session=%s", avenant.id, session_id)
        return

    if doc_label == "resiliation":
        resiliation: Resiliation = doc
        key = await upload_pdf(
            user_id=str(resiliation.contract.owner_id) if resiliation.contract else "unknown",
            bien_id=str(resiliation.contract.bien_id) if resiliation.contract else "unknown",
            doc_type="resiliation-signed",
            mois=resiliation.reference,
            pdf_bytes=signed_pdf,
            bucket=settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS,
        )
        resiliation.skribble_status = "completed"
        resiliation.skribble_signed_pdf_url = key
        resiliation.signed_at = now
        resiliation.status = "signed"
        # Note : la bascule Contract.status='terminated' attend l'envoi
        # effectif du courrier (status='envoyee' puis 'appliquee') — pas auto.
        logger.info("skribble.completed.resiliation id=%s session=%s", resiliation.id, session_id)
        return

    if doc_label == "mandat":
        mandat: MandatGestion = doc
        bien_id_for_path = str(mandat.bien_id) if mandat.bien_id else "global"
        key = await upload_pdf(
            user_id=str(mandat.mandant_id),
            bien_id=bien_id_for_path,
            doc_type="mandat-signed",
            mois=mandat.reference,
            pdf_bytes=signed_pdf,
            bucket=settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS,
        )
        mandat.skribble_status = "completed"
        mandat.skribble_signed_pdf_url = key
        mandat.signed_at_mandant = now
        mandat.signed_at_agence = now
        mandat.status = "active"
        # §2.4.16 : AUCUN side-effect financier (commission_pct_* reste data pure).
        logger.info("skribble.completed.mandat id=%s session=%s", mandat.id, session_id)
        return

    if doc_label in ("edl_entree", "edl_sortie", "convention_sortie"):
        row_dict = doc  # dict from raw SQL
        changement_id = row_dict["id"]
        bien_id = row_dict["bien_id"]

        # Upload signed PDF
        # On utilise l'owner du bien pour le user_id path.
        bien_owner = (
            await db.execute(
                text("SELECT owner_id FROM biens WHERE id = :bid"),
                {"bid": str(bien_id)},
            )
        ).scalar_one_or_none() or "unknown"

        doc_type = f"{doc_label.replace('_', '-')}-signed"
        key = await upload_pdf(
            user_id=str(bien_owner),
            bien_id=str(bien_id),
            doc_type=doc_type,
            mois=str(changement_id)[:8],
            pdf_bytes=signed_pdf,
            bucket=settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS,
        )
        # Update le JSONB correspondant
        existing = row_dict.get(doc_label) or {}
        existing["skribble_status"] = "completed"
        existing["skribble_signed_pdf_url"] = key
        existing["signed_at_locataire"] = now.isoformat()
        existing["signed_at_agence"] = now.isoformat()
        await db.execute(
            text(f"UPDATE changements_locataire SET {doc_label} = :v WHERE id = :cid"),
            {"v": json.dumps(existing), "cid": str(changement_id)},
        )
        logger.info(
            "skribble.completed.%s changement=%s session=%s",
            doc_label, changement_id, session_id,
        )
        return

    logger.warning(
        "skribble.completed.unknown_label label=%s session=%s",
        doc_label, session_id,
    )


async def _handle_partial_signed(doc_label: str, doc: Any, session_id: str) -> None:
    """Un signataire OK mais pas tous — on marque status intermédiaire."""
    if doc_label in ("contract", "avenant", "resiliation", "mandat"):
        doc.skribble_status = "partial_signed"
    elif doc_label in ("edl_entree", "edl_sortie", "convention_sortie"):
        # Pas de mutation côté JSONB pour partial — on reste en
        # pending_signatures jusqu'au completed.
        pass


async def _handle_declined_or_expired(
    db: AsyncSession, doc_label: str, doc: Any, event_type: str, session_id: str
) -> None:
    status_label = "declined" if "declined" in event_type else "expired"
    if doc_label in ("contract", "avenant", "resiliation", "mandat"):
        doc.skribble_status = status_label
        # On ne change pas status global (reste pending_signatures ou draft)
        # pour permettre une nouvelle tentative.
    elif doc_label in ("edl_entree", "edl_sortie", "convention_sortie"):
        row_dict = doc
        existing = row_dict.get(doc_label) or {}
        existing["skribble_status"] = status_label
        await db.execute(
            text(f"UPDATE changements_locataire SET {doc_label} = :v WHERE id = :cid"),
            {"v": json.dumps(existing), "cid": str(row_dict["id"])},
        )
    logger.info("skribble.%s session=%s label=%s", status_label, session_id, doc_label)


# ── Audit log (§B.12 — session dédiée) ───────────────────────────────────────


async def _audit_log_webhook(event: dict[str, Any], doc_label: str | None) -> None:
    """Log audit via session isolée (§B.12).

    Best-effort : si la table audit_logs n'existe pas ou si erreur DB,
    on ne casse pas le webhook.
    """
    try:
        async with AsyncSessionLocal() as log_db:
            await log_db.execute(
                text("""
                    INSERT INTO audit_logs
                        (id, actor_user_id, action, resource_type, resource_id, metadata)
                    VALUES
                        (:id, NULL, :action, :rtype, :rid, CAST(:meta AS jsonb))
                """),
                {
                    "id": str(uuid.uuid4()),
                    "action": event.get("event_type", "skribble.unknown"),
                    "rtype": doc_label or "skribble_unknown",
                    "rid": event.get("request_id", ""),
                    "meta": json.dumps(event),
                },
            )
            await log_db.commit()
    except Exception:
        logger.warning("audit_log_webhook failed (non-blocking)", exc_info=True)


# ── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/webhooks/skribble")
async def skribble_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Reçoit un webhook Skribble.

    Doctrine §B.10 : retourne 200 uniquement si traitement OK. 401 si HMAC fail.
    404 si session_id introuvable côté DB (peut arriver pour des events après
    cancel/cleanup — on log et on 200 pour éviter le retry infini Skribble).
    """
    body_bytes = await request.body()
    signature_header = request.headers.get("X-Skribble-Signature", "")

    if not verify_webhook_signature(body_bytes, signature_header):
        logger.warning(
            "skribble.webhook.hmac_invalid len_body=%d header=%s",
            len(body_bytes), signature_header[:16] + "..." if signature_header else "(empty)",
        )
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Signature HMAC invalide",
        )

    try:
        event = json.loads(body_bytes)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Payload JSON invalide: {exc}",
        )

    event_type = event.get("event_type", "")
    session_id = event.get("request_id") or event.get("signature_request_id")

    if not event_type or not session_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Payload sans event_type ou request_id",
        )

    resolved = await _resolve_document(db, session_id)
    if resolved is None:
        logger.info(
            "skribble.webhook.session_unknown session=%s event_type=%s (ignoring, 200)",
            session_id, event_type,
        )
        # On retourne 200 quand même pour ne pas spammer le retry Skribble
        # (l'event est probablement post-cleanup côté Althy).
        await _audit_log_webhook(event, doc_label=None)
        return {"status": "ignored", "reason": "session_unknown"}

    doc_label, doc = resolved

    if event_type == "signature_request.created":
        # Rien à muter — Skribble nous notifie que la request a bien été créée.
        pass
    elif event_type == "signature_request.signed":
        await _handle_partial_signed(doc_label, doc, session_id)
    elif event_type == "signature_request.completed":
        await _handle_completed(db, doc_label, doc, session_id, event)
    elif event_type in (
        "signature_request.declined",
        "signature_request.expired",
    ):
        await _handle_declined_or_expired(db, doc_label, doc, event_type, session_id)
    else:
        logger.info("skribble.webhook.unknown_event_type=%s", event_type)
        await _audit_log_webhook(event, doc_label=doc_label)
        return {"status": "ignored", "reason": "unknown_event_type"}

    # Audit log §B.12 session isolée
    await _audit_log_webhook(event, doc_label=doc_label)

    return {"status": "ok", "event_type": event_type, "doc_label": doc_label}


# ── Status polling endpoint (utility) ────────────────────────────────────────

from app.core.security import get_current_user  # noqa: E402


@router.get("/skribble/status/{doc_type}/{doc_id}")
async def skribble_status(
    doc_type: str,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Retourne l'état Skribble d'un document. doc_type ∈ {contract, avenant,
    resiliation, mandat}.

    Utilisé par l'UI Lot 6 pour polling (toutes les 5s tant que pending).
    """
    if doc_type == "contract":
        doc = await db.get(Contract, doc_id)
    elif doc_type == "avenant":
        doc = await db.get(Avenant, doc_id)
    elif doc_type == "resiliation":
        doc = await db.get(Resiliation, doc_id)
    elif doc_type == "mandat":
        doc = await db.get(MandatGestion, doc_id)
    else:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"doc_type invalide: {doc_type}"
        )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")

    # RBAC light : owner / agency / tenant / super_admin
    allowed = current_user.role == "super_admin"
    if doc_type == "contract":
        allowed = allowed or current_user.id in (doc.owner_id, doc.agency_id, doc.tenant_id)
    elif doc_type in ("avenant", "resiliation") and doc.contract is not None:
        c = doc.contract
        allowed = allowed or current_user.id in (c.owner_id, c.agency_id, c.tenant_id)
    elif doc_type == "mandat":
        allowed = allowed or current_user.id in (doc.mandant_id, doc.agence_id)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    return {
        "doc_type": doc_type,
        "doc_id": str(doc_id),
        "skribble_session_id": getattr(doc, "skribble_session_id", None),
        "skribble_status": getattr(doc, "skribble_status", None),
        "skribble_signed_pdf_url": getattr(doc, "skribble_signed_pdf_url", None),
        "status": getattr(doc, "status", None),
    }


@router.post("/skribble/{doc_type}/{doc_id}/cancel")
async def skribble_cancel(
    doc_type: str,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Annule une signature request en cours. RBAC strict — write seulement."""
    if doc_type == "contract":
        doc = await db.get(Contract, doc_id)
    elif doc_type == "avenant":
        doc = await db.get(Avenant, doc_id)
    elif doc_type == "resiliation":
        doc = await db.get(Resiliation, doc_id)
    elif doc_type == "mandat":
        doc = await db.get(MandatGestion, doc_id)
    else:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"doc_type invalide: {doc_type}"
        )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")

    # RBAC : owner ou agence ou super_admin (pas le locataire)
    allowed = current_user.role == "super_admin"
    if doc_type == "contract":
        allowed = allowed or current_user.id in (doc.owner_id, doc.agency_id)
    elif doc_type in ("avenant", "resiliation") and doc.contract is not None:
        c = doc.contract
        allowed = allowed or current_user.id in (c.owner_id, c.agency_id)
    elif doc_type == "mandat":
        allowed = allowed or current_user.id == doc.agence_id  # côté agence
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    session_id = getattr(doc, "skribble_session_id", None)
    if not session_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Aucune session Skribble active pour ce document",
        )

    client = get_skribble_client()
    try:
        ok = await client.cancel_signature_request(session_id)
    except SkribbleAPIError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Skribble cancel failed: {exc}"
        )

    if ok:
        doc.skribble_status = "cancelled"
        doc.status = "draft"  # repasse en draft pour permettre nouvelle tentative
        await db.flush()
    return {"cancelled": ok, "doc_id": str(doc_id), "session_id": session_id}


@router.post("/skribble/edl/{changement_id}/send")
async def skribble_edl_send(
    changement_id: uuid.UUID,
    phase: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Envoie un EDL en signature. phase ∈ {entree, sortie, convention}."""
    from app.services.signature_orchestrator import send_edl_to_skribble

    if current_user.role not in ("proprio_solo", "agence", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    resp = await send_edl_to_skribble(db, changement_id, phase)
    await db.flush()
    return resp
