"""Router FastAPI — /api/v1/biens/{bien_id}/annexes (PR-A11.A.6.b).

CRUD pour les annexes (caves, parkings, places, garages, box, grenier)
liées à un bien. Pattern aligné sur les routes images existantes.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import (
    BienAnnexeCreate,
    BienAnnexeRead,
    BienAnnexeUpdate,
)
from app.services.bien_annexe_service import BienAnnexeService
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get(
    "/{bien_id}/annexes",
    response_model=list[BienAnnexeRead],
)
async def list_annexes(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[BienAnnexeRead]:
    rows = await BienAnnexeService(db).list_by_bien(bien_id, current_user)
    return [BienAnnexeRead.model_validate(r) for r in rows]


@router.post(
    "/{bien_id}/annexes",
    response_model=BienAnnexeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_annexe(
    bien_id: uuid.UUID,
    payload: BienAnnexeCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienAnnexeRead:
    annexe = await BienAnnexeService(db).create(bien_id, payload, current_user)
    return BienAnnexeRead.model_validate(annexe)


@router.patch(
    "/{bien_id}/annexes/{annexe_id}",
    response_model=BienAnnexeRead,
)
async def update_annexe(
    bien_id: uuid.UUID,
    annexe_id: uuid.UUID,
    payload: BienAnnexeUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienAnnexeRead:
    annexe = await BienAnnexeService(db).update(bien_id, annexe_id, payload, current_user)
    if annexe is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Annexe introuvable")
    return BienAnnexeRead.model_validate(annexe)


@router.delete(
    "/{bien_id}/annexes/{annexe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_annexe(
    bien_id: uuid.UUID,
    annexe_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienAnnexeService(db).delete(bien_id, annexe_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Annexe introuvable")
