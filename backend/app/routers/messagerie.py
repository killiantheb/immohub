"""Messagerie — /api/v1/messagerie

Lecture des emails immobiliers depuis email_cache.
La synchronisation OAuth est gérée par oauth.py.
"""

from __future__ import annotations

from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/messagerie", tags=["messagerie"])

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("/non-lus")
async def count_unread(current_user: AuthDep, db: DbDep) -> dict:
    """Retourne le nombre d'emails non traités dans email_cache."""
    try:
        row = await db.execute(
            text("""
                SELECT COUNT(*) FROM email_cache
                WHERE user_id = :uid AND is_processed = FALSE
            """),
            {"uid": current_user.id},
        )
        total = row.scalar() or 0
        return {"count": int(total)}
    except Exception:
        return {"count": 0}


@router.get("/")
async def list_emails(current_user: AuthDep, db: DbDep, limit: int = 50) -> list[dict]:
    """Retourne les emails importés depuis email_cache (par date décroissante)."""
    try:
        rows = await db.execute(
            text("""
                SELECT id, provider, subject, sender, received_at,
                       body_preview, labels, is_processed
                FROM email_cache
                WHERE user_id = :uid
                ORDER BY received_at DESC
                LIMIT :limit
            """),
            {"uid": current_user.id, "limit": limit},
        )
        return [
            {
                "id": str(r.id),
                "provider": r.provider,
                "subject": r.subject,
                "sender": r.sender,
                "received_at": r.received_at.isoformat() if r.received_at else None,
                "body_preview": r.body_preview,
                "labels": r.labels or [],
                "is_processed": r.is_processed,
            }
            for r in rows
        ]
    except Exception:
        return []


@router.post("/synchroniser")
async def synchroniser(current_user: AuthDep) -> dict:
    """Déclenche une synchronisation des emails via Celery."""
    from app.tasks.sync_tasks import sync_messagerie_task

    result = sync_messagerie_task.delay(str(current_user.id))
    return {"ok": True, "task_id": result.id, "message": "Synchronisation planifiée"}
