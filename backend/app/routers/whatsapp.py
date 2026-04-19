"""WhatsApp — /api/v1/whatsapp

Conversations, messages WhatsApp Business, et webhook entrant Meta.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Annotated

import httpx
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

logger = logging.getLogger("althy.whatsapp")


# ── Unread count ──────────────────────────────────────────────────────────────

@router.get("/non-lus")
async def count_unread(current_user: AuthDep, db: DbDep) -> dict:
    """Retourne le total de messages WhatsApp non lus pour l'utilisateur."""
    try:
        row = await db.execute(
            text("""
                SELECT COALESCE(SUM(unread_count), 0) AS total
                FROM whatsapp_conversations
                WHERE user_id = :uid
            """),
            {"uid": current_user.id},
        )
        total = row.scalar() or 0
        return {"count": int(total)}
    except Exception:
        return {"count": 0}


# ── Conversations ─────────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(current_user: AuthDep, db: DbDep) -> list[dict]:
    """Retourne les conversations WhatsApp de l'utilisateur."""
    try:
        rows = await db.execute(
            text("""
                SELECT id, contact_phone, contact_name,
                       last_message_at, unread_count,
                       contexte_type, contexte_id
                FROM whatsapp_conversations
                WHERE user_id = :uid
                ORDER BY COALESCE(last_message_at, created_at) DESC
                LIMIT 100
            """),
            {"uid": current_user.id},
        )
        return [
            {
                "id": str(r.id),
                "contact_phone": r.contact_phone,
                "contact_name": r.contact_name,
                "last_message_at": r.last_message_at.isoformat() if r.last_message_at else None,
                "unread_count": r.unread_count,
                "contexte_type": r.contexte_type,
                "contexte_id": str(r.contexte_id) if r.contexte_id else None,
            }
            for r in rows
        ]
    except Exception:
        return []


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, current_user: AuthDep, db: DbDep) -> list[dict]:
    """Retourne les messages d'une conversation (vérification d'appartenance)."""
    try:
        uid = _uuid.UUID(conv_id)
    except ValueError:
        raise HTTPException(422, "conv_id invalide")

    # Ownership check
    row = await db.execute(
        text("SELECT id FROM whatsapp_conversations WHERE id = :id AND user_id = :uid"),
        {"id": uid, "uid": current_user.id},
    )
    if not row.one_or_none():
        raise HTTPException(404, "Conversation introuvable")

    try:
        rows = await db.execute(
            text("""
                SELECT id, direction, body, status, sent_at
                FROM whatsapp_messages
                WHERE conversation_id = :cid
                ORDER BY sent_at ASC
                LIMIT 200
            """),
            {"cid": uid},
        )
        return [
            {
                "id": str(r.id),
                "direction": r.direction,
                "body": r.body,
                "status": r.status,
                "sent_at": r.sent_at.isoformat(),
            }
            for r in rows
        ]
    except Exception:
        return []


