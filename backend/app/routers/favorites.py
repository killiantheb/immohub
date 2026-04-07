"""Favoris — biens sauvegardés par un locataire."""

from __future__ import annotations

import uuid as uuid_lib
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.favorite import Favorite
from app.models.property import Property
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


class FavoriteCreate(BaseModel):
    property_id: str
    notes: str | None = None


class FavoriteRead(BaseModel):
    id: str
    property_id: str
    notes: str | None
    created_at: str
    # Données bien dénormalisées pour l'affichage
    property_address: str | None = None
    property_city: str | None = None
    property_type: str | None = None
    monthly_rent: float | None = None
    rooms: int | None = None
    surface: float | None = None
    property_status: str | None = None


@router.get("/", response_model=list[FavoriteRead])
async def list_favorites(
    db: DbDep,
    current_user: AuthUserDep,
) -> list[FavoriteRead]:
    """Liste les biens favoris de l'utilisateur connecté."""
    result = await db.execute(
        select(Favorite)
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    )
    favorites = result.scalars().all()

    out = []
    for fav in favorites:
        prop_result = await db.execute(select(Property).where(Property.id == fav.property_id))
        prop = prop_result.scalar_one_or_none()
        out.append(
            FavoriteRead(
                id=str(fav.id),
                property_id=str(fav.property_id),
                notes=fav.notes,
                created_at=fav.created_at.isoformat(),
                property_address=prop.address if prop else None,
                property_city=prop.city if prop else None,
                property_type=prop.type if prop else None,
                monthly_rent=float(prop.monthly_rent) if prop and prop.monthly_rent else None,
                rooms=float(prop.rooms) if prop and prop.rooms else None,
                surface=float(prop.surface) if prop and prop.surface else None,
                property_status=prop.status if prop else None,
            )
        )
    return out


@router.post("/", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    payload: FavoriteCreate,
    db: DbDep,
    current_user: AuthUserDep,
) -> FavoriteRead:
    """Ajoute un bien aux favoris."""
    prop_id = uuid_lib.UUID(payload.property_id)

    # Vérifie que le bien existe
    prop_result = await db.execute(select(Property).where(Property.id == prop_id))
    prop = prop_result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")

    # Unicité
    existing = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.property_id == prop_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Déjà dans vos favoris")

    fav = Favorite(
        id=uuid_lib.uuid4(),
        user_id=current_user.id,
        property_id=prop_id,
        notes=payload.notes,
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    return FavoriteRead(
        id=str(fav.id),
        property_id=str(fav.property_id),
        notes=fav.notes,
        created_at=fav.created_at.isoformat(),
        property_address=prop.address,
        property_city=prop.city,
        property_type=prop.type,
        monthly_rent=float(prop.monthly_rent) if prop.monthly_rent else None,
        rooms=float(prop.rooms) if prop.rooms else None,
        surface=float(prop.surface) if prop.surface else None,
        property_status=prop.status,
    )


@router.patch("/{favorite_id}/notes")
async def update_notes(
    favorite_id: str,
    payload: dict,
    db: DbDep,
    current_user: AuthUserDep,
) -> dict:
    """Met à jour les notes personnelles sur un favori."""
    result = await db.execute(select(Favorite).where(Favorite.id == uuid_lib.UUID(favorite_id)))
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Favori introuvable")
    if fav.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Non autorisé")
    fav.notes = payload.get("notes")
    await db.commit()
    return {"ok": True}


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    favorite_id: str,
    db: DbDep,
    current_user: AuthUserDep,
) -> None:
    """Retire un bien des favoris."""
    result = await db.execute(select(Favorite).where(Favorite.id == uuid_lib.UUID(favorite_id)))
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Favori introuvable")
    if fav.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Non autorisé")
    await db.delete(fav)
    await db.commit()
