"""
Celery tasks for rental management.

Tasks:
  generate_monthly_rents      — 1st of each month at 06:00 Paris time
  send_rent_reminders         — daily at 08:00 Paris time (checks J-3, J0, J+3, J+7)
  calculate_commissions       — daily at 09:00 Paris time
  reverse_loyers              — every hour — reverse les loyers reçus sur compte Althy
  _notify_proprio_reversement — notifie le proprio qu'un reversement a été effectué
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

    COMMISSION_PCT = 4.0  # 4% Althy (CLAUDE.md — affiché "loyer net reçu")
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


# ── generate_monthly_quittances ────────────────────────────────────────────────


@celery_app.task(bind=True, name="tasks.generate_monthly_quittances", max_retries=3)
def generate_monthly_quittances(self) -> dict:
    """
    Le 1er de chaque mois à 06h30 : génère une quittance pour chaque paiement
    reçu (statut = 'recu') du mois précédent sans quittance existante.
    Crée un enregistrement DocumentAlthy de type 'quittance'.
    """
    try:
        return _run(_generate_quittances_async())
    except Exception as exc:
        logger.exception("generate_monthly_quittances failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _generate_quittances_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.models.document_althy import DocumentAlthy
    from app.models.locataire import Locataire
    from app.models.paiement import Paiement
    from sqlalchemy import and_, exists, select

    now = datetime.now(UTC)
    # Mois précédent
    if now.month == 1:
        target_year, target_month = now.year - 1, 12
    else:
        target_year, target_month = now.year, now.month - 1
    mois_str = f"{target_year}-{target_month:02d}"

    created = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        # Paiements reçus du mois précédent sans quittance
        paiements = (await db.execute(
            select(Paiement).where(
                and_(
                    Paiement.mois == mois_str,
                    Paiement.statut == "recu",
                    ~exists().where(
                        and_(
                            DocumentAlthy.locataire_id == Paiement.locataire_id,
                            DocumentAlthy.type == "quittance",
                            DocumentAlthy.date_document >= date(target_year, target_month, 1),
                        )
                    ),
                )
            )
        )).scalars().all()

        for paiement in paiements:
            loyer_net = float(paiement.net_montant or paiement.montant)
            mois_label = f"{target_month:02d}/{target_year}"

            # Créer l'enregistrement document (URL placeholder — PDF généré par service docs)
            quittance = DocumentAlthy(
                bien_id=paiement.bien_id,
                locataire_id=paiement.locataire_id,
                type="quittance",
                url_storage=f"quittances/{paiement.bien_id}/{mois_str}.pdf",
                date_document=date(target_year, target_month, 1),
                genere_par_ia=True,
            )
            db.add(quittance)
            created += 1

        await db.commit()

    logger.info("generate_monthly_quittances: created=%d skipped=%d mois=%s", created, skipped, mois_str)
    return {"created": created, "skipped": skipped, "mois": mois_str}


# ══════════════════════════════════════════════════════════════════════════════
# reverse_loyers — Modèle transit Airbnb
# ══════════════════════════════════════════════════════════════════════════════


@celery_app.task(bind=True, name="tasks.reverse_loyers", max_retries=3)
def reverse_loyers(self) -> dict:
    """
    Cherche toutes les loyer_transactions avec statut='recu' et date_reversement IS NULL,
    prépare le reversement vers le proprio et met à jour le statut.

    Phase 1 MVP : le virement sortant réel est fait manuellement depuis l'e-banking.
    La task calcule les montants, met à jour le statut en 'reverse' et notifie le proprio.
    En Phase 2 : intégration API bancaire (PostFinance / BCGE) pour virement automatique.
    """
    try:
        return _run(_reverse_loyers_async())
    except Exception as exc:
        logger.exception("reverse_loyers failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _reverse_loyers_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.core.config import settings
    from sqlalchemy import text

    reversed_count = 0
    total_reverse  = 0.0

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            text("""
                SELECT lt.id, lt.owner_id, lt.montant_total, lt.commission_montant,
                       lt.montant_reverse, lt.mois_concerne, lt.qr_reference,
                       lt.property_id,
                       u.iban as owner_iban, u.email as owner_email,
                       u.first_name as owner_first_name
                FROM loyer_transactions lt
                LEFT JOIN users u ON u.id = lt.owner_id
                WHERE lt.statut = 'recu' AND lt.date_reversement IS NULL
                ORDER BY lt.date_reception ASC
            """)
        )).mappings().all()

        for row in rows:
            tx_id           = row["id"]
            montant_total   = float(row["montant_total"])
            commission_mnt  = float(row["commission_montant"])
            montant_reverse = float(row["montant_reverse"])
            owner_iban      = row["owner_iban"]
            owner_email     = row["owner_email"]
            owner_name      = row["owner_first_name"] or "Propriétaire"
            mois_label      = row["mois_concerne"].strftime("%B %Y") if row["mois_concerne"] else "—"

            # ── Phase 1 MVP : marquer comme 'reverse' sans virement automatique ──
            # En Phase 2, appeler ici l'API bancaire (PostFinance / ISO 20022 pain.001)
            await db.execute(
                text("""
                    UPDATE loyer_transactions
                    SET statut = 'reverse',
                        date_reversement = now(),
                        updated_at = now()
                    WHERE id = :id
                """),
                {"id": str(tx_id)},
            )

            reversed_count += 1
            total_reverse  += montant_reverse

            # ── Notification in-app + email ──
            notif_body = (
                f"Loyer {mois_label} reçu. "
                f"Montant brut : CHF {montant_total:,.2f} — "
                f"Commission Althy : CHF {commission_mnt:,.2f} — "
                f"Reversé : CHF {montant_reverse:,.2f}"
            )
            if owner_iban:
                notif_body += f" → {owner_iban}"

            # Crée notification in-app
            notif_id = uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO notifications (id, user_id, type, title, body, lu, created_at)
                    VALUES (:id, :uid, 'loyer_reverse', 'Loyer reversé', :body, false, now())
                """),
                {"id": notif_id, "uid": str(row["owner_id"]), "body": notif_body},
            )

            logger.info(
                "reverse_loyers: tx=%s owner=%s montant_reverse=%.2f",
                tx_id, owner_email, montant_reverse,
            )

        await db.commit()

    logger.info(
        "reverse_loyers done: reversed=%d total_CHF=%.2f",
        reversed_count, total_reverse,
    )
    return {"reversed": reversed_count, "total_reverse_chf": round(total_reverse, 2)}


