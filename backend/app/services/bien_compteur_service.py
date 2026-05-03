"""Service métier — compteurs de consommation liés à un bien (PR-A11.A.6.b).

Pattern symétrique des services BienAnnexe / BienContact.
"""

from __future__ import annotations

import uuid

from app.models.bien_compteur import BienCompteur
from app.models.user import User
from app.schemas.bien import BienCompteurCreate, BienCompteurUpdate
from app.services.bien_service import BienService, _can_write
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class BienCompteurService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_bien(self, bien_id: uuid.UUID, current_user: User) -> list[BienCompteur]:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        rows = await self.db.execute(
            select(BienCompteur)
            .where(
                BienCompteur.bien_id == bien.id,
                BienCompteur.is_active.is_(True),
            )
            .order_by(BienCompteur.created_at)
        )
        return list(rows.scalars())

    async def create(
        self,
        bien_id: uuid.UUID,
        payload: BienCompteurCreate,
        current_user: User,
    ) -> BienCompteur:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        compteur = BienCompteur(bien_id=bien.id, **payload.model_dump())
        self.db.add(compteur)
        await self.db.flush()
        await self.db.refresh(compteur)
        return compteur

    async def update(
        self,
        bien_id: uuid.UUID,
        compteur_id: uuid.UUID,
        payload: BienCompteurUpdate,
        current_user: User,
    ) -> BienCompteur | None:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        compteur = await self._get(bien.id, compteur_id)
        if compteur is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(compteur, field, value)
        await self.db.flush()
        await self.db.refresh(compteur)
        return compteur

    async def delete(
        self,
        bien_id: uuid.UUID,
        compteur_id: uuid.UUID,
        current_user: User,
    ) -> bool:
        bien = await BienService(self.db)._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        compteur = await self._get(bien.id, compteur_id)
        if compteur is None:
            return False
        compteur.is_active = False
        await self.db.flush()
        return True

    async def _get(self, bien_id: uuid.UUID, compteur_id: uuid.UUID) -> BienCompteur | None:
        row = await self.db.execute(
            select(BienCompteur).where(
                BienCompteur.id == compteur_id,
                BienCompteur.bien_id == bien_id,
                BienCompteur.is_active.is_(True),
            )
        )
        return row.scalar_one_or_none()
