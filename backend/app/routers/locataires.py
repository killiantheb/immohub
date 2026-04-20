"""Router FastAPI — /api/v1/locataires + /api/v1/dossiers-locataires."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.locataire import DossierLocataire, Locataire
from app.models.user import User
from app.schemas.locataire import (
    DossierLocataireCreate,
    DossierLocataireRead,
    DossierLocataireUpdate,
    LocataireCreate,
    LocataireRead,
    LocataireUpdate,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


MANAGER_ROLES = {"super_admin", "proprio_solo", "agence"}


def _check_admin(user: User) -> None:
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")


# ══════════════════════════════════════════════════════════════════════════════
# Locataires
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=list[LocataireRead])
async def list_locataires(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[LocataireRead]:
    _check_admin(current_user)
    q = select(Locataire)
    if bien_id:
        q = q.where(Locataire.bien_id == bien_id)
    if statut:
        q = q.where(Locataire.statut == statut)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [LocataireRead.model_validate(r) for r in rows.scalars()]


@router.post("", response_model=LocataireRead, status_code=status.HTTP_201_CREATED)
async def create_locataire(
    payload: LocataireCreate,
    current_user: AuthDep,
    db: DbDep,
) -> LocataireRead:
    _check_admin(current_user)
    loc = Locataire(**payload.model_dump())
    db.add(loc)
    await db.flush()
    await db.refresh(loc)
    return LocataireRead.model_validate(loc)


@router.get("/{locataire_id}", response_model=LocataireRead)
async def get_locataire(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> LocataireRead:
    result = await db.execute(select(Locataire).where(Locataire.id == locataire_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locataire introuvable")
    # Le locataire lui-même peut voir son dossier
    if current_user.role not in ("admin", "super_admin") and loc.user_id != current_user.id:
        _check_admin(current_user)
    return LocataireRead.model_validate(loc)


@router.patch("/{locataire_id}", response_model=LocataireRead)
async def update_locataire(
    locataire_id: uuid.UUID,
    payload: LocataireUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> LocataireRead:
    _check_admin(current_user)
    result = await db.execute(select(Locataire).where(Locataire.id == locataire_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locataire introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    await db.flush()
    await db.refresh(loc)
    return LocataireRead.model_validate(loc)


@router.delete("/{locataire_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_locataire(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    _check_admin(current_user)
    result = await db.execute(select(Locataire).where(Locataire.id == locataire_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locataire introuvable")
    await db.delete(loc)


# ══════════════════════════════════════════════════════════════════════════════
# Dossiers locataires
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{locataire_id}/dossier", response_model=DossierLocataireRead)
async def get_dossier(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> DossierLocataireRead:
    _check_admin(current_user)
    result = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    dossier = result.scalar_one_or_none()
    if not dossier:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dossier introuvable")
    return DossierLocataireRead.model_validate(dossier)


@router.post("/{locataire_id}/dossier", response_model=DossierLocataireRead, status_code=status.HTTP_201_CREATED)
async def create_or_replace_dossier(
    locataire_id: uuid.UUID,
    payload: DossierLocataireCreate,
    current_user: AuthDep,
    db: DbDep,
) -> DossierLocataireRead:
    _check_admin(current_user)
    # Upsert: delete existing then create
    existing = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)
        await db.flush()
    data = payload.model_dump()
    data["locataire_id"] = locataire_id
    dossier = DossierLocataire(**data)
    db.add(dossier)
    await db.flush()
    await db.refresh(dossier)
    return DossierLocataireRead.model_validate(dossier)


@router.patch("/{locataire_id}/dossier", response_model=DossierLocataireRead)
async def update_dossier(
    locataire_id: uuid.UUID,
    payload: DossierLocataireUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> DossierLocataireRead:
    _check_admin(current_user)
    result = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    dossier = result.scalar_one_or_none()
    if not dossier:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dossier introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(dossier, field, value)
    await db.flush()
    await db.refresh(dossier)
    return DossierLocataireRead.model_validate(dossier)


# ═════════════════════════════════════════════════════════════════════════════
# Retenir un candidat — validation simple (plus de prélèvement locataire)
#
# Pivot 2026-04-20 : les frais de dossier (CHF 45) sont à la charge du PROPRIÉTAIRE
# et sont prélevés lors de l'acceptation d'une candidature via
# PATCH /api/v1/marketplace/candidature/{id}. Cet endpoint ne fait plus que
# marquer le locataire comme retenu.
# ═════════════════════════════════════════════════════════════════════════════


@router.post("/{locataire_id}/retenir", summary="Valider un candidat locataire (aucun prélèvement)")
async def retenir_locataire(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """
    Valide un candidat locataire (aucun prélèvement).

    Le locataire ne paie JAMAIS rien à Althy. Les frais de dossier sont prélevés
    au propriétaire lors de PATCH /api/v1/marketplace/candidature/{id}.
    """
    _check_admin(current_user)

    result = await db.execute(select(Locataire).where(Locataire.id == locataire_id))
    locataire = result.scalar_one_or_none()
    if not locataire:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locataire introuvable")

    if locataire.statut == "actif":
        raise HTTPException(status.HTTP_409_CONFLICT, "Locataire déjà retenu")

    locataire.statut = "actif"
    await db.flush()
    await db.commit()

    return {
        "locataire_id": str(locataire_id),
        "statut": "actif",
    }