class SendBody(BaseModel):
    body: str


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, payload: SendBody, current_user: AuthDep, db: DbDep) -> dict:
    """Envoie un message WhatsApp via Meta Business API."""
    try:
        uid = _uuid.UUID(conv_id)
    except ValueError:
        raise HTTPException(422, "conv_id invalide")

    # ── Guard: WhatsApp must be configured ──
    if not settings.WHATSAPP_API_TOKEN or not settings.WHATSAPP_PHONE_ID:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Intégration WhatsApp non configurée — contactez l'administrateur",
        )

    # Ownership check + get phone
    row = await db.execute(
        text("SELECT id, contact_phone FROM whatsapp_conversations WHERE id = :id AND user_id = :uid"),
        {"id": uid, "uid": current_user.id},
    )
    conv = row.one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation introuvable")

    if not payload.body.strip():
        raise HTTPException(400, "Message vide")

    # ── Send via Meta API ──
    msg_status = "sent"
    external_id: str | None = None
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.post(
                f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_ID}/messages",
                headers={"Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": conv.contact_phone,
                    "type": "text",
                    "text": {"body": payload.body},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                external_id = data.get("messages", [{}])[0].get("id")
            else:
                logger.error(
                    "[whatsapp] Meta API error %s: %s",
                    resp.status_code,
                    resp.text[:500],
                )
                msg_status = "failed"
    except httpx.HTTPError as exc:
        logger.error("[whatsapp] Meta API request failed: %s", exc)
        msg_status = "failed"

    # ── Persist message with actual status ──
    msg_id = _uuid.uuid4()
    now = datetime.now(timezone.utc)
    try:
        await db.execute(
            text("""
                INSERT INTO whatsapp_messages
                    (id, conversation_id, direction, body, status, external_id, sent_at)
                VALUES
                    (:id, :cid, 'outbound', :body, :status, :ext_id, :now)
            """),
            {"id": msg_id, "cid": uid, "body": payload.body, "status": msg_status, "ext_id": external_id, "now": now},
        )
        await db.execute(
            text("UPDATE whatsapp_conversations SET last_message_at = :now WHERE id = :id"),
            {"id": uid, "now": now},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f"Erreur lors de l'enregistrement : {exc}")

    # If Meta call failed, tell the frontend explicitly
    if msg_status == "failed":
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Le message a été enregistré mais l'envoi WhatsApp a échoué. Réessayez plus tard.",
        )

    return {
        "id": str(msg_id),
        "direction": "outbound",
        "body": payload.body,
        "status": msg_status,
        "sent_at": now.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Webhook Meta — messages entrants + events de statut
# ═══════════════════════════════════════════════════════════════════════════════

def _verify_meta_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Vérifie la signature X-Hub-Signature-256 envoyée par Meta."""
    if not settings.META_APP_SECRET:
        # En dev sans secret configuré, on accepte (log warning)
        logger.warning("[whatsapp-webhook] META_APP_SECRET non configuré — signature non vérifiée")
        return True
    if not signature_header:
        return False
    # Header format: "sha256=<hex>"
    expected = "sha256=" + hmac.new(
        settings.META_APP_SECRET.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.get("/webhook")
async def webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
) -> int | str:
    """Handshake de vérification Meta — retourne hub.challenge si le token correspond."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("[whatsapp-webhook] Verification handshake OK")
        return int(hub_challenge) if hub_challenge and hub_challenge.isdigit() else hub_challenge or ""
    logger.warning("[whatsapp-webhook] Verification failed — token mismatch")
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Verification failed")


@router.post("/webhook")
async def webhook_receive(request: Request, db: DbDep) -> dict:
    """Reçoit les messages entrants et events de statut depuis Meta."""
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    if not _verify_meta_signature(raw_body, signature):
        logger.warning("[whatsapp-webhook] Invalid signature — rejecting")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid signature")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    # Meta envoie un wrapper avec entry[].changes[].value
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            if value.get("messaging_product") != "whatsapp":
                continue

            # ── Messages entrants ──
            for msg in value.get("messages", []):
                await _handle_inbound_message(db, value, msg)

            # ── Events de statut (delivered, read, failed) ──
            for st in value.get("statuses", []):
                await _handle_status_update(db, st)

    # Meta attend toujours un 200
    return {"status": "ok"}


async def _handle_inbound_message(db: AsyncSession, value: dict, msg: dict) -> None:
    """Traite un message entrant WhatsApp."""
    phone = msg.get("from", "")
    external_id = msg.get("id")
    body = ""
    if msg.get("type") == "text":
        body = msg.get("text", {}).get("body", "")
    else:
        # Pour les types non-texte (image, audio, etc.), on stocke le type
        body = f"[{msg.get('type', 'media')}]"

    timestamp = msg.get("timestamp")
    sent_at = (
        datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
        if timestamp
        else datetime.now(timezone.utc)
    )

    # Contact name from Meta payload
    contacts = value.get("contacts", [])
    contact_name = contacts[0].get("profile", {}).get("name") if contacts else None

    if not phone:
        logger.warning("[whatsapp-webhook] Message sans numéro source — ignoré")
        return

    try:
        # Chercher conversation existante par contact_phone
        row = await db.execute(
            text("""
                SELECT id, user_id
                FROM whatsapp_conversations
                WHERE contact_phone = :phone
                ORDER BY last_message_at DESC NULLS LAST
                LIMIT 1
            """),
            {"phone": phone},
        )
        conv = row.one_or_none()

        if conv:
            conv_id = conv.id
        else:
            # Créer une conversation orpheline (pas de user_id connu)
            # L'admin/agence devra l'attribuer manuellement
            conv_id = _uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO whatsapp_conversations
                        (id, contact_phone, contact_name, last_message_at, unread_count)
                    VALUES
                        (:id, :phone, :name, :now, 0)
                """),
                {"id": conv_id, "phone": phone, "name": contact_name, "now": sent_at},
            )

        # Insérer le message entrant
        await db.execute(
            text("""
                INSERT INTO whatsapp_messages
                    (id, conversation_id, direction, body, status, external_id, sent_at)
                VALUES
                    (:id, :cid, 'inbound', :body, 'received', :ext_id, :sent_at)
            """),
            {
                "id": _uuid.uuid4(),
                "cid": conv_id,
                "body": body,
                "ext_id": external_id,
                "sent_at": sent_at,
            },
        )

        # Mettre à jour la conversation
        await db.execute(
            text("""
                UPDATE whatsapp_conversations
                SET last_message_at = :now,
                    unread_count = unread_count + 1
                WHERE id = :id
            """),
            {"id": conv_id, "now": sent_at},
        )

        await db.commit()
        logger.info("[whatsapp-webhook] Inbound message from %s stored (conv=%s)", phone, conv_id)

    except Exception as exc:
        await db.rollback()
        logger.error("[whatsapp-webhook] Failed to store inbound message: %s", exc)


async def _handle_status_update(db: AsyncSession, st: dict) -> None:
    """Met à jour le statut d'un message sortant (delivered, read, failed)."""
    external_id = st.get("id")
    new_status = st.get("status")  # sent, delivered, read, failed

    if not external_id or not new_status:
        return

    try:
        result = await db.execute(
            text("""
                UPDATE whatsapp_messages
                SET status = :status
                WHERE external_id = :ext_id
                  AND direction = 'outbound'
            """),
            {"status": new_status, "ext_id": external_id},
        )
        await db.commit()

        if result.rowcount:
            logger.info("[whatsapp-webhook] Status %s → %s", external_id[:16], new_status)
    except Exception as exc:
        await db.rollback()
        logger.error("[whatsapp-webhook] Failed to update status: %s", exc)
