"""Router FastAPI — /api/v1/biens/{bien_id}/keys (PR-A11.A.6.d).

CRUD pour les clés / badges / cadenas physiques liés à un bien. Pattern
aligné sur `bien_annexes.py` (même structure 4 endpoints REST nested).

Le service `BienKeyService` recompute `bien.keys_count` à chaque create /
delete pour conserver la cohérence du compteur scalaire affiché en UI.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import (
    BienKeyCreate,
    BienKeyRead,
    BienKeyUpdate,
)
from app.services.bien_key_service import BienKeyService
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get(
    "/{bien_id}/keys",
    response_model=list[BienKeyRead],
)
async def list_keys(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[BienKeyRead]:
    rows = await BienKeyService(db).list_by_bien(bien_id, current_user)
    return [BienKeyRead.model_validate(r) for r in rows]


@router.post(
    "/{bien_id}/keys",
    response_model=BienKeyRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_key(
    bien_id: uuid.UUID,
    payload: BienKeyCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienKeyRead:
    key = await BienKeyService(db).create(bien_id, payload, current_user)
    return BienKeyRead.model_validate(key)


@router.patch(
    "/{bien_id}/keys/{key_id}",
    response_model=BienKeyRead,
)
async def update_key(
    bien_id: uuid.UUID,
    key_id: uuid.UUID,
    payload: BienKeyUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienKeyRead:
    key = await BienKeyService(db).update(bien_id, key_id, payload, current_user)
    if key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Clé introuvable")
    return BienKeyRead.model_validate(key)


@router.delete(
    "/{bien_id}/keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_key(
    bien_id: uuid.UUID,
    key_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienKeyService(db).delete(bien_id, key_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Clé introuvable")
