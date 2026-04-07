"""
Celery tasks for rental management.

Tasks:
  generate_monthly_rents  — 1st of each month at 06:00 Paris time
  send_rent_reminders     — daily at 08:00 Paris time (checks J-3, J0, J+3, J+7)
  calculate_commissions   — daily at 09:00 Paris time
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, date, datetime, timedelta

from app.tasks.celery_app import celery_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


# ── async DB helper ────────────────────────────────────────────────────────────


def _run(coro):
    """Run an async coroutine from a sync Celery task."""
    return asyncio.run(coro)


# ── generate_monthly_rents ─────────────────────────────────────────────────────


@celery_app.task(bind=True, name="tasks.generate_monthly_rents", max_retries=3)
def generate_monthly_rents(self) -> dict:
    """
    Create one pending rent Transaction for every active long_term contract
    that doesn't already have a transaction for the current month.
    """
    try:
        return _run(_generate_monthly_rents_async())
    except Exception as exc:
        logger.exception("generate_monthly_rents failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _generate_monthly_rents_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.models.contract import Contract
    from app.models.transaction import Transaction
    from sqlalchemy import extract, select

    now = datetime.now(UTC)
    # Due date = 5th of current month
    due = datetime(now.year, now.month, 5, tzinfo=UTC)

    created = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        contracts = (
            (
                await db.execute(
                    select(Contract).where(
                        Contract.type == "long_term",
                        Contract.status == "active",
                        Contract.is_active.is_(True),
                        Contract.monthly_rent.isnot(None),
                    )
                )
            )
            .scalars()
            .all()
        )

        for contract in contracts:
            # Check if already generated for this month
            existing = (
                await db.execute(
                    select(Transaction).where(
                        Transaction.contract_id == contract.id,
                        Transaction.type == "rent",
                        extract("year", Transaction.due_date) == now.year,
                        extract("month", Transaction.due_date) == now.month,
                    )
                )
            ).scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            ref = f"TXN-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
            rent = float(contract.monthly_rent or 0)
            charges = float(contract.charges or 0)

            tx = Transaction(
                reference=ref,
                contract_id=contract.id,
                property_id=contract.property_id,
                owner_id=contract.owner_id,
                tenant_id=contract.tenant_id,
                type="rent",
                status="pending",
                amount=rent + charges,
                due_date=due,
                notes=f"Loyer {due.strftime('%B %Y')} — {rent:.2f}€ + {charges:.2f}€ charges",
            )
            db.add(tx)
            created += 1

        await db.commit()

    logger.info("generate_monthly_rents: created=%d skipped=%d", created, skipped)
    return {"created": created, "skipped": skipped, "month": now.strftime("%Y-%m")}


# ── send_rent_reminders ────────────────────────────────────────────────────────


@celery_app.task(bind=True, name="tasks.send_rent_reminders", max_retries=3)
def send_rent_reminders(self) -> dict:
    """
    Check pending transactions and send email reminders at J-3, J0, J+3, J+7.
    Also marks J+3 transactions as 'late'.
    """
    try:
        return _run(_send_reminders_async())
    except Exception as exc:
        logger.exception("send_rent_reminders failed: %s", exc)
        raise self.retry(exc=exc, countdown=600)


async def _send_reminders_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.models.transaction import Transaction
    from sqlalchemy import select

    today = date.today()
    reminders_sent = 0
    marked_late = 0

    offsets = {
        "J-3": -3,
        "J0": 0,
        "J+3": 3,
        "J+7": 7,
    }

    async with AsyncSessionLocal() as db:
        for label, delta in offsets.items():
            target = today + timedelta(days=delta)

            rows = (
                (
                    await db.execute(
                        select(Transaction).where(
                            Transaction.type == "rent",
                            Transaction.status.in_(["pending", "late"]),
                            Transaction.is_active.is_(True),
                            Transaction.due_date.isnot(None),
                        )
                    )
                )
                .scalars()
                .all()
            )

            for tx in rows:
                tx_due = tx.due_date.date() if tx.due_date else None
                if tx_due != target:
                    continue

                # Mark as late if overdue by 3+ days
                if delta >= 3 and tx.status == "pending":
                    tx.status = "late"
                    marked_late += 1

                # Log reminder (real email sending would go here)
                logger.info(
                    "REMINDER %s | tx=%s | amount=%.2f | due=%s",
                    label,
                    str(tx.id),
                    float(tx.amount),
                    tx_due,
                )
                reminders_sent += 1

        await db.commit()

    return {"reminders_sent": reminders_sent, "marked_late": marked_late}


# ── calculate_commissions ──────────────────────────────────────────────────────


@celery_app.task(bind=True, name="tasks.calculate_commissions", max_retries=3)
def calculate_commissions(self) -> dict:
    """
    For every newly-paid rent transaction without a commission, calculate 3%
    and create a companion commission Transaction.
    """
    try:
        return _run(_calculate_commissions_async())
    except Exception as exc:
        logger.exception("calculate_commissions failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _calculate_commissions_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.models.transaction import Transaction
    from sqlalchemy import select

    COMMISSION_PCT = 3.0
    created = 0

    async with AsyncSessionLocal() as db:
        paid_rents = (
            (
                await db.execute(
                    select(Transaction).where(
                        Transaction.type == "rent",
                        Transaction.status == "paid",
                        Transaction.commission_amount.is_(None),
                        Transaction.is_active.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

        for rent in paid_rents:
            commission_amount = float(rent.amount) * COMMISSION_PCT / 100

            # Update the rent transaction
            rent.commission_front_pct = COMMISSION_PCT
            rent.commission_amount = commission_amount

            # Create a commission transaction
            ref = f"COM-{datetime.now(UTC).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
            commission_tx = Transaction(
                reference=ref,
                contract_id=rent.contract_id,
                property_id=rent.property_id,
                owner_id=rent.owner_id,
                tenant_id=None,
                type="commission",
                status="paid",
                amount=commission_amount,
                paid_at=datetime.now(UTC),
                notes=f"Commission {COMMISSION_PCT}% sur loyer {rent.reference}",
            )
            db.add(commission_tx)
            created += 1

        await db.commit()

    logger.info("calculate_commissions: created=%d", created)
    return {"commissions_created": created}
