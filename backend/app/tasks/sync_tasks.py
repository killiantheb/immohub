"""Celery tasks — synchronisation agenda et messagerie.

Stubs MVP : log-only. L'intégration réelle Google Calendar / Gmail / Outlook
sera branchée quand les OAuth tokens seront exploités (Phase 2+).
"""

from __future__ import annotations

from app.tasks.celery_app import celery_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def sync_agenda_task(self, user_id: str) -> dict:
    """Synchronise le calendrier pour un utilisateur.

    MVP : stub log-only.
    TODO : fetch Google Calendar / Outlook events via OAuth refresh token,
           upsert dans calendar_events.
    """
    logger.info("[sync_agenda] sync requested for user %s — not yet implemented", user_id)
    return {"status": "stub", "user_id": user_id, "message": "sync agenda not yet implemented"}


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def sync_messagerie_task(self, user_id: str) -> dict:
    """Synchronise la messagerie pour un utilisateur.

    MVP : stub log-only.
    TODO : fetch Gmail / Outlook emails via OAuth refresh token,
           upsert dans email_cache, marquer is_processed.
    """
    logger.info("[sync_messagerie] sync requested for user %s — not yet implemented", user_id)
    return {"status": "stub", "user_id": user_id, "message": "sync messagerie not yet implemented"}
