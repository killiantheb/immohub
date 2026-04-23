"""Catalogue service — lecture du catalogue global des équipements.

Le catalogue est seedé dans la migration 0029 (49 items répartis en 7 catégories :
cuisine, literie, salle_bain, tech, loisirs, entretien, confort).

Pas d'endpoint de modification côté user : seul un super_admin peut enrichir
le catalogue via SQL direct ou une future admin UI.
"""

from __future__ import annotations

from app.models.bien import CatalogueEquipement
from app.schemas.bien import CatalogueEquipementRead
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class CatalogueService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, categorie: str | None = None) -> list[CatalogueEquipementRead]:
        """Retourne tous les équipements actifs, groupés implicitement par categorie
        via ordre_affichage croissant.
        """
        q = select(CatalogueEquipement).where(CatalogueEquipement.is_active.is_(True))
        if categorie:
            q = q.where(CatalogueEquipement.categorie == categorie)
        q = q.order_by(
            CatalogueEquipement.categorie,
            CatalogueEquipement.ordre_affichage,
        )
        rows = (await self.db.execute(q)).scalars().all()
        return [CatalogueEquipementRead.model_validate(r) for r in rows]