# ── Notification individuelle (appelée depuis PATCH /loyers/{id}/statut) ──────


@celery_app.task(bind=True, name="tasks.notify_proprio_reversement", max_retries=2)
def _notify_proprio_reversement(self, transaction_id: str) -> dict:
    """Envoie la notification de reversement pour une transaction spécifique."""
    try:
        return _run(_notify_reversement_async(transaction_id))
    except Exception as exc:
        logger.exception("_notify_proprio_reversement failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)


async def _notify_reversement_async(transaction_id: str) -> dict:
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            text("""
                SELECT lt.owner_id, lt.montant_total, lt.commission_montant, lt.montant_reverse,
                       lt.mois_concerne, lt.reference_virement_sortant,
                       u.email as owner_email
                FROM loyer_transactions lt
                LEFT JOIN users u ON u.id = lt.owner_id
                WHERE lt.id = :id
            """),
            {"id": transaction_id},
        )).mappings().one_or_none()

        if not row:
            return {"status": "not_found"}

        mois_label = row["mois_concerne"].strftime("%B %Y") if row["mois_concerne"] else "—"
        body = (
            f"Loyer {mois_label} — Reversement effectué. "
            f"Brut: CHF {float(row['montant_total']):,.2f} · "
            f"Commission: CHF {float(row['commission_montant']):,.2f} · "
            f"Net versé: CHF {float(row['montant_reverse']):,.2f}"
        )
        if row["reference_virement_sortant"]:
            body += f" (réf. {row['reference_virement_sortant']})"

        notif_id = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO notifications (id, user_id, type, title, body, lu, created_at)
                VALUES (:id, :uid, 'loyer_reverse', 'Loyer reversé', :body, false, now())
            """),
            {"id": notif_id, "uid": str(row["owner_id"]), "body": body},
        )
        await db.commit()

    logger.info("notify_proprio_reversement: tx=%s", transaction_id)
    return {"status": "notified", "transaction_id": transaction_id}
