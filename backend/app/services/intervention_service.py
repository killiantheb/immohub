"""Service métier interventions + devis (PR-A11.A.0).

Extrait depuis app/routers/interventions_althy.py — anti-pattern qui mettait
toute la logique inline dans le router. Pattern aligné sur bien_service.py.

Ce commit (refactor) ne change PAS le comportement : pas encore de permission
checks (cf commit suivant AX-01), pas encore de fix enum (cf commit AX-02).
"""

from __future__ import annotations

import uuid
from typing import Optional

from app.models.intervention import Devis, Intervention
from app.models.user import User
from app.schemas.intervention import (
    DevisCreate,
    DevisUpdate,
    InterventionCreate,
    InterventionUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class InterventionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # Interventions
    # ─────────────────────────────────────────────────────────────────────────

    async def list_interventions(
        self,
        current_user: User,
        *,
        bien_id: Optional[uuid.UUID] = None,
        statut: Optional[str] = None,
        urgence: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> list[Intervention]:
        q = select(Intervention)
        if bien_id:
            q = q.where(Intervention.bien_id == bien_id)
        if statut:
            q = q.where(Intervention.statut == statut)
        if urgence:
            q = q.where(Intervention.urgence == urgence)
        q = q.offset((page - 1) * size).limit(size)
        rows = await self.db.execute(q)
        return list(rows.scalars())

    async def get_intervention(
        self, current_user: User, intervention_id: uuid.UUID
    ) -> Intervention:
        inter = await self._get_or_404(intervention_id)
        return inter

    async def create_intervention(
        self, current_user: User, payload: InterventionCreate
    ) -> Intervention:
        data = payload.model_dump()
        data["signale_par_id"] = current_user.id
        inter = Intervention(**data)
        self.db.add(inter)
        await self.db.flush()
        await self.db.refresh(inter)
        return inter

    async def update_intervention(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        payload: InterventionUpdate,
    ) -> Intervention:
        inter = await self._get_or_404(intervention_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(inter, field, value)
        await self.db.flush()
        await self.db.refresh(inter)
        return inter

    async def delete_intervention(
        self, current_user: User, intervention_id: uuid.UUID
    ) -> None:
        inter = await self._get_or_404(intervention_id)
        await self.db.delete(inter)

    # ─────────────────────────────────────────────────────────────────────────
    # Devis (sous-ressource)
    # ─────────────────────────────────────────────────────────────────────────

    async def list_devis(
        self, current_user: User, intervention_id: uuid.UUID
    ) -> list[Devis]:
        await self._get_or_404(intervention_id)
        rows = await self.db.execute(
            select(Devis).where(Devis.intervention_id == intervention_id)
        )
        return list(rows.scalars())

    async def create_devis(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        payload: DevisCreate,
    ) -> Devis:
        await self._get_or_404(intervention_id)
        data = payload.model_dump()
        data["intervention_id"] = intervention_id
        d = Devis(**data)
        self.db.add(d)
        await self.db.flush()
        await self.db.refresh(d)
        return d

    async def update_devis(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        devis_id: uuid.UUID,
        payload: DevisUpdate,
    ) -> Devis:
        await self._get_or_404(intervention_id)
        d = await self._get_devis_or_404(intervention_id, devis_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(d, field, value)
        await self.db.flush()
        await self.db.refresh(d)
        return d

    async def delete_devis(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        devis_id: uuid.UUID,
    ) -> None:
        await self._get_or_404(intervention_id)
        d = await self._get_devis_or_404(intervention_id, devis_id)
        await self.db.delete(d)

    # ─────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _get_or_404(self, intervention_id: uuid.UUID) -> Intervention:
        result = await self.db.execute(
            select(Intervention).where(Intervention.id == intervention_id)
        )
        inter = result.scalar_one_or_none()
        if inter is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Intervention introuvable"
            )
        return inter

    async def _get_devis_or_404(
        self, intervention_id: uuid.UUID, devis_id: uuid.UUID
    ) -> Devis:
        result = await self.db.execute(
            select(Devis).where(
                Devis.id == devis_id,
                Devis.intervention_id == intervention_id,
            )
        )
        d = result.scalar_one_or_none()
        if d is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Devis introuvable")
        return d
