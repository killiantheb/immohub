"""Cron rappels signature en attente (Sprint 10 Lot 4).

Tâches asynchrones qui parcourent les documents signables et envoient un
rappel email aux signataires qui n'ont pas encore signé après 3 jours.

§B.10 doctrine : ne pas spammer. Idempotence via Set en mémoire process-local
(suffisant pour Phase 1.0 avec 1 worker Celery — à refactor en table dédiée
ou Redis quand multi-worker Phase 2).

Décision Lot 4 sur l'idempotence :
  - Set en mémoire `_REMINDERS_SENT` qui stocke (doc_type, doc_id, day_bucket).
  - day_bucket = date.today().isoformat() → reset implicite à minuit UTC.
  - Process restart → Set vide → potentiel doublon J+0 après restart, jugé
    acceptable Phase 1.0 (rappels sont des nudges, pas critiques).
  - Quand on aura multi-worker Phase 2 : migrer vers table
    `signature_reminders_sent (doc_type, doc_id, sent_at)` avec unique
    constraint sur (doc_type, doc_id, day_bucket).

Exposition Celery :
  - Les fonctions sont exposées comme coroutines, prêtes à être wrappées
    par Celery beat. Le wrapping Celery n'est PAS fait ici (Lot 4 scope =
    fonctions disponibles, Lot 6+ ou sprint futur câblera la cron).
  - Exemple wrapping prévu :
        @celery_app.task
        def cron_sprint10_reminders():
            asyncio.run(send_rappels_signature_pending(...))
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from app.core.database import AsyncSessionLocal
from app.models.avenant import Avenant
from app.models.contract import Contract
from app.models.mandat_gestion import MandatGestion
from app.models.resiliation import Resiliation
from app.services.sprint10_emails import send_rappel_signature_pending
from sqlalchemy import select

logger = logging.getLogger("althy.sprint10_reminders")

# Idempotence Phase 1.0 simple — Set in-memory process-local.
# Format : (doc_type, doc_id_str, day_bucket_iso)
_REMINDERS_SENT: set[tuple[str, str, str]] = set()

# Délai après lequel on rappelle un signataire qui n'a pas signé.
_REMINDER_THRESHOLD = timedelta(days=3)


def _day_bucket() -> str:
    return date.today().isoformat()


def _already_sent(doc_type: str, doc_id: str) -> bool:
    return (doc_type, doc_id, _day_bucket()) in _REMINDERS_SENT


def _mark_sent(doc_type: str, doc_id: str) -> None:
    _REMINDERS_SENT.add((doc_type, doc_id, _day_bucket()))


# ── Cron principal ───────────────────────────────────────────────────────────


async def send_rappels_signature_pending() -> dict[str, int]:
    """Parcourt les 4 tables et envoie un rappel pour chaque doc
    `skribble_status='pending_signatures'` dont updated_at < now() - 3j.

    Retourne un dict {doc_type: count_emails_sent} pour le monitoring.
    """
    counts = {"contract": 0, "avenant": 0, "resiliation": 0, "mandat": 0}
    threshold = datetime.now(UTC) - _REMINDER_THRESHOLD

    async with AsyncSessionLocal() as db:
        # Contracts en attente
        contracts = (
            await db.execute(
                select(Contract).where(
                    Contract.skribble_status == "pending_signatures",
                    Contract.is_active.is_(True),
                    Contract.updated_at < threshold,
                )
            )
        ).scalars().all()
        for c in contracts:
            doc_id_str = str(c.id)
            if _already_sent("contract", doc_id_str):
                continue
            try:
                days = max(
                    1,
                    (datetime.now(UTC) - c.updated_at.replace(tzinfo=UTC)
                     if c.updated_at.tzinfo is None else datetime.now(UTC) - c.updated_at).days,
                )
                msg_id = await send_rappel_signature_pending(
                    "contract", c.id, days_since_sent=days
                )
                if msg_id:
                    _mark_sent("contract", doc_id_str)
                    counts["contract"] += 1
            except Exception:
                logger.warning(
                    "send_rappels_signature_pending.contract %s failed", c.id, exc_info=True
                )

        # Avenants
        avenants = (
            await db.execute(
                select(Avenant).where(
                    Avenant.skribble_status == "pending_signatures",
                    Avenant.is_active.is_(True),
                    Avenant.updated_at < threshold,
                )
            )
        ).scalars().all()
        for a in avenants:
            doc_id_str = str(a.id)
            if _already_sent("avenant", doc_id_str):
                continue
            try:
                msg_id = await send_rappel_signature_pending(
                    "avenant", a.id, days_since_sent=3
                )
                if msg_id:
                    _mark_sent("avenant", doc_id_str)
                    counts["avenant"] += 1
            except Exception:
                logger.warning(
                    "send_rappels_signature_pending.avenant %s failed", a.id, exc_info=True
                )

        # Resiliations
        resiliations = (
            await db.execute(
                select(Resiliation).where(
                    Resiliation.skribble_status == "pending_signatures",
                    Resiliation.is_active.is_(True),
                    Resiliation.updated_at < threshold,
                )
            )
        ).scalars().all()
        for r in resiliations:
            doc_id_str = str(r.id)
            if _already_sent("resiliation", doc_id_str):
                continue
            try:
                msg_id = await send_rappel_signature_pending(
                    "resiliation", r.id, days_since_sent=3
                )
                if msg_id:
                    _mark_sent("resiliation", doc_id_str)
                    counts["resiliation"] += 1
            except Exception:
                logger.warning(
                    "send_rappels_signature_pending.resiliation %s failed",
                    r.id, exc_info=True,
                )

        # Mandats
        mandats = (
            await db.execute(
                select(MandatGestion).where(
                    MandatGestion.skribble_status == "pending_signatures",
                    MandatGestion.is_active.is_(True),
                    MandatGestion.updated_at < threshold,
                )
            )
        ).scalars().all()
        for m in mandats:
            doc_id_str = str(m.id)
            if _already_sent("mandat", doc_id_str):
                continue
            try:
                msg_id = await send_rappel_signature_pending(
                    "mandat", m.id, days_since_sent=3
                )
                if msg_id:
                    _mark_sent("mandat", doc_id_str)
                    counts["mandat"] += 1
            except Exception:
                logger.warning(
                    "send_rappels_signature_pending.mandat %s failed", m.id, exc_info=True
                )

    logger.info("sprint10_reminders.summary=%s", counts)
    return counts


# ── Détection sessions Skribble expirantes (J-1) ─────────────────────────────


async def detect_expiring_skribble_signatures() -> dict[str, int]:
    """Liste les documents dont la session Skribble approche de l'expiration
    (par défaut 14 jours côté Skribble) et envoie un rappel urgent.

    Heuristique Phase 1.0 : on considère qu'une session pending depuis
    > 13 jours est sur le point d'expirer. (À raffiner quand on aura
    l'expires_at exact via webhook signature_request.created.)
    """
    counts = {"alerted": 0}
    near_expiry = datetime.now(UTC) - timedelta(days=13)

    async with AsyncSessionLocal() as db:
        contracts = (
            await db.execute(
                select(Contract).where(
                    Contract.skribble_status.in_(("pending_signatures", "partial_signed")),
                    Contract.is_active.is_(True),
                    Contract.updated_at < near_expiry,
                )
            )
        ).scalars().all()
        for c in contracts:
            logger.warning(
                "sprint10_reminders.near_expiry contract=%s reference=%s updated=%s",
                c.id, c.reference, c.updated_at,
            )
            counts["alerted"] += 1

    return counts
