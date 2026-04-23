"""Celery tasks — email notifications (contrats + transactions).

Uses app.services.email_service which sends via Resend (priority) or SMTP fallback.
In dev (no transport configured), emails are logged only.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.email_service import EmailServiceError, send_email
from app.tasks.celery_app import celery_app
from celery.utils.log import get_task_logger
from sqlalchemy import text

logger = get_task_logger(__name__)

# ── Template loading ─────────────────────────────────────────────────────────

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"


def _render(template_name: str, **kwargs: str) -> str:
    """Load an HTML template and replace {placeholders}."""
    path = _TEMPLATE_DIR / template_name
    html = path.read_text(encoding="utf-8")
    for key, value in kwargs.items():
        html = html.replace(f"{{{key}}}", str(value))
    return html


def _run(coro):  # noqa: ANN001
    """Run an async coroutine from a sync Celery task."""
    return asyncio.run(coro)


# ── Contract notification ────────────────────────────────────────────────────

async def _send_contract_email(contract_id: str, user_email: str) -> str:
    """Fetch contract from DB, render template, send email."""
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            text("""
                SELECT
                    c.type,
                    c.start_date,
                    c.monthly_rent,
                    b.adresse,
                    u.raw_user_meta_data->>'first_name' AS prenom
                FROM contracts c
                JOIN biens b ON b.id = c.bien_id
                LEFT JOIN auth.users u ON u.email = :email
                WHERE c.id = :cid
            """),
            {"cid": contract_id, "email": user_email},
        )).one_or_none()

    if not row:
        logger.warning("Contract %s not found — skipping email", contract_id)
        return "skipped-not-found"

    type_contrat = row.type or "Bail"
    date_debut = str(row.start_date or "—")
    loyer = f"{float(row.monthly_rent or 0):,.0f}" if row.monthly_rent else "—"
    adresse = row.adresse or "—"
    prenom = row.prenom or "Cher client"
    link = f"{settings.FRONTEND_URL}/app/contracts"

    html = _render(
        "contract_created.html",
        prenom=prenom,
        type_contrat=type_contrat,
        adresse=adresse,
        date_debut=date_debut,
        loyer=loyer,
        link=link,
    )

    return await send_email(
        to=user_email,
        subject=f"Contrat créé — {adresse}",
        html=html,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_contract_notification(self, contract_id: str, user_email: str) -> dict:
    """Send an email notification when a contract is created or updated."""
    try:
        msg_id = _run(_send_contract_email(contract_id, user_email))
        return {"status": "sent", "message_id": msg_id, "contract_id": contract_id, "email": user_email}
    except EmailServiceError as exc:
        logger.warning("Contract email failed (will retry): %s", exc)
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.error("Contract email unexpected error: %s", exc)
        raise self.retry(exc=exc)


# ── Transaction receipt ──────────────────────────────────────────────────────

TYPE_LABELS = {
    "rent": "Loyer",
    "commission": "Commission",
    "deposit": "Dépôt de garantie",
    "service": "Service",
}


async def _send_transaction_email(transaction_id: str, user_email: str) -> str:
    """Fetch transaction from DB, render template, send email."""
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            text("""
                SELECT
                    t.amount,
                    t.type,
                    t.status,
                    t.created_at,
                    b.adresse,
                    u.raw_user_meta_data->>'first_name' AS prenom
                FROM transactions t
                LEFT JOIN biens b ON b.id = t.bien_id
                LEFT JOIN auth.users u ON u.email = :email
                WHERE t.id = :tid
            """),
            {"tid": transaction_id, "email": user_email},
        )).one_or_none()

    if not row:
        logger.warning("Transaction %s not found — skipping email", transaction_id)
        return "skipped-not-found"

    montant = f"{float(row.amount or 0):,.2f}"
    type_transaction = TYPE_LABELS.get(row.type, row.type or "Transaction")
    statut = "Reçu" if row.status == "completed" else str(row.status or "—")
    date_str = row.created_at.strftime("%d.%m.%Y") if row.created_at else "—"
    adresse = row.adresse or "—"
    prenom = row.prenom or "Cher client"
    reference = transaction_id[:8].upper()
    link = f"{settings.FRONTEND_URL}/app/finances"

    html = _render(
        "transaction_receipt.html",
        prenom=prenom,
        montant=montant,
        type_transaction=type_transaction,
        reference=reference,
        date=date_str,
        adresse=adresse,
        statut=statut,
        link=link,
    )

    return await send_email(
        to=user_email,
        subject=f"Reçu — CHF {montant} ({type_transaction})",
        html=html,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_transaction_receipt(self, transaction_id: str, user_email: str) -> dict:
    """Send a receipt when a transaction is completed."""
    try:
        msg_id = _run(_send_transaction_email(transaction_id, user_email))
        return {"status": "sent", "message_id": msg_id, "transaction_id": transaction_id, "email": user_email}
    except EmailServiceError as exc:
        logger.warning("Transaction email failed (will retry): %s", exc)
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.error("Transaction email unexpected error: %s", exc)
        raise self.retry(exc=exc)
