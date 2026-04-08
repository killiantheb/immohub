"""Router FastAPI — /api/v1/missions-ouvreurs + /profiles-ouvreurs."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mission_ouvreur import MissionOuvreur, ProfileOuvreur
from app.models.user import User
from app.services.geocoding import geocode
from app.schemas.mission_ouvreur import (
    MissionOuvreurCreate,
    MissionOuvreurRead,
    MissionOuvreurUpdate,
    ProfileOuvreurCreate,
    ProfileOuvreurRead,
    ProfileOuvreurUpdate,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ══════════════════════════════════════════════════════════════════════════════
# Missions ouvreurs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/missions", response_model=list[MissionOuvreurRead])
async def list_missions(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    ouvreur_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[MissionOuvreurRead]:
    q = select(MissionOuvreur)
    if bien_id:
        q = q.where(MissionOuvreur.bien_id == bien_id)
    if statut:
        q = q.where(MissionOuvreur.statut == statut)
    if ouvreur_id:
        q = q.where(MissionOuvreur.ouvreur_id == ouvreur_id)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [MissionOuvreurRead.model_validate(r) for r in rows.scalars()]


@router.post("/missions", response_model=MissionOuvreurRead, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload: MissionOuvreurCreate,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    m = MissionOuvreur(**payload.model_dump())
    db.add(m)
    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


@router.get("/missions/{mission_id}", response_model=MissionOuvreurRead)
async def get_mission(
    mission_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    return MissionOuvreurRead.model_validate(m)


@router.patch("/missions/{mission_id}", response_model=MissionOuvreurRead)
async def update_mission(
    mission_id: uuid.UUID,
    payload: MissionOuvreurUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> MissionOuvreurRead:
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    await db.flush()
    await db.refresh(m)
    return MissionOuvreurRead.model_validate(m)


@router.delete("/missions/{mission_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_mission(
    mission_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(MissionOuvreur).where(MissionOuvreur.id == mission_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission introuvable")
    await db.delete(m)


# ══════════════════════════════════════════════════════════════════════════════
# Profiles ouvreurs
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/profiles", response_model=list[ProfileOuvreurRead])
async def list_profiles(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[ProfileOuvreurRead]:
    q = select(ProfileOuvreur).offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [ProfileOuvreurRead.model_validate(r) for r in rows.scalars()]


@router.post("/profiles", response_model=ProfileOuvreurRead, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ProfileOuvreurCreate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileOuvreurRead:
    p = ProfileOuvreur(**payload.model_dump())
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return ProfileOuvreurRead.model_validate(p)


@router.get("/profiles/me", response_model=ProfileOuvreurRead)
async def get_my_profile(
    current_user: AuthDep,
    db: DbDep,
) -> ProfileOuvreurRead:
    result = await db.execute(select(ProfileOuvreur).where(ProfileOuvreur.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil introuvable")
    return ProfileOuvreurRead.model_validate(p)


@router.patch("/profiles/me", response_model=ProfileOuvreurRead)
async def update_my_profile(
    payload: ProfileOuvreurUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileOuvreurRead:
    result = await db.execute(select(ProfileOuvreur).where(ProfileOuvreur.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil introuvable")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(p, field, value)

    # Auto-géocode si lat/lng absents et que l'utilisateur a une adresse
    if p.lat is None or p.lng is None:
        if current_user.adresse:
            coords = await geocode(current_user.adresse)
            if coords:
                p.lat, p.lng = coords

    await db.flush()
    await db.refresh(p)
    return ProfileOuvreurRead.model_validate(p)
