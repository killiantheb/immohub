"""
Celery alert tasks — loyer impayé + bail expirant.
Scheduled daily by Celery Beat.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, timedelta

from app.tasks.celery_app import celery_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


def _run(coro):
    return asyncio.run(coro)


# ── check_overdue_rents ────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="tasks.check_overdue_rents", max_retries=3)
def check_overdue_rents(self) -> dict:
    """
    Every day at 10:00 Zurich — detect paiements_loyer still 'en_attente'
    more than 7 days after their due date and create an 'en_retard' notification.
    """
    try:
        return _run(_check_overdue_rents_async())
    except Exception as exc:
        logger.error("check_overdue_rents failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _check_overdue_rents_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text

    threshold = date.today() - timedelta(days=7)
    notified = 0

    async with AsyncSessionLocal() as db:
        # Fetch overdue payments with owner info
        result = await db.execute(text("""
            SELECT
                p.id,
                p.bien_id,
                p.montant,
                p.mois_concerne,
                b.adresse,
                b.owner_id,
                u.email AS owner_email,
                u.first_name
            FROM paiements_loyer p
            JOIN biens b ON p.bien_id = b.id
            JOIN users u ON b.owner_id = u.id
            WHERE p.statut = 'en_attente'
              AND p.date_echeance IS NOT NULL
              AND p.date_echeance::date < :threshold
              AND p.is_active = TRUE
        """), {"threshold": threshold})
        rows = result.fetchall()

        for row in rows:
            paiement_id, bien_id, montant, mois, adresse, owner_id, owner_email, first_name = row

            # Update status to en_retard
            await db.execute(text("""
                UPDATE paiements_loyer
                SET statut = 'en_retard', updated_at = now()
                WHERE id = :id AND statut = 'en_attente'
            """), {"id": str(paiement_id)})

            # Create notification
            await db.execute(text("""
                INSERT INTO notifications (user_id, type, title, body, data, created_at)
                VALUES (:uid, 'loyer_impaye', :title, :body, :data::jsonb, now())
                ON CONFLICT DO NOTHING
            """), {
                "uid": str(owner_id),
                "title": f"Loyer impayé — {adresse}",
                "body": f"Le loyer de CHF {montant} pour {mois} est en retard.",
                "data": f'{{"paiement_id":"{paiement_id}","bien_id":"{bien_id}"}}',
            })
            notified += 1
            logger.info("Loyer en retard: paiement %s — %s", paiement_id, adresse)

        await db.commit()

    logger.info("check_overdue_rents: %d paiements marqués en_retard", notified)
    return {"overdue_marked": notified}


# ── check_expiring_leases ──────────────────────────────────────────────────────

@celery_app.task(bind=True, name="tasks.check_expiring_leases", max_retries=3)
def check_expiring_leases(self) -> dict:
    """
    Every day at 08:30 Zurich — notify owners of leases expiring in ≤ 90 days.
    Sends notification at 90, 60, 30, and 14 days before expiry.
    """
    try:
        return _run(_check_expiring_leases_async())
    except Exception as exc:
        logger.error("check_expiring_leases failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _check_expiring_leases_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text

    today = date.today()
    thresholds = [90, 60, 30, 14]
    notified = 0

    async with AsyncSessionLocal() as db:
        for days in thresholds:
            target = today + timedelta(days=days)

            result = await db.execute(text("""
                SELECT
                    l.id,
                    l.bien_id,
                    l.date_fin,
                    b.adresse,
                    b.owner_id,
                    COALESCE(loc.prenom || ' ' || loc.nom, 'Locataire') AS locataire_nom
                FROM baux l
                JOIN biens b ON l.bien_id = b.id
                LEFT JOIN locataires loc ON loc.bien_id = b.id AND loc.statut = 'actif'
                WHERE l.statut = 'actif'
                  AND l.date_fin::date = :target
                  AND l.is_active = TRUE
            """), {"target": target})
            rows = result.fetchall()

            for row in rows:
                bail_id, bien_id, date_fin, adresse, owner_id, locataire = row

                await db.execute(text("""
                    INSERT INTO notifications (user_id, type, title, body, data, created_at)
                    VALUES (:uid, 'bail_expirant', :title, :body, :data::jsonb, now())
                """), {
                    "uid": str(owner_id),
                    "title": f"Bail expirant dans {days}j — {adresse}",
                    "body": f"Le bail de {locataire} expire le {date_fin}. Pensez à le renouveler ou à mettre le bien en annonce.",
                    "data": f'{{"bail_id":"{bail_id}","bien_id":"{bien_id}","days_left":{days}}}',
                })
                notified += 1
                logger.info("Bail expirant dans %dd: %s — %s", days, bail_id, adresse)

        await db.commit()

    logger.info("check_expiring_leases: %d notifications envoyées", notified)
    return {"leases_notified": notified}
