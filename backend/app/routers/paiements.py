"""Router FastAPI — /api/v1/paiements."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.paiement import Paiement
from app.models.user import User
from app.schemas.paiement import PaiementCreate, PaiementRead, PaiementUpdate
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("/", response_model=list[PaiementRead])
async def list_paiements(
    current_user: AuthDep,
    db: DbDep,
    locataire_id: uuid.UUID | None = Query(None),
    bien_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    mois: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> list[PaiementRead]:
    q = select(Paiement)
    if locataire_id:
        q = q.where(Paiement.locataire_id == locataire_id)
    if bien_id:
        q = q.where(Paiement.bien_id == bien_id)
    if statut:
        q = q.where(Paiement.statut == statut)
    if mois:
        q = q.where(Paiement.mois == mois)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [PaiementRead.model_validate(r) for r in rows.scalars()]


@router.post("/", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
async def create_paiement(
    payload: PaiementCreate,
    current_user: AuthDep,
    db: DbDep,
) -> PaiementRead:
    p = Paiement(**payload.model_dump())
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return PaiementRead.model_validate(p)


@router.get("/{paiement_id}", response_model=PaiementRead)
async def get_paiement(
    paiement_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PaiementRead:
    result = await db.execute(select(Paiement).where(Paiement.id == paiement_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paiement introuvable")
    return PaiementRead.model_validate(p)


@router.patch("/{paiement_id}", response_model=PaiementRead)
async def update_paiement(
    paiement_id: uuid.UUID,
    payload: PaiementUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> PaiementRead:
    result = await db.execute(select(Paiement).where(Paiement.id == paiement_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paiement introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    await db.flush()
    await db.refresh(p)
    return PaiementRead.model_validate(p)


@router.delete("/{paiement_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_paiement(
    paiement_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(Paiement).where(Paiement.id == paiement_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paiement introuvable")
    await db.delete(p)
