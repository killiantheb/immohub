"""Système de notation universel — locataires, entreprises, ouvreurs, assurances."""

from __future__ import annotations

import uuid as uuid_lib
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.rating import Rating
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


class RatingCreate(BaseModel):
    entity_type: str  # "user" | "company" | "property" | "mission"
    entity_id: str
    score: int = Field(..., ge=1, le=5)
    comment: str | None = None
    contract_id: str | None = None
    rfq_id: str | None = None
    mission_id: str | None = None


class RatingRead(BaseModel):
    id: str
    rater_id: str
    rater_role: str
    entity_type: str
    entity_id: str
    score: int
    comment: str | None
    created_at: str

    model_config = {"from_attributes": True}


class RatingSummary(BaseModel):
    entity_type: str
    entity_id: str
    avg_score: float
    count: int
    ratings: list[RatingRead]


@router.post("", response_model=RatingRead, status_code=status.HTTP_201_CREATED)
async def create_rating(
    payload: RatingCreate,
    db: DbDep,
    current_user: AuthUserDep,
) -> RatingRead:
    """Dépose une note sur une entité."""
    entity_uuid = uuid_lib.UUID(payload.entity_id)

    # Vérifier qu'on n'a pas déjà noté cette entité (1 note max par rater/entity)
    existing = await db.execute(
        select(Rating).where(
            Rating.rater_id == current_user.id,
            Rating.entity_type == payload.entity_type,
            Rating.entity_id == entity_uuid,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Vous avez déjà noté cette entité")

    rating = Rating(
        id=uuid_lib.uuid4(),
        rater_id=current_user.id,
        rater_role=current_user.role,
        entity_type=payload.entity_type,
        entity_id=entity_uuid,
        score=payload.score,
        comment=payload.comment,
        contract_id=uuid_lib.UUID(payload.contract_id) if payload.contract_id else None,
        rfq_id=uuid_lib.UUID(payload.rfq_id) if payload.rfq_id else None,
        mission_id=uuid_lib.UUID(payload.mission_id) if payload.mission_id else None,
    )
    db.add(rating)
    await db.commit()
    await db.refresh(rating)
    return RatingRead(
        id=str(rating.id),
        rater_id=str(rating.rater_id),
        rater_role=rating.rater_role,
        entity_type=rating.entity_type,
        entity_id=str(rating.entity_id),
        score=rating.score,
        comment=rating.comment,
        created_at=rating.created_at.isoformat(),
    )


@router.get("/{entity_type}/{entity_id}", response_model=RatingSummary)
async def get_ratings(
    entity_type: str,
    entity_id: str,
    db: DbDep,
    current_user: AuthUserDep,
    limit: int = Query(20, ge=1, le=100),
) -> RatingSummary:
    """Récupère les notes et la moyenne d'une entité."""
    entity_uuid = uuid_lib.UUID(entity_id)

    result = await db.execute(
        select(Rating)
        .where(Rating.entity_type == entity_type, Rating.entity_id == entity_uuid)
        .order_by(Rating.created_at.desc())
        .limit(limit)
    )
    ratings = result.scalars().all()

    avg_result = await db.execute(
        select(func.avg(Rating.score), func.count(Rating.id))
        .where(Rating.entity_type == entity_type, Rating.entity_id == entity_uuid)
    )
    avg_score_raw, count = avg_result.one()
    avg_score = float(avg_score_raw) if avg_score_raw else 0.0

    return RatingSummary(
        entity_type=entity_type,
        entity_id=entity_id,
        avg_score=round(avg_score, 2),
        count=count or 0,
        ratings=[
            RatingRead(
                id=str(r.id),
                rater_id=str(r.rater_id),
                rater_role=r.rater_role,
                entity_type=r.entity_type,
                entity_id=str(r.entity_id),
                score=r.score,
                comment=r.comment,
                created_at=r.created_at.isoformat(),
            )
            for r in ratings
        ],
    )


@router.delete("/{rating_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_rating(
    rating_id: str,
    db: DbDep,
    current_user: AuthUserDep,
) -> None:
    """Supprime sa propre note."""
    result = await db.execute(select(Rating).where(Rating.id == uuid_lib.UUID(rating_id)))
    rating = result.scalar_one_or_none()
    if not rating:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note introuvable")
    if rating.rater_id != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Non autorisé")
    await db.delete(rating)
    await db.commit()
