"""Router FastAPI — /api/v1/profiles-artisans."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.profile_artisan import ProfileArtisan
from app.models.user import User
from app.schemas.profile_artisan import ProfileArtisanCreate, ProfileArtisanRead, ProfileArtisanUpdate
from app.services.geocoding import geocode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=list[ProfileArtisanRead])
async def list_profiles(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[ProfileArtisanRead]:
    q = select(ProfileArtisan).offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [ProfileArtisanRead.model_validate(r) for r in rows.scalars()]


@router.post("", response_model=ProfileArtisanRead, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ProfileArtisanCreate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    p = ProfileArtisan(**payload.model_dump())
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return ProfileArtisanRead.model_validate(p)


@router.get("/me", response_model=ProfileArtisanRead)
async def get_my_profile(
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    result = await db.execute(select(ProfileArtisan).where(ProfileArtisan.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
    return ProfileArtisanRead.model_validate(p)


@router.patch("/me", response_model=ProfileArtisanRead)
async def update_my_profile(
    payload: ProfileArtisanUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    result = await db.execute(select(ProfileArtisan).where(ProfileArtisan.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
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
    return ProfileArtisanRead.model_validate(p)


@router.get("/{profile_id}", response_model=ProfileArtisanRead)
async def get_profile(
    profile_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    result = await db.execute(select(ProfileArtisan).where(ProfileArtisan.id == profile_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
    return ProfileArtisanRead.model_validate(p)
