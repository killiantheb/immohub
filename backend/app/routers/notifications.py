"""Router FastAPI — /api/v1/notifications."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationCreate, NotificationRead, NotificationUpdate
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("/", response_model=list[NotificationRead])
async def list_notifications(
    current_user: AuthDep,
    db: DbDep,
    lu: bool | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> list[NotificationRead]:
    q = select(Notification).where(Notification.user_id == current_user.id)
    if lu is not None:
        q = q.where(Notification.lu == lu)
    q = q.order_by(Notification.created_at.desc()).offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [NotificationRead.model_validate(r) for r in rows.scalars()]


@router.post("/", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreate,
    current_user: AuthDep,
    db: DbDep,
) -> NotificationRead:
    # Seuls admins/système peuvent créer des notifs pour d'autres users
    if str(payload.user_id) != str(current_user.id) and current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    n = Notification(**payload.model_dump())
    db.add(n)
    await db.flush()
    await db.refresh(n)
    return NotificationRead.model_validate(n)


@router.patch("/{notif_id}", response_model=NotificationRead)
async def update_notification(
    notif_id: uuid.UUID,
    payload: NotificationUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> NotificationRead:
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification introuvable")
    if n.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(n, field, value)
    await db.flush()
    await db.refresh(n)
    return NotificationRead.model_validate(n)


@router.post("/mark-all-read", response_model=None, status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: AuthDep,
    db: DbDep,
) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.lu.is_(False))
        .values(lu=True)
    )


@router.delete("/{notif_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_notification(
    notif_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification introuvable")
    if n.user_id != current_user.id and current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    await db.delete(n)
