"""Router FastAPI — /api/v1/biens."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.user import User
from app.schemas.bien import BienCreate, BienRead, BienUpdate
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

ALLOWED_OWNER_ROLES = {"admin", "proprietaire", "agence", "owner", "agency", "super_admin"}


def _assert_can_read_bien(bien: Bien, user: User) -> None:
    if user.role in ("admin", "super_admin"):
        return
    if bien.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")


def _assert_can_write_bien(bien: Bien, user: User) -> None:
    if user.role in ("admin", "super_admin"):
        return
    if bien.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Modification refusée")


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[BienRead])
async def list_biens(
    current_user: AuthDep,
    db: DbDep,
    statut: str | None = Query(None),
    ville: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[BienRead]:
    q = select(Bien)
    if current_user.role not in ("admin", "super_admin"):
        q = q.where(Bien.owner_id == current_user.id)
    if statut:
        q = q.where(Bien.statut == statut)
    if ville:
        q = q.where(Bien.ville.ilike(f"%{ville}%"))
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [BienRead.model_validate(r) for r in rows.scalars()]


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=BienRead, status_code=status.HTTP_201_CREATED)
async def create_bien(
    payload: BienCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    if current_user.role not in ALLOWED_OWNER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Rôle insuffisant")
    bien = Bien(**payload.model_dump())
    db.add(bien)
    await db.flush()
    await db.refresh(bien)
    return BienRead.model_validate(bien)


# ── Read ──────────────────────────────────────────────────────────────────────

@router.get("/{bien_id}", response_model=BienRead)
async def get_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_read_bien(bien, current_user)
    return BienRead.model_validate(bien)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{bien_id}", response_model=BienRead)
async def update_bien(
    bien_id: uuid.UUID,
    payload: BienUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_write_bien(bien, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bien, field, value)
    await db.flush()
    await db.refresh(bien)
    return BienRead.model_validate(bien)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(Bien).where(Bien.id == bien_id))
    bien = result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    _assert_can_write_bien(bien, current_user)
    await db.delete(bien)
