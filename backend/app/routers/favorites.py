"""Favoris — biens sauvegardés par un locataire."""

from __future__ import annotations

import uuid as uuid_lib
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.favorite import Favorite
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


class FavoriteCreate(BaseModel):
    bien_id: str
    notes: str | None = None


class FavoriteRead(BaseModel):
    id: str
    bien_id: str
    notes: str | None
    created_at: str
    # Données bien dénormalisées pour l'affichage
    bien_adresse: str | None = None
    bien_ville: str | None = None
    bien_type: str | None = None
    loyer: float | None = None
    rooms: float | None = None
    surface: float | None = None
    bien_statut: str | None = None


@router.get("", response_model=list[FavoriteRead])
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
        bien_result = await db.execute(select(Bien).where(Bien.id == fav.bien_id))
        bien = bien_result.scalar_one_or_none()
        out.append(
            FavoriteRead(
                id=str(fav.id),
                bien_id=str(fav.bien_id),
                notes=fav.notes,
                created_at=fav.created_at.isoformat(),
                bien_adresse=bien.adresse if bien else None,
                bien_ville=bien.ville if bien else None,
                bien_type=bien.type if bien else None,
                loyer=float(bien.loyer) if bien and bien.loyer else None,
                rooms=float(bien.rooms) if bien and bien.rooms else None,
                surface=float(bien.surface) if bien and bien.surface else None,
                bien_statut=bien.statut if bien else None,
            )
        )
    return out


@router.post("", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    payload: FavoriteCreate,
    db: DbDep,
    current_user: AuthUserDep,
) -> FavoriteRead:
    """Ajoute un bien aux favoris."""
    bien_uuid = uuid_lib.UUID(payload.bien_id)

    # Vérifie que le bien existe
    bien_result = await db.execute(select(Bien).where(Bien.id == bien_uuid))
    bien = bien_result.scalar_one_or_none()
    if not bien:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")

    # Unicité
    existing = await db.execute(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.bien_id == bien_uuid,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Déjà dans vos favoris")

    fav = Favorite(
        id=uuid_lib.uuid4(),
        user_id=current_user.id,
        bien_id=bien_uuid,
        notes=payload.notes,
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    return FavoriteRead(
        id=str(fav.id),
        bien_id=str(fav.bien_id),
        notes=fav.notes,
        created_at=fav.created_at.isoformat(),
        bien_adresse=bien.adresse,
        bien_ville=bien.ville,
        bien_type=bien.type,
        loyer=float(bien.loyer) if bien.loyer else None,
        rooms=float(bien.rooms) if bien.rooms else None,
        surface=float(bien.surface) if bien.surface else None,
        bien_statut=bien.statut,
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


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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
