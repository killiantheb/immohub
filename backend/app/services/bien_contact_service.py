"""Service métier — contacts externes liés à un bien (PR-A11.A.6.b).

Pattern symétrique de `BienAnnexeService` : check `_can_write` parent,
CRUD + soft delete via `is_active=False`.
"""

from __future__ import annotations

import uuid

from app.models.bien_contact import BienContact
from app.models.user import User
from app.schemas.bien import BienContactCreate, BienContactUpdate
from app.services.bien_service import BienService, _can_write
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class BienContactService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_bien(self, bien_id: uuid.UUID, current_user: User) -> list[BienContact]:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        rows = await self.db.execute(
            select(BienContact)
            .where(
                BienContact.bien_id == bien.id,
                BienContact.is_active.is_(True),
            )
            .order_by(BienContact.created_at)
        )
        return list(rows.scalars())

    async def create(
        self,
        bien_id: uuid.UUID,
        payload: BienContactCreate,
        current_user: User,
    ) -> BienContact:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        contact = BienContact(bien_id=bien.id, **payload.model_dump())
        self.db.add(contact)
        await self.db.flush()
        await self.db.refresh(contact)
        return contact

    async def update(
        self,
        bien_id: uuid.UUID,
        contact_id: uuid.UUID,
        payload: BienContactUpdate,
        current_user: User,
    ) -> BienContact | None:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        contact = await self._get(bien.id, contact_id)
        if contact is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(contact, field, value)
        await self.db.flush()
        await self.db.refresh(contact)
        return contact

    async def delete(
        self,
        bien_id: uuid.UUID,
        contact_id: uuid.UUID,
        current_user: User,
    ) -> bool:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        contact = await self._get(bien.id, contact_id)
        if contact is None:
            return False
        contact.is_active = False
        await self.db.flush()
        return True

    async def _get(self, bien_id: uuid.UUID, contact_id: uuid.UUID) -> BienContact | None:
        row = await self.db.execute(
            select(BienContact).where(
                BienContact.id == contact_id,
                BienContact.bien_id == bien_id,
                BienContact.is_active.is_(True),
            )
        )
        return row.scalar_one_or_none()
