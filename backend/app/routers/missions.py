from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.opener import (
    MissionComplete,
    MissionCreate,
    MissionRate,
    MissionRead,
    PaginatedMissions,
)
from app.services.opener_service import OpenerService
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


# ── List available (opener) ───────────────────────────────────────────────────


@router.get("", response_model=PaginatedMissions)
async def list_missions(
    available: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    GET /missions?available=true  → available (unassigned) missions for openers.
    Other roles receive 403.
    """
    svc = OpenerService(db)
    if available:
        return await svc.list_available_missions(user, page=page, size=size)
    # Default: return caller's own missions
    return await svc.list_my_missions(user, page=page, size=size)


# ── Create ────────────────────────────────────────────────────────────────────


@router.post("", response_model=MissionRead, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload: MissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.create_mission(payload, user)


# ── My missions (opener view) ─────────────────────────────────────────────────


@router.get("/my", response_model=PaginatedMissions)
async def my_missions(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.list_my_missions(user, status=status_filter, page=page, size=size)


# ── Requester view ────────────────────────────────────────────────────────────


@router.get("/requested", response_model=PaginatedMissions)
async def requested_missions(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.list_requested_missions(user, status=status_filter, page=page, size=size)


# ── Detail ────────────────────────────────────────────────────────────────────


@router.get("/{mission_id}", response_model=MissionRead)
async def get_mission(
    mission_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    mission = await svc.get_mission(mission_id, user)
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission introuvable")
    return mission


# ── Lifecycle ─────────────────────────────────────────────────────────────────


@router.put("/{mission_id}/accept", response_model=MissionRead)
async def accept_mission(
    mission_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.accept_mission(mission_id, user)


@router.put("/{mission_id}/complete", response_model=MissionRead)
async def complete_mission(
    mission_id: str,
    payload: MissionComplete,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.complete_mission(mission_id, payload, user)


@router.put("/{mission_id}/rate", response_model=MissionRead)
async def rate_mission(
    mission_id: str,
    payload: MissionRate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.rate_mission(mission_id, payload, user)


@router.put("/{mission_id}/cancel", response_model=MissionRead)
async def cancel_mission(
    mission_id: str,
    reason: str | None = Query(None, max_length=255),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc = OpenerService(db)
    return await svc.cancel_mission(mission_id, user, reason=reason)


# ── Stripe webhook ────────────────────────────────────────────────────────────


@router.post("/stripe/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events (payment_intent.succeeded, etc.)."""
    import stripe
    from app.core.config import settings

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    if event["type"] == "payment_intent.payment_failed":
        pi_id = event["data"]["object"]["id"]
        # Mark mission as cancelled on payment failure
        from app.models.opener import Mission
        from sqlalchemy import select

        result = await db.execute(select(Mission).where(Mission.stripe_payment_intent_id == pi_id))
        mission = result.scalar_one_or_none()
        if mission:
            mission.status = "cancelled"
            mission.cancelled_reason = "Échec du paiement"
            await db.commit()

    return {"received": True}
