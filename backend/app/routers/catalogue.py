"""Router FastAPI — /api/v1/catalogue (catalogue global des équipements)."""

from __future__ import annotations

from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import CatalogueEquipementRead
from app.services.catalogue_service import CatalogueService
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("/equipements", response_model=list[CatalogueEquipementRead])
async def list_catalogue_equipements(
    current_user: AuthDep,  # auth requise mais tous les rôles peuvent lire
    db: DbDep,
    categorie: str | None = Query(
        None, description="Filtre optionnel : cuisine, literie, salle_bain, tech, loisirs, entretien, confort"
    ),
) -> list[CatalogueEquipementRead]:
    """Liste complète des équipements disponibles (seed 0029 — 49 items).

    Utilisé pour afficher la grille/carrousel de sélection dans la fiche bien.
    """
    return await CatalogueService(db).list(categorie=categorie)
