"""WhatsApp — /api/v1/whatsapp

Conversations et messages WhatsApp Business.
"""

from __future__ import annotations

import uuid as _uuid
from typing import Annotated

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


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

    # Send via Meta API if configured
    external_id: str | None = None
    if settings.WHATSAPP_API_TOKEN and settings.WHATSAPP_PHONE_ID:
        import httpx
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

    # Persist message
    msg_id = _uuid.uuid4()
    try:
        await db.execute(
            text("""
                INSERT INTO whatsapp_messages
                    (id, conversation_id, direction, body, status, external_id)
                VALUES
                    (:id, :cid, 'outbound', :body, 'sent', :ext_id)
            """),
            {"id": msg_id, "cid": uid, "body": payload.body, "ext_id": external_id},
        )
        await db.execute(
            text("UPDATE whatsapp_conversations SET last_message_at = now() WHERE id = :id"),
            {"id": uid},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f"Erreur lors de l'enregistrement : {exc}")

    return {
        "id": str(msg_id),
        "direction": "outbound",
        "body": payload.body,
        "status": "sent",
        "sent_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }
