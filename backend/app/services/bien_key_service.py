"""Service métier — clés / badges liées à un bien (PR-A11.A.6.d).

Pattern aligné `BienAnnexeService` : check `_can_write` du bien parent
(proprio / agency / created_by / super_admin), CRUD avec flush + refresh,
soft delete via `is_active=False`.

Spécificité : à chaque create / delete, on recalcule `bien.keys_count` via
`COUNT(*) WHERE is_active = true`. Le champ scalaire est conservé pour
l'affichage rapide (catalogue 7-CATALOGUE l. 396) mais la source de vérité
est désormais la table `bien_keys`.
"""

from __future__ import annotations

import uuid

from app.models.bien import Bien
from app.models.bien_key import BienKey
from app.models.user import User
from app.schemas.bien import BienKeyCreate, BienKeyUpdate
from app.services.bien_service import BienService, _can_write
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class BienKeyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_bien(self, bien_id: uuid.UUID, current_user: User) -> list[BienKey]:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        rows = await self.db.execute(
            select(BienKey)
            .where(
                BienKey.bien_id == bien.id,
                BienKey.is_active.is_(True),
            )
            .order_by(BienKey.created_at)
        )
        return list(rows.scalars())

    async def create(
        self,
        bien_id: uuid.UUID,
        payload: BienKeyCreate,
        current_user: User,
    ) -> BienKey:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        key = BienKey(bien_id=bien.id, **payload.model_dump())
        self.db.add(key)
        await self.db.flush()
        await self._recompute_keys_count(bien)
        await self.db.flush()
        await self.db.refresh(key)
        return key

    async def update(
        self,
        bien_id: uuid.UUID,
        key_id: uuid.UUID,
        payload: BienKeyUpdate,
        current_user: User,
    ) -> BienKey | None:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        key = await self._get(bien.id, key_id)
        if key is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(key, field, value)
        await self.db.flush()
        await self.db.refresh(key)
        return key

    async def delete(
        self,
        bien_id: uuid.UUID,
        key_id: uuid.UUID,
        current_user: User,
    ) -> bool:
        """Soft delete (`is_active=False`) + recompute `bien.keys_count`."""
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        key = await self._get(bien.id, key_id)
        if key is None:
            return False
        key.is_active = False
        await self.db.flush()
        await self._recompute_keys_count(bien)
        await self.db.flush()
        return True

    async def _get(self, bien_id: uuid.UUID, key_id: uuid.UUID) -> BienKey | None:
        row = await self.db.execute(
            select(BienKey).where(
                BienKey.id == key_id,
                BienKey.bien_id == bien_id,
                BienKey.is_active.is_(True),
            )
        )
        return row.scalar_one_or_none()

    async def _recompute_keys_count(self, bien: Bien) -> None:
        """Aligne `bien.keys_count` sur le COUNT actuel des BienKey actifs."""
        count = await self.db.scalar(
            select(func.count(BienKey.id)).where(
                BienKey.bien_id == bien.id,
                BienKey.is_active.is_(True),
            )
        )
        bien.keys_count = int(count or 0)
