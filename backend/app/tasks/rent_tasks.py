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
    """Crée une LoyerTransaction du mois pour chaque bail actif.

    Sprint 8 Lot B (2026-05-13) — refonte §B.13 : la cron écrivait
    historiquement dans la table `transactions` (modèle legacy hors W7).
    On bascule sur `loyer_transactions` (source de vérité Phase 1.0,
    cf migration 0047) en partant de Locataire (statut=actif) joint au
    Bien (statut=loue). Idempotent via (bien_id, tenant_id, mois_concerne).
    """
    try:
        return _run(_generate_monthly_rents_async())
    except Exception as exc:
        logger.exception("generate_monthly_rents failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _generate_monthly_rents_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.models.bien import Bien
    from app.models.locataire import Locataire
    from app.models.loyer_transaction import LoyerTransaction
    from app.services.qr_facture import generate_qr_reference
    from sqlalchemy import select

    today = date.today()
    mois_concerne = today.replace(day=1)
    mois_str = mois_concerne.strftime("%Y-%m")

    created = 0
    skipped = 0
    created_refs: list[tuple] = []  # (loyer_tx, locataire, bien) — emails best-effort post-commit

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(Locataire, Bien)
                .join(Bien, Locataire.bien_id == Bien.id)
                .where(
                    Locataire.statut == "actif",
                    Bien.statut == "loue",
                )
            )
        ).all()

        for locataire, bien in rows:
            # Idempotence — (bien_id, tenant_id, mois_concerne)
            existing = await db.scalar(
                select(LoyerTransaction.id).where(
                    LoyerTransaction.bien_id == bien.id,
                    LoyerTransaction.tenant_id == locataire.id,
                    LoyerTransaction.mois_concerne == mois_concerne,
                )
            )
            if existing:
                skipped += 1
                continue

            montant = locataire.loyer if locataire.loyer is not None else bien.loyer
            if not montant or float(montant) <= 0:
                continue

            montant_total = float(montant)
            qr_ref = generate_qr_reference(bien.id, locataire.id, mois_str)
            new_tx = LoyerTransaction(
                bien_id=bien.id,
                tenant_id=locataire.id,
                owner_id=bien.owner_id,
                montant_total=montant_total,
                # Phase 1.0 : pas de commission Stripe Connect (§B.15).
                # L'endpoint /loyers/generer-qr historique applique encore
                # `ALTHY_COMMISSION_PCT` (3%) ; la cron Phase 1.0 reste à
                # 0% pour cohérence Sunimmo (logiciel de gestion pur).
                commission_pct=0,
                commission_montant=0,
                montant_reverse=montant_total,
                qr_reference=qr_ref,
                statut="en_attente",
                mois_concerne=mois_concerne,
            )
            db.add(new_tx)
            created_refs.append((new_tx, locataire, bien))
            created += 1

        await db.commit()

    # Email best-effort (§B.12) — câblage Sprint 8 Lot B c2.
    emails_sent = 0
    emails_failed = 0
    if created_refs:
        try:
            from app.services.email_service import send_qr_facture_email
        except ImportError:
            send_qr_facture_email = None  # type: ignore[assignment]

        for tx, loc, bn in created_refs:
            if send_qr_facture_email is None:
                break
            try:
                await send_qr_facture_email(loyer_tx=tx, locataire=loc, bien=bn)
                emails_sent += 1
            except Exception as exc:  # noqa: BLE001 — best-effort isolé
                logger.warning(
                    "generate_monthly_rents: email QR-facture KO tx=%s: %s",
                    tx.id, exc,
                )
                emails_failed += 1

    logger.info(
        "generate_monthly_rents: created=%d skipped=%d emails_sent=%d emails_failed=%d mois=%s",
        created, skipped, emails_sent, emails_failed, mois_str,
    )
    return {
        "created": created,
        "skipped": skipped,
        "emails_sent": emails_sent,
        "emails_failed": emails_failed,
        "mois": mois_str,
    }


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
                bien_id=rent.bien_id,
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
    """Sprint 8 Lot B (§B.10 fix + alignement source W7) — génère PDF + upload réel.

    Avant : la task créait un DocumentAlthy avec url_storage = chemin théorique
    sans jamais uploader le PDF → fausse trace dans la DB (§B.10).
    Après : (1) on lit depuis `loyer_transactions` (source de vérité W7,
    cf B1/CAMT-054), (2) on génère réellement le PDF via
    `generate_quittance_pdf`, (3) on upload via `storage.upload_pdf`, et
    (4) on insère DocumentAlthy uniquement si l'upload a réussi.
    En cas d'échec individuel : log + skip (best-effort, rejoué à la
    prochaine itération de la cron).

    Source DB : `loyer_transactions` (statut IN ('recu', 'reverse') car
    après reversement Althy → propriétaire, le loyer reste « reçu »
    pour le locataire qui en attend la quittance).
    """
    from app.core.database import AsyncSessionLocal
    from app.models.document_althy import DocumentAlthy
    from app.services.quittance import generate_quittance_pdf
    from app.services.storage import upload_pdf
    from sqlalchemy import text

    now = datetime.now(UTC)
    # Mois précédent
    if now.month == 1:
        target_year, target_month = now.year - 1, 12
    else:
        target_year, target_month = now.year, now.month - 1
    mois_concerne = date(target_year, target_month, 1)
    mois_str = mois_concerne.strftime("%Y-%m")
    # Label métier lisible — la quittance doit afficher "Octobre 2026" et non "10/2026".
    mois_label = mois_concerne.strftime("%B %Y").capitalize()

    created = 0
    skipped = 0
    upload_failed = 0

    async with AsyncSessionLocal() as db:
        # Loyers reçus du mois cible, joints bien + owner + tenant.
        # Idempotent via NOT EXISTS sur DocumentAlthy (type=quittance, même mois).
        rows = (await db.execute(
            text("""
                SELECT lt.id              AS loyer_id,
                       lt.bien_id         AS bien_id,
                       lt.tenant_id       AS tenant_id,
                       lt.owner_id        AS owner_id,
                       lt.montant_total   AS montant_total,
                       b.adresse          AS bien_adresse,
                       b.charges          AS bien_charges,
                       ou.first_name      AS owner_first_name,
                       ou.last_name       AS owner_last_name,
                       ou.email           AS owner_email,
                       op.address         AS owner_address,
                       tu.first_name      AS tenant_first_name,
                       tu.last_name       AS tenant_last_name,
                       tu.email           AS tenant_email
                FROM loyer_transactions lt
                JOIN biens b           ON b.id = lt.bien_id
                LEFT JOIN users    ou  ON ou.id = lt.owner_id
                LEFT JOIN profiles op  ON op.user_id = lt.owner_id
                LEFT JOIN locataires l ON l.id = lt.tenant_id
                LEFT JOIN users    tu  ON tu.id = l.user_id
                WHERE lt.statut IN ('recu', 'reverse')
                  AND lt.mois_concerne = :mois
                  AND NOT EXISTS (
                      SELECT 1 FROM documents d
                      WHERE d.type = 'quittance'
                        AND d.bien_id = lt.bien_id
                        AND d.locataire_id = lt.tenant_id
                        AND d.date_document = :mois
                  )
            """),
            {"mois": mois_concerne},
        )).mappings().all()

        for ctx in rows:
            montant = float(ctx["montant_total"] or 0)
            if montant <= 0:
                skipped += 1
                continue

            proprio_name = " ".join(filter(None, [
                ctx["owner_first_name"], ctx["owner_last_name"]
            ])).strip() or (
                ctx["owner_email"].split("@")[0].capitalize() if ctx["owner_email"] else "Propriétaire"
            )
            tenant_name = " ".join(filter(None, [
                ctx["tenant_first_name"], ctx["tenant_last_name"]
            ])).strip() or (
                ctx["tenant_email"].split("@")[0].capitalize() if ctx["tenant_email"] else "Locataire"
            )

            # montant_total est all-inclusive (loyer + charges si applicable, cf
            # /loyers/generer-qr + cron B1). On affiche un seul total sans
            # double-comptage pour ne pas surfacer une ligne charges fictive.
            quittance_charges = 0.0
            quittance_montant = montant

            # ── PDF ──
            try:
                pdf_bytes = generate_quittance_pdf(
                    proprio_name=proprio_name,
                    proprio_address=ctx["owner_address"] or "",
                    tenant_name=tenant_name,
                    bien_adresse=ctx["bien_adresse"] or "",
                    mois_label=mois_label,
                    montant=quittance_montant,
                    charges=quittance_charges,
                )
            except Exception as exc:
                logger.exception(
                    "generate_monthly_quittances: PDF render KO loyer=%s: %s",
                    ctx["loyer_id"], exc,
                )
                upload_failed += 1
                continue

            # ── Upload Supabase Storage ──
            try:
                key = await upload_pdf(
                    user_id=str(ctx["owner_id"]),
                    bien_id=str(ctx["bien_id"]),
                    doc_type="quittance",
                    mois=mois_str,
                    pdf_bytes=pdf_bytes,
                )
            except Exception as exc:
                logger.exception(
                    "generate_monthly_quittances: upload Storage KO loyer=%s: %s",
                    ctx["loyer_id"], exc,
                )
                upload_failed += 1
                continue

            # ── Enregistrement DB (uniquement si upload OK — §B.10) ──
            quittance = DocumentAlthy(
                bien_id=ctx["bien_id"],
                locataire_id=ctx["tenant_id"],
                type="quittance",
                url_storage=key,
                date_document=mois_concerne,
                genere_par_ia=True,
            )
            db.add(quittance)
            created += 1

        await db.commit()

    logger.info(
        "generate_monthly_quittances: created=%d skipped=%d upload_failed=%d mois=%s",
        created, skipped, upload_failed, mois_str,
    )
    return {
        "created": created,
        "skipped": skipped,
        "upload_failed": upload_failed,
        "mois": mois_str,
    }


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
    from sqlalchemy import text

    reversed_count = 0
    total_reverse  = 0.0

    async with AsyncSessionLocal() as db:
        # Sprint 9 Lot A : colonne `users.iban` renommée `iban_legacy` par
        # migration 0050. L'IBAN canonique vit désormais dans `bank_accounts`
        # (cf `iban_resolver.get_effective_iban`). Pour ce reverse en Phase 1
        # MVP (notification uniquement, pas de virement réel — cf §4.13), on
        # JOIN directement sur `bank_accounts` principal côté SQL pour éviter
        # d'appeler le resolver async ligne par ligne. Fallback `iban_legacy`
        # gardé pour les users non encore re-seedés (théoriquement zéro
        # post-0050 grâce au backfill idempotent).
        rows = (await db.execute(
            text("""
                SELECT lt.id, lt.owner_id, lt.montant_total, lt.commission_montant,
                       lt.montant_reverse, lt.mois_concerne, lt.qr_reference,
                       lt.bien_id,
                       COALESCE(ba.iban, u.iban_legacy) as owner_iban,
                       u.email as owner_email,
                       u.first_name as owner_first_name
                FROM loyer_transactions lt
                LEFT JOIN users u ON u.id = lt.owner_id
                LEFT JOIN bank_accounts ba
                       ON ba.user_id = lt.owner_id
                      AND ba.est_principal = true
                      AND ba.is_active = true
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
