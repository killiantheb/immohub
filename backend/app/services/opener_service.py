"""
Opener / Mission service.

Priority algorithm for find_best_openers:
  1. Openers with rating >= 4.5  (tier-1 bucket)
  2. Ascending distance
  3. Descending total_missions (experience tie-breaker)

Dynamic pricing:
  base_price(type) + 2€/km beyond 10 km + 20% surcharge beyond 30 km
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.core.config import settings
from app.models.opener import Mission, Opener
from app.schemas.opener import (
    MissionComplete,
    MissionCreate,
    MissionPriceEstimate,
    MissionRate,
    MissionRead,
    OpenerProfileCreate,
    OpenerProfileUpdate,
    OpenerWithDistance,
    PaginatedMissions,
)
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.user import User


# ── Geo helpers ───────────────────────────────────────────────────────────────


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Pricing ───────────────────────────────────────────────────────────────────

_BASE_PRICES: dict[str, float] = {
    "visit": 50.0,
    "check_in": 40.0,
    "check_out": 40.0,
    "inspection": 80.0,
    "photography": 100.0,
    "other": 45.0,
}


def calculate_mission_price(mission_type: str, distance_km: float) -> MissionPriceEstimate:
    base = _BASE_PRICES.get(mission_type, 50.0)
    distance_surcharge = max(0.0, distance_km - 10.0) * 2.0
    total = (base + distance_surcharge) * (1.2 if distance_km > 30 else 1.0)
    return MissionPriceEstimate(
        mission_type=mission_type,
        distance_km=round(distance_km, 2),
        base_price=base,
        distance_surcharge=round(distance_surcharge, 2),
        total=round(total, 2),
    )


# ── Priority sort ─────────────────────────────────────────────────────────────


def _priority_key(opener: Opener, distance_km: float) -> tuple:
    """Lower tuple = higher priority."""
    tier = 0 if (opener.rating or 0) >= 4.5 else 1
    return (tier, round(distance_km, 1), -(opener.total_missions or 0))


# ── Stripe helpers ────────────────────────────────────────────────────────────


async def _create_payment_intent(amount_eur: float) -> str | None:
    """Create a Stripe PaymentIntent and return its ID, or None if Stripe not configured."""
    if not settings.STRIPE_SECRET_KEY:
        return None
    try:
        import stripe  # type: ignore[import]

        stripe.api_key = settings.STRIPE_SECRET_KEY
        intent = stripe.PaymentIntent.create(
            amount=int(amount_eur * 100),  # cents
            currency="eur",
            capture_method="manual",  # capture only on mission completion
            metadata={"source": "immohub"},
        )
        return intent.id
    except Exception:
        return None


async def _capture_payment_intent(intent_id: str) -> bool:
    if not settings.STRIPE_SECRET_KEY or not intent_id:
        return False
    try:
        import stripe  # type: ignore[import]

        stripe.api_key = settings.STRIPE_SECRET_KEY
        stripe.PaymentIntent.capture(intent_id)
        return True
    except Exception:
        return False


async def _cancel_payment_intent(intent_id: str) -> None:
    if not settings.STRIPE_SECRET_KEY or not intent_id:
        return
    try:
        import stripe  # type: ignore[import]

        stripe.api_key = settings.STRIPE_SECRET_KEY
        stripe.PaymentIntent.cancel(intent_id)
    except Exception:
        pass


# ── Service ───────────────────────────────────────────────────────────────────


class OpenerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Opener profile ─────────────────────────────────────────────────────────

    async def upsert_profile(self, payload: OpenerProfileCreate, current_user: User) -> Opener:
        """Create or replace the opener profile for the current user."""
        result = await self.db.execute(select(Opener).where(Opener.user_id == current_user.id))
        opener = result.scalar_one_or_none()

        if opener is None:
            opener = Opener(
                user_id=current_user.id,
                **payload.model_dump(),
            )
            self.db.add(opener)
        else:
            for field, value in payload.model_dump().items():
                setattr(opener, field, value)

        await self.db.flush()
        await self.db.refresh(opener)
        return opener

    async def patch_profile(self, payload: OpenerProfileUpdate, current_user: User) -> Opener:
        opener = await self._get_my_opener(current_user)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(opener, field, value)
        await self.db.flush()
        await self.db.refresh(opener)
        return opener

    async def get_opener_by_id(self, opener_id: str) -> Opener | None:
        try:
            oid = uuid.UUID(opener_id)
        except ValueError:
            return None
        result = await self.db.execute(
            select(Opener).where(Opener.id == oid, Opener.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def list_openers(
        self,
        lat: float | None = None,
        lng: float | None = None,
        radius_km: float | None = None,
        mission_type: str | None = None,
        available_only: bool = True,
        limit: int = 20,
    ) -> list[OpenerWithDistance]:
        q = select(Opener).where(Opener.is_active.is_(True))
        if available_only:
            q = q.where(Opener.is_available.is_(True))

        rows = (await self.db.execute(q)).scalars().all()

        enriched: list[tuple[Opener, float]] = []
        for opener in rows:
            if lat is not None and lng is not None and opener.latitude and opener.longitude:
                dist = haversine_km(lat, lng, opener.latitude, opener.longitude)
                if radius_km and dist > radius_km:
                    continue
            else:
                dist = 0.0
            # Filter by skill
            if mission_type and opener.skills:
                if mission_type not in opener.skills and "other" not in opener.skills:
                    continue
            enriched.append((opener, dist))

        enriched.sort(key=lambda x: _priority_key(x[0], x[1]))

        result = []
        for opener, dist in enriched[:limit]:
            data = OpenerWithDistance.model_validate(opener)
            data.distance_km = round(dist, 2)
            result.append(data)
        return result

    # ── find_best_openers ──────────────────────────────────────────────────────

    async def find_best_openers(
        self,
        property_lat: float | None,
        property_lng: float | None,
        scheduled_at: datetime,
        mission_type: str,
        limit: int = 5,
    ) -> list[OpenerWithDistance]:
        """
        Return top-N openers ordered by: tier(rating≥4.5) → distance → experience.
        Only openers whose radius_km covers the distance are included.
        """
        rows = (
            (
                await self.db.execute(
                    select(Opener).where(
                        Opener.is_available.is_(True),
                        Opener.is_active.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

        candidates: list[tuple[Opener, float]] = []
        for opener in rows:
            if property_lat is not None and property_lng is not None:
                if opener.latitude is None or opener.longitude is None:
                    continue
                dist = haversine_km(property_lat, property_lng, opener.latitude, opener.longitude)
                # Opener must cover this distance with their radius
                if opener.radius_km and dist > opener.radius_km:
                    continue
            else:
                dist = 0.0

            # Filter by skill if the opener has declared skills
            if opener.skills and mission_type not in opener.skills and "other" not in opener.skills:
                continue

            candidates.append((opener, dist))

        candidates.sort(key=lambda x: _priority_key(x[0], x[1]))

        result = []
        for opener, dist in candidates[:limit]:
            item = OpenerWithDistance.model_validate(opener)
            item.distance_km = round(dist, 2)
            result.append(item)
        return result

    # ── Missions ───────────────────────────────────────────────────────────────

    async def create_mission(self, payload: MissionCreate, current_user: User) -> Mission:
        try:
            bien_id = uuid.UUID(payload.bien_id)
        except ValueError:
            raise HTTPException(422, "bien_id invalide")

        opener_id = None
        price = None
        distance_km = 0.0

        if payload.opener_id:
            # Pre-assigned opener
            try:
                oid = uuid.UUID(payload.opener_id)
            except ValueError:
                raise HTTPException(422, "opener_id invalide")
            result = await self.db.execute(select(Opener).where(Opener.id == oid))
            opener = result.scalar_one_or_none()
            if opener is None:
                raise HTTPException(404, "Ouvreur introuvable")
            opener_id = oid

            if (
                payload.property_lat
                and payload.property_lng
                and opener.latitude
                and opener.longitude
            ):
                distance_km = haversine_km(
                    payload.property_lat,
                    payload.property_lng,
                    opener.latitude,
                    opener.longitude,
                )
            estimate = calculate_mission_price(payload.type, distance_km)
            price = estimate.total
        else:
            # Auto-match: find the best available opener
            best = await self.find_best_openers(
                payload.property_lat,
                payload.property_lng,
                payload.scheduled_at,
                payload.type,
                limit=1,
            )
            if best:
                opener_id = uuid.UUID(best[0].id)
                distance_km = best[0].distance_km
                estimate = calculate_mission_price(payload.type, distance_km)
                price = estimate.total

        # Create Stripe PaymentIntent
        stripe_id: str | None = None
        if price:
            stripe_id = await _create_payment_intent(price)

        mission = Mission(
            requester_id=current_user.id,
            opener_id=opener_id,
            bien_id=bien_id,
            type=payload.type,
            scheduled_at=payload.scheduled_at,
            notes=payload.notes,
            property_lat=payload.property_lat,
            property_lng=payload.property_lng,
            price=price,
            stripe_payment_intent_id=stripe_id,
        )
        self.db.add(mission)
        await self.db.flush()
        await self.db.refresh(mission)

        # Fire Celery tasks (after flush so IDs are set)
        mission_id_str = str(mission.id)
        try:
            from app.tasks.mission_tasks import (
                auto_reassign_if_no_accept,
                notify_available_openers,
            )

            notify_available_openers.delay(mission_id_str)
            # Auto-reassign if not accepted within 2 hours
            auto_reassign_if_no_accept.apply_async(args=[mission_id_str], countdown=7200)
        except Exception:
            pass  # Celery unavailable — mission still created

        return mission

    async def get_mission(self, mission_id: str, current_user: User) -> Mission:
        mission = await self._get_mission_or_404(mission_id)
        self._assert_mission_access(mission, current_user)
        return mission

    async def list_missions(
        self,
        current_user: User,
        page: int = 1,
        size: int = 20,
        mission_status: str | None = None,
    ) -> PaginatedMissions:
        q = select(Mission).where(Mission.is_active.is_(True))

        if current_user.role == "super_admin":
            pass
        else:
            # Opener sees missions assigned to them; others see their own requests
            opener = await self._get_my_opener_optional(current_user)
            if opener:
                q = q.where(
                    (Mission.requester_id == current_user.id) | (Mission.opener_id == opener.id)
                )
            else:
                q = q.where(Mission.requester_id == current_user.id)

        if mission_status:
            q = q.where(Mission.status == mission_status)

        total: int = (
            await self.db.execute(select(func.count()).select_from(q.subquery()))
        ).scalar_one()

        rows = (
            (
                await self.db.execute(
                    q.order_by(Mission.scheduled_at.desc()).offset((page - 1) * size).limit(size)
                )
            )
            .scalars()
            .all()
        )

        return PaginatedMissions(
            items=[MissionRead.model_validate(r) for r in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    async def my_missions(
        self, current_user: User, page: int = 1, size: int = 20
    ) -> PaginatedMissions:
        return await self.list_my_missions(current_user, page=page, size=size)

    async def list_my_missions(
        self,
        current_user: User,
        status: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> PaginatedMissions:
        """Missions assigned to the current user's opener profile."""
        opener = await self._get_my_opener(current_user)
        q = select(Mission).where(Mission.opener_id == opener.id, Mission.is_active.is_(True))
        if status:
            q = q.where(Mission.status == status)
        q = q.order_by(Mission.scheduled_at.asc())
        total: int = (
            await self.db.execute(select(func.count()).select_from(q.subquery()))
        ).scalar_one()
        rows = (await self.db.execute(q.offset((page - 1) * size).limit(size))).scalars().all()
        return PaginatedMissions(
            items=[MissionRead.model_validate(r) for r in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    async def list_available_missions(
        self,
        current_user: User,
        page: int = 1,
        size: int = 20,
    ) -> PaginatedMissions:
        """Available (unassigned) missions — visible to openers only."""
        from fastapi import HTTPException as _HTTPException

        if current_user.role != "opener":
            raise _HTTPException(403, "Réservé aux ouvreurs")
        q = (
            select(Mission)
            .where(
                Mission.status == "pending",
                Mission.opener_id.is_(None),
                Mission.is_active.is_(True),
            )
            .order_by(Mission.scheduled_at.asc())
        )
        total: int = (
            await self.db.execute(select(func.count()).select_from(q.subquery()))
        ).scalar_one()
        rows = (await self.db.execute(q.offset((page - 1) * size).limit(size))).scalars().all()
        return PaginatedMissions(
            items=[MissionRead.model_validate(r) for r in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    async def list_requested_missions(
        self,
        current_user: User,
        status: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> PaginatedMissions:
        """Missions created by the current user (requester view)."""
        q = select(Mission).where(
            Mission.requester_id == current_user.id, Mission.is_active.is_(True)
        )
        if status:
            q = q.where(Mission.status == status)
        q = q.order_by(Mission.scheduled_at.desc())
        total: int = (
            await self.db.execute(select(func.count()).select_from(q.subquery()))
        ).scalar_one()
        rows = (await self.db.execute(q.offset((page - 1) * size).limit(size))).scalars().all()
        return PaginatedMissions(
            items=[MissionRead.model_validate(r) for r in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    async def accept_mission(self, mission_id: str, current_user: User) -> Mission:
        mission = await self._get_mission_or_404(mission_id)
        opener = await self._get_my_opener(current_user)

        if mission.opener_id != opener.id:
            raise HTTPException(403, "Cette mission ne vous est pas assignée")
        if mission.status != "pending":
            raise HTTPException(
                409, f"Impossible d'accepter une mission au statut '{mission.status}'"
            )

        mission.status = "confirmed"
        mission.accepted_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(mission)
        return mission

    async def complete_mission(
        self, mission_id: str, payload: MissionComplete, current_user: User
    ) -> Mission:
        mission = await self._get_mission_or_404(mission_id)
        opener = await self._get_my_opener(current_user)

        if mission.opener_id != opener.id:
            raise HTTPException(403, "Cette mission ne vous est pas assignée")
        if mission.status not in ("confirmed", "in_progress"):
            raise HTTPException(
                409, f"Impossible de terminer une mission au statut '{mission.status}'"
            )

        mission.status = "completed"
        mission.completed_at = datetime.now(UTC)
        mission.report_text = payload.report_text
        mission.report_url = payload.report_url
        mission.photos_urls = payload.photos_urls or []

        # Capture Stripe payment
        if mission.stripe_payment_intent_id:
            await _capture_payment_intent(mission.stripe_payment_intent_id)

        # Increment opener stats
        opener.total_missions = (opener.total_missions or 0) + 1

        await self.db.flush()
        await self.db.refresh(mission)
        return mission

    async def rate_mission(
        self, mission_id: str, payload: MissionRate, current_user: User
    ) -> Mission:
        mission = await self._get_mission_or_404(mission_id)

        if str(mission.requester_id) != str(current_user.id):
            raise HTTPException(403, "Seul le demandeur peut noter la mission")
        if mission.status != "completed":
            raise HTTPException(409, "La mission doit être terminée pour être notée")
        if mission.rating_given is not None:
            raise HTTPException(409, "Mission déjà notée")

        mission.rating_given = payload.rating
        mission.rating_comment = payload.comment
        await self.db.flush()

        # Recalculate opener average rating
        if mission.opener_id:
            await self.update_opener_rating(str(mission.opener_id))

        await self.db.refresh(mission)
        return mission

    async def cancel_mission(
        self, mission_id: str, current_user: User, reason: str | None = None
    ) -> Mission:
        mission = await self._get_mission_or_404(mission_id)
        self._assert_mission_access(mission, current_user)

        if mission.status in ("completed", "cancelled"):
            raise HTTPException(
                409, f"Impossible d'annuler une mission au statut '{mission.status}'"
            )

        mission.status = "cancelled"
        mission.cancelled_at = datetime.now(UTC)
        mission.cancelled_reason = reason

        if mission.stripe_payment_intent_id:
            await _cancel_payment_intent(mission.stripe_payment_intent_id)

        await self.db.flush()
        await self.db.refresh(mission)
        return mission

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def update_opener_rating(self, opener_id: str) -> None:
        """Recompute the opener's average rating from all completed missions."""
        try:
            oid = uuid.UUID(opener_id)
        except ValueError:
            return

        result = await self.db.execute(
            select(func.avg(Mission.rating_given)).where(
                Mission.opener_id == oid,
                Mission.rating_given.isnot(None),
            )
        )
        avg = result.scalar_one()
        if avg is None:
            return

        opener_row = await self.db.execute(select(Opener).where(Opener.id == oid))
        opener = opener_row.scalar_one_or_none()
        if opener:
            opener.rating = round(float(avg), 2)
            await self.db.flush()

    async def get_price_estimate(
        self, mission_type: str, distance_km: float
    ) -> MissionPriceEstimate:
        return calculate_mission_price(mission_type, distance_km)

    async def _get_mission_or_404(self, mission_id: str) -> Mission:
        try:
            mid = uuid.UUID(mission_id)
        except ValueError:
            raise HTTPException(404, "Mission introuvable")
        result = await self.db.execute(
            select(Mission).where(Mission.id == mid, Mission.is_active.is_(True))
        )
        mission = result.scalar_one_or_none()
        if mission is None:
            raise HTTPException(404, "Mission introuvable")
        return mission

    def _assert_mission_access(self, mission: Mission, user: User) -> None:
        if user.role == "super_admin":
            return
        # Requester or assigned opener can access
        uid = user.id
        if str(mission.requester_id) == str(uid):
            return
        raise HTTPException(403, "Accès refusé")

    async def _get_my_opener(self, user: User) -> Opener:
        result = await self.db.execute(
            select(Opener).where(Opener.user_id == user.id, Opener.is_active.is_(True))
        )
        opener = result.scalar_one_or_none()
        if opener is None:
            raise HTTPException(404, "Profil ouvreur introuvable — créez votre profil d'abord")
        return opener

    async def _get_my_opener_optional(self, user: User) -> Opener | None:
        result = await self.db.execute(
            select(Opener).where(Opener.user_id == user.id, Opener.is_active.is_(True))
        )
        return result.scalar_one_or_none()
