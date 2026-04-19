"""Router FastAPI — /api/v1/scoring."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.scoring import ScoringLocataire
from app.models.user import User
from app.schemas.scoring import ScoringLocataireCreate, ScoringLocataireRead, ScoringLocataireUpdate
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

ADMIN_ROLES = {"super_admin", "proprio_solo", "agence"}


def _compute_global(
    ponctualite: float,
    solvabilite: float,
    communication: float,
    etat_logement: float,
) -> float:
    return round((ponctualite + solvabilite + communication + etat_logement) / 4, 2)


@router.get("/{locataire_id}", response_model=ScoringLocataireRead)
async def get_scoring(
    locataire_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ScoringLocataireRead:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    result = await db.execute(
        select(ScoringLocataire).where(ScoringLocataire.locataire_id == locataire_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scoring introuvable")
    return ScoringLocataireRead.model_validate(s)


@router.post("", response_model=ScoringLocataireRead, status_code=status.HTTP_201_CREATED)
async def create_scoring(
    payload: ScoringLocataireCreate,
    current_user: AuthDep,
    db: DbDep,
) -> ScoringLocataireRead:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    data = payload.model_dump()
    data["score_global"] = _compute_global(
        data["ponctualite"], data["solvabilite"], data["communication"], data["etat_logement"]
    )
    data["updated_at"] = datetime.now(timezone.utc)
    s = ScoringLocataire(**data)
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return ScoringLocataireRead.model_validate(s)


@router.patch("/{locataire_id}", response_model=ScoringLocataireRead)
async def update_scoring(
    locataire_id: uuid.UUID,
    payload: ScoringLocataireUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> ScoringLocataireRead:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    result = await db.execute(
        select(ScoringLocataire).where(ScoringLocataire.locataire_id == locataire_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scoring introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    s.score_global = _compute_global(s.ponctualite, s.solvabilite, s.communication, s.etat_logement)
    s.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(s)
    return ScoringLocataireRead.model_validate(s)
