"""
Celery tasks for the opener/mission lifecycle.

  notify_available_openers  — fired after mission creation (no opener yet)
  auto_reassign_if_no_accept — fired 2 h after mission creation if still pending
"""

import asyncio
import logging

from app.core.database import AsyncSessionLocal
from app.models.opener import Mission, Opener
from app.tasks.celery_app import celery_app
from sqlalchemy import select

log = logging.getLogger(__name__)


# ── helpers ────────────────────────────────────────────────────────────────────


async def _notify_openers_async(mission_id: str) -> None:
    """
    Find openers whose radius covers the mission property and send them
    a notification (email / push — stubbed here as a log line).
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Mission).where(Mission.id == mission_id))
            mission = result.scalar_one_or_none()
            if not mission or mission.status != "pending":
                return

            if mission.property_lat is None or mission.property_lng is None:
                log.info("Mission %s has no coordinates — skipping notification", mission_id)
                return

            from app.services.opener_service import haversine_km

            openers_q = await db.execute(
                select(Opener).where(
                    Opener.is_available.is_(True),
                    Opener.is_active.is_(True),
                    Opener.latitude.isnot(None),
                    Opener.longitude.isnot(None),
                )
            )
            openers = openers_q.scalars().all()

            notified = 0
            for opener in openers:
                dist = haversine_km(
                    mission.property_lat,
                    mission.property_lng,
                    opener.latitude,
                    opener.longitude,  # type: ignore[arg-type]
                )
                if opener.radius_km and dist <= opener.radius_km:
                    # TODO: send real notification (email / FCM)
                    log.info(
                        "Notifying opener %s (dist=%.1f km) for mission %s",
                        opener.id,
                        dist,
                        mission_id,
                    )
                    notified += 1

            log.info("Notified %d openers for mission %s", notified, mission_id)
        except Exception:
            log.exception("Error in _notify_openers_async for mission %s", mission_id)


async def _auto_reassign_async(mission_id: str) -> None:
    """
    If the mission is still pending 2 h after creation, try to assign
    the next best available opener.
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Mission).where(Mission.id == mission_id))
            mission = result.scalar_one_or_none()

            if not mission or mission.status != "pending":
                # Already accepted or cancelled — nothing to do
                return

            from app.services.opener_service import OpenerService

            svc = OpenerService(db)
            candidates = await svc.find_best_openers(
                mission.property_lat,
                mission.property_lng,
                mission.scheduled_at,
                mission.type,
                limit=1,
            )

            if not candidates:
                log.warning("No available opener found for auto-reassign of mission %s", mission_id)
                return

            import uuid

            new_opener_id = uuid.UUID(candidates[0].id)

            # Skip if it's the same opener that already didn't accept
            if mission.opener_id == new_opener_id:
                log.info(
                    "Same opener already assigned to mission %s — skipping reassign", mission_id
                )
                return

            mission.opener_id = new_opener_id
            await db.commit()
            log.info(
                "Mission %s auto-reassigned to opener %s",
                mission_id,
                new_opener_id,
            )

            # Re-notify the new opener
            notify_available_openers.delay(str(mission_id))

        except Exception:
            log.exception("Error in _auto_reassign_async for mission %s", mission_id)


# ── Celery tasks ───────────────────────────────────────────────────────────────


@celery_app.task(name="tasks.notify_available_openers", bind=True, max_retries=3)
def notify_available_openers(self, mission_id: str) -> None:
    """Notify nearby openers that a new mission is available."""
    try:
        asyncio.run(_notify_openers_async(mission_id))
    except Exception as exc:
        log.exception("notify_available_openers failed for %s", mission_id)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="tasks.auto_reassign_if_no_accept", bind=True, max_retries=2)
def auto_reassign_if_no_accept(self, mission_id: str) -> None:
    """
    Called ~2 h after mission creation.
    If the mission is still pending, reassign to the next best opener.
    """
    try:
        asyncio.run(_auto_reassign_async(mission_id))
    except Exception as exc:
        log.exception("auto_reassign_if_no_accept failed for %s", mission_id)
        raise self.retry(exc=exc, countdown=300)
