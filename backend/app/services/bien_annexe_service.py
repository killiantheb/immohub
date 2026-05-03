"""Service métier — annexes liées à un bien (PR-A11.A.6.b).

Pattern aligné sur `bien_service.update_image` : check `_can_write` du bien
parent (proprio / agency / created_by / super_admin), opérations CRUD avec
flush + refresh, soft delete via `is_active=False`.
"""

from __future__ import annotations

import uuid

from app.models.bien_annexe import BienAnnexe
from app.models.user import User
from app.schemas.bien import BienAnnexeCreate, BienAnnexeUpdate
from app.services.bien_service import BienService, _can_write
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class BienAnnexeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_bien(self, bien_id: uuid.UUID, current_user: User) -> list[BienAnnexe]:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            # Lecture autorisée pour les mêmes rôles que l'écriture en P1
            # (cohérent avec BienDetail qui expose ces relations à tout
            # qui peut lire le bien — l'access détail est déjà géré par
            # `BienService.get_detail`).
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        rows = await self.db.execute(
            select(BienAnnexe)
            .where(
                BienAnnexe.bien_id == bien.id,
                BienAnnexe.is_active.is_(True),
            )
            .order_by(BienAnnexe.created_at)
        )
        return list(rows.scalars())

    async def create(
        self,
        bien_id: uuid.UUID,
        payload: BienAnnexeCreate,
        current_user: User,
    ) -> BienAnnexe:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        annexe = BienAnnexe(bien_id=bien.id, **payload.model_dump())
        self.db.add(annexe)
        await self.db.flush()
        await self.db.refresh(annexe)
        return annexe

    async def update(
        self,
        bien_id: uuid.UUID,
        annexe_id: uuid.UUID,
        payload: BienAnnexeUpdate,
        current_user: User,
    ) -> BienAnnexe | None:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        annexe = await self._get(bien.id, annexe_id)
        if annexe is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(annexe, field, value)
        await self.db.flush()
        await self.db.refresh(annexe)
        return annexe

    async def delete(
        self,
        bien_id: uuid.UUID,
        annexe_id: uuid.UUID,
        current_user: User,
    ) -> bool:
        """Soft delete (`is_active=False`)."""
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        annexe = await self._get(bien.id, annexe_id)
        if annexe is None:
            return False
        annexe.is_active = False
        await self.db.flush()
        return True

    async def _get(self, bien_id: uuid.UUID, annexe_id: uuid.UUID) -> BienAnnexe | None:
        row = await self.db.execute(
            select(BienAnnexe).where(
                BienAnnexe.id == annexe_id,
                BienAnnexe.bien_id == bien_id,
                BienAnnexe.is_active.is_(True),
            )
        )
        return row.scalar_one_or_none()
