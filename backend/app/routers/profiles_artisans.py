"""Router FastAPI — /api/v1/profiles-artisans."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.profile_artisan import ProfileArtisan
from app.models.user import User
from app.schemas.profile_artisan import (
    ArtisanSubscribeRequest,
    ArtisanSubscribeResponse,
    FoundingSpotRead,
    ProfileArtisanCreate,
    ProfileArtisanRead,
    ProfileArtisanUpdate,
)
from app.services.artisan_service import (
    VALID_CANTONS,
    ArtisanError,
    compute_commission,
    create_stripe_connect_link,
    founding_spots_remaining,
    settle_intervention_payment,
    subscribe as artisan_subscribe,
)
from app.services.geocoding import geocode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=list[ProfileArtisanRead])
async def list_profiles(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[ProfileArtisanRead]:
    q = select(ProfileArtisan).offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [ProfileArtisanRead.model_validate(r) for r in rows.scalars()]


@router.post("", response_model=ProfileArtisanRead, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ProfileArtisanCreate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    p = ProfileArtisan(**payload.model_dump())
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return ProfileArtisanRead.model_validate(p)


@router.get("/me", response_model=ProfileArtisanRead)
async def get_my_profile(
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    result = await db.execute(select(ProfileArtisan).where(ProfileArtisan.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
    return ProfileArtisanRead.model_validate(p)


@router.patch("/me", response_model=ProfileArtisanRead)
async def update_my_profile(
    payload: ProfileArtisanUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    result = await db.execute(select(ProfileArtisan).where(ProfileArtisan.user_id == current_user.id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(p, field, value)

    # Auto-géocode si lat/lng absents et que l'utilisateur a une adresse
    if p.lat is None or p.lng is None:
        if current_user.adresse:
            coords = await geocode(current_user.adresse)
            if coords:
                p.lat, p.lng = coords

    await db.flush()
    await db.refresh(p)
    return ProfileArtisanRead.model_validate(p)


@router.get("/{profile_id}", response_model=ProfileArtisanRead)
async def get_profile(
    profile_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    result = await db.execute(select(ProfileArtisan).where(ProfileArtisan.id == profile_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
    return ProfileArtisanRead.model_validate(p)


# ── Marketplace M1 : subscribe + founding spots ──────────────────────────────


@router.get("/founding-spots", response_model=list[FoundingSpotRead])
async def list_founding_spots(db: DbDep) -> list[FoundingSpotRead]:
    """Places fondateurs restantes par canton (public — pour landing artisan)."""
    result = await db.execute(text(
        "select canton, total_spots, taken, remaining "
        "from founding_artisans_spots_remaining order by canton"
    ))
    return [
        FoundingSpotRead(
            canton=row.canton, total_spots=row.total_spots,
            taken=row.taken, remaining=row.remaining,
        )
        for row in result
    ]


@router.get("/founding-spots/{canton}", response_model=FoundingSpotRead)
async def get_founding_spots_for_canton(canton: str, db: DbDep) -> FoundingSpotRead:
    canton = canton.upper()
    if canton not in VALID_CANTONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Canton invalide : {canton}")
    remaining = await founding_spots_remaining(db, canton)
    return FoundingSpotRead(
        canton=canton,
        total_spots=50,
        taken=50 - remaining,
        remaining=remaining,
    )


@router.post("/subscribe", response_model=ArtisanSubscribeResponse)
async def subscribe(
    payload: ArtisanSubscribeRequest,
    current_user: AuthDep,
    db: DbDep,
) -> ArtisanSubscribeResponse:
    """Souscrit un artisan au marketplace — décide plan final selon places fondateurs.

    - Si places dispo dans le canton ET desired_plan=artisan_free_early → founding
    - Sinon → artisan_verified (CHF 49/mois) : Stripe checkout requis ensuite
    """
    if current_user.role != "artisan":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux artisans")
    try:
        profile, _is_new = await artisan_subscribe(
            db,
            user_id=current_user.id,
            canton=payload.canton.upper(),
            specialties=payload.specialties,
            desired_plan=payload.desired_plan,
        )
    except ArtisanError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    remaining = await founding_spots_remaining(db, profile.canton or "")
    return ArtisanSubscribeResponse(
        assigned_plan=profile.subscription_plan or "artisan_verified",
        is_founding_member=profile.is_founding_member,
        founding_spots_remaining=remaining,
        requires_stripe_kyc=not profile.stripe_connect_ready,
        requires_payment=(profile.subscription_plan == "artisan_verified"),
    )


# ── Stripe Connect Express (T2 marketplace — 5% commission) ──────────────────


@router.post("/stripe-connect/onboard")
async def stripe_connect_onboard(
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Crée un compte Stripe Connect Express et retourne l'URL d'onboarding.

    Étape requise avant de pouvoir recevoir les paiements (95% après 5% Althy).
    """
    if current_user.role != "artisan":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux artisans")
    result = await db.execute(
        select(ProfileArtisan).where(ProfileArtisan.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")
    try:
        link = await create_stripe_connect_link(profile)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Stripe : {exc}") from exc
    await db.flush()
    return link


@router.post("/stripe-connect/refresh", response_model=ProfileArtisanRead)
async def stripe_connect_refresh(
    current_user: AuthDep,
    db: DbDep,
) -> ProfileArtisanRead:
    """Met à jour `stripe_connect_ready` en interrogeant Stripe (après onboarding)."""
    if current_user.role != "artisan":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux artisans")
    result = await db.execute(
        select(ProfileArtisan).where(ProfileArtisan.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.stripe_connect_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte Stripe Connect introuvable")

    import stripe
    from app.core.config import settings as _s
    stripe.api_key = _s.STRIPE_SECRET_KEY
    try:
        account = stripe.Account.retrieve(profile.stripe_connect_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Stripe : {exc}") from exc

    profile.stripe_connect_ready = bool(
        account.get("charges_enabled") and account.get("payouts_enabled")
    )
    await db.flush()
    await db.refresh(profile)
    return ProfileArtisanRead.model_validate(profile)


class InterventionSettleRequest(BaseModel):
    intervention_id: uuid.UUID
    artisan_profile_id: uuid.UUID
    gross_amount_chf: float
    owner_payment_method_id: str
    description: str = "Intervention Althy"


class InterventionSettleResponse(BaseModel):
    payment_intent_id: str
    status: str
    gross_chf: float
    commission_chf: float
    net_artisan_chf: float


@router.post("/settle-intervention", response_model=InterventionSettleResponse)
async def settle_intervention(
    payload: InterventionSettleRequest,
    current_user: AuthDep,
    db: DbDep,
) -> InterventionSettleResponse:
    """Propriétaire règle une intervention — 5% Althy / 95% artisan (Stripe Connect).

    Appelé une fois l'intervention terminée et la facture validée.
    """
    result = await db.execute(
        select(ProfileArtisan).where(ProfileArtisan.id == payload.artisan_profile_id)
    )
    artisan = result.scalar_one_or_none()
    if not artisan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil artisan introuvable")

    try:
        result_data = await settle_intervention_payment(
            db,
            artisan_profile=artisan,
            owner_payment_method_id=payload.owner_payment_method_id,
            gross_amount_chf=payload.gross_amount_chf,
            intervention_id=payload.intervention_id,
            description=payload.description,
        )
    except ArtisanError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Stripe : {exc}") from exc

    return InterventionSettleResponse(**result_data)


class CommissionPreviewResponse(BaseModel):
    gross_chf: float
    commission_chf: float
    net_artisan_chf: float
    commission_pct: float


@router.get("/commission/preview", response_model=CommissionPreviewResponse)
async def preview_commission(
    current_user: AuthDep,
    gross_chf: float = Query(..., gt=0),
) -> CommissionPreviewResponse:
    """Aperçu commission 5% sur un montant — pour affichage UI côté artisan/owner."""
    commission, net = compute_commission(gross_chf)
    return CommissionPreviewResponse(
        gross_chf=gross_chf,
        commission_chf=float(commission),
        net_artisan_chf=float(net),
        commission_pct=5.0,
    )
