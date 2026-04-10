"""Agenda — /api/v1/agenda

Lecture des événements calendar depuis calendar_events.
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

router = APIRouter(prefix="/agenda", tags=["agenda"])

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("/")
async def list_events(current_user: AuthDep, db: DbDep, limit: int = 100) -> list[dict]:
    """Retourne les événements calendrier à venir (à partir d'aujourd'hui)."""
    try:
        rows = await db.execute(
            text("""
                SELECT id, title, description, location,
                       start_at, end_at, all_day, provider,
                       contexte_type, contexte_id
                FROM calendar_events
                WHERE user_id = :uid
                  AND end_at >= now()
                ORDER BY start_at ASC
                LIMIT :limit
            """),
            {"uid": current_user.id, "limit": limit},
        )
        return [
            {
                "id": str(r.id),
                "title": r.title,
                "description": r.description,
                "location": r.location,
                "start_at": r.start_at.isoformat() if r.start_at else None,
                "end_at": r.end_at.isoformat() if r.end_at else None,
                "all_day": r.all_day,
                "provider": r.provider,
                "contexte_type": r.contexte_type,
                "contexte_id": str(r.contexte_id) if r.contexte_id else None,
            }
            for r in rows
        ]
    except Exception:
        return []


@router.post("/synchroniser")
async def synchroniser(current_user: AuthDep, db: DbDep) -> dict:
    """Déclenche une synchronisation du calendrier (placeholder — traitement Celery à venir)."""
    return {"ok": True, "message": "Synchronisation planifiée"}
