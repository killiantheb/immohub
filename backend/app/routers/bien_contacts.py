"""Router FastAPI — /api/v1/biens/{bien_id}/contacts (PR-A11.A.6.b).

CRUD pour les contacts externes (régie tierce, syndic, concierge, garant,
voisins clés) liés à un bien.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import (
    BienContactCreate,
    BienContactRead,
    BienContactUpdate,
)
from app.services.bien_contact_service import BienContactService
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get(
    "/{bien_id}/contacts",
    response_model=list[BienContactRead],
)
async def list_contacts(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[BienContactRead]:
    rows = await BienContactService(db).list_by_bien(bien_id, current_user)
    return [BienContactRead.model_validate(r) for r in rows]


@router.post(
    "/{bien_id}/contacts",
    response_model=BienContactRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    bien_id: uuid.UUID,
    payload: BienContactCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienContactRead:
    contact = await BienContactService(db).create(bien_id, payload, current_user)
    return BienContactRead.model_validate(contact)


@router.patch(
    "/{bien_id}/contacts/{contact_id}",
    response_model=BienContactRead,
)
async def update_contact(
    bien_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: BienContactUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienContactRead:
    contact = await BienContactService(db).update(bien_id, contact_id, payload, current_user)
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact introuvable")
    return BienContactRead.model_validate(contact)


@router.delete(
    "/{bien_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_contact(
    bien_id: uuid.UUID,
    contact_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienContactService(db).delete(bien_id, contact_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact introuvable")
