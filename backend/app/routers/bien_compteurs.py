"""Router FastAPI — /api/v1/biens/{bien_id}/compteurs (PR-A11.A.6.b).

CRUD pour les compteurs de consommation (eau, électricité, gaz, mazout,
chauffage) liés à un bien.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import (
    BienCompteurCreate,
    BienCompteurRead,
    BienCompteurUpdate,
)
from app.services.bien_compteur_service import BienCompteurService
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get(
    "/{bien_id}/compteurs",
    response_model=list[BienCompteurRead],
)
async def list_compteurs(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[BienCompteurRead]:
    rows = await BienCompteurService(db).list_by_bien(bien_id, current_user)
    return [BienCompteurRead.model_validate(r) for r in rows]


@router.post(
    "/{bien_id}/compteurs",
    response_model=BienCompteurRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_compteur(
    bien_id: uuid.UUID,
    payload: BienCompteurCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienCompteurRead:
    compteur = await BienCompteurService(db).create(bien_id, payload, current_user)
    return BienCompteurRead.model_validate(compteur)


@router.patch(
    "/{bien_id}/compteurs/{compteur_id}",
    response_model=BienCompteurRead,
)
async def update_compteur(
    bien_id: uuid.UUID,
    compteur_id: uuid.UUID,
    payload: BienCompteurUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienCompteurRead:
    compteur = await BienCompteurService(db).update(bien_id, compteur_id, payload, current_user)
    if compteur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compteur introuvable")
    return BienCompteurRead.model_validate(compteur)


@router.delete(
    "/{bien_id}/compteurs/{compteur_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_compteur(
    bien_id: uuid.UUID,
    compteur_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienCompteurService(db).delete(bien_id, compteur_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compteur introuvable")
