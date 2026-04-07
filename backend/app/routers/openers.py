from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.opener import (
    MissionPriceEstimate,
    MissionType,
    OpenerProfileCreate,
    OpenerProfileUpdate,
    OpenerRead,
    OpenerWithDistance,
)
from app.services.opener_service import OpenerService
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


# ── Profile ───────────────────────────────────────────────────────────────────


@router.get("/me", response_model=OpenerRead)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    profile = await svc._get_my_opener_optional(user)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profil ouvreur non trouvé"
        )
    return profile


@router.put("/me", response_model=OpenerRead, status_code=status.HTTP_200_OK)
async def upsert_profile(
    payload: OpenerProfileCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.upsert_profile(payload, user)


@router.patch("/me", response_model=OpenerRead)
async def patch_profile(
    payload: OpenerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.patch_profile(payload, user)


# ── Discovery ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[OpenerWithDistance])
async def list_openers(
    lat: float = Query(..., ge=-90, le=90, description="Latitude du bien"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude du bien"),
    radius_km: float = Query(30.0, gt=0, le=200, description="Rayon de recherche en km"),
    mission_type: MissionType | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.list_openers(
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        mission_type=mission_type,
        limit=limit,
    )


@router.get("/price-estimate", response_model=MissionPriceEstimate)
async def price_estimate(
    mission_type: MissionType = Query(...),
    distance_km: float = Query(..., ge=0),
    user: User = Depends(get_current_user),
):
    from app.services.opener_service import calculate_mission_price

    return calculate_mission_price(mission_type, distance_km)


@router.get("/{opener_id}", response_model=OpenerRead)
async def get_opener(
    opener_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    opener = await svc.get_opener_by_id(opener_id)
    if not opener:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ouvreur introuvable")
    return opener
