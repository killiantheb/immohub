"""Celery AI tasks — daily briefing for all active users."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from app.tasks.celery_app import celery_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


def _run(coro):
    return asyncio.run(coro)


# ── Daily briefing ─────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="tasks.daily_briefing_all_users", max_retries=2)
def daily_briefing_all_users(self) -> dict:
    """Generate and store a personalised daily briefing for each active user (07:00)."""
    try:
        return _run(_daily_briefing_async())
    except Exception as exc:
        logger.exception("daily_briefing_all_users failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)


async def _daily_briefing_async() -> dict:
    from anthropic import AsyncAnthropic
    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.models.bien import Bien
    from app.models.intervention import Intervention
    from app.models.locataire import DossierLocataire, Locataire
    from app.models.mission_ouvreur import MissionOuvreur
    from app.models.notification import Notification
    from app.models.paiement import Paiement
    from app.models.user import User
    from sqlalchemy import and_, select

    today = date.today()
    today_str = today.isoformat()
    in_90d = today + timedelta(days=90)
    stale_threshold = today - timedelta(days=7)
    created = 0

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async with AsyncSessionLocal() as db:
        # Fetch active managers and agencies
        users_res = await db.execute(
            select(User).where(
                User.role.in_(["owner", "agency", "proprio_solo", "agence"])
            )
        )
        users = users_res.scalars().all()

        for user in users:
            try:
                context_lines: list[str] = []

                # ── Biens de l'utilisateur ────────────────────────────────────
                biens_res = await db.execute(
                    select(Bien).where(Bien.owner_id == user.id)
                )
                biens = biens_res.scalars().all()
                bien_ids = [b.id for b in biens]

                if not bien_ids:
                    continue  # No properties → skip

                # ── Loyers en retard ──────────────────────────────────────────
                retard_res = await db.execute(
                    select(Paiement).where(
                        and_(
                            Paiement.bien_id.in_(bien_ids),
                            Paiement.statut == "retard",
                        )
                    )
                )
                retards = retard_res.scalars().all()
                if retards:
                    context_lines.append(
                        f"{len(retards)} loyer(s) en retard"
                        + (f", dont {retards[0].jours_retard}j pour le plus ancien" if retards[0].jours_retard else "")
                    )

                # ── Loyers attendus aujourd'hui ───────────────────────────────
                today_res = await db.execute(
                    select(Paiement).where(
                        and_(
                            Paiement.bien_id.in_(bien_ids),
                            Paiement.statut == "en_attente",
                            Paiement.date_echeance == today,
                        )
                    )
                )
                today_dues = today_res.scalars().all()
                if today_dues:
                    total = sum(float(p.montant) for p in today_dues)
                    context_lines.append(f"{len(today_dues)} loyer(s) attendu(s) aujourd'hui ({total:.0f} CHF)")

                # ── Baux expirant dans 30/60/90 jours ────────────────────────
                locs_res = await db.execute(
                    select(Locataire).where(
                        and_(
                            Locataire.bien_id.in_(bien_ids),
                            Locataire.statut == "actif",
                            Locataire.date_sortie.isnot(None),
                            Locataire.date_sortie <= in_90d,
                            Locataire.date_sortie >= today,
                        )
                    )
                )
                expiring = locs_res.scalars().all()
                for loc in expiring:
                    if loc.date_sortie:
                        days_left = (loc.date_sortie - today).days
                        label = "30j" if days_left <= 30 else ("60j" if days_left <= 60 else "90j")
                        context_lines.append(f"Bail expirant dans {days_left}j ({label})")

                # ── Interventions sans màj depuis 7j ─────────────────────────
                stale_res = await db.execute(
                    select(Intervention).where(
                        and_(
                            Intervention.bien_id.in_(bien_ids),
                            Intervention.statut == "en_cours",
                            Intervention.created_at <= stale_threshold,
                        )
                    )
                )
                stale = stale_res.scalars().all()
                if stale:
                    context_lines.append(f"{len(stale)} intervention(s) en cours sans màj depuis 7+ jours")

                # ── Attestations assurance RC à renouveler ────────────────────
                loc_ids_res = await db.execute(
                    select(Locataire.id).where(
                        and_(
                            Locataire.bien_id.in_(bien_ids),
                            Locataire.statut == "actif",
                        )
                    )
                )
                loc_ids = [r[0] for r in loc_ids_res.fetchall()]

                if loc_ids:
                    expiry_res = await db.execute(
                        select(DossierLocataire).where(
                            and_(
                                DossierLocataire.locataire_id.in_(loc_ids),
                                DossierLocataire.validite_assurance.isnot(None),
                                DossierLocataire.validite_assurance <= today + timedelta(days=30),
                                DossierLocataire.validite_assurance >= today,
                            )
                        )
                    )
                    expiring_rc = expiry_res.scalars().all()
                    if expiring_rc:
                        context_lines.append(f"{len(expiring_rc)} attestation(s) RC locataire à renouveler dans 30j")

                # ── Missions ouvreur du jour ──────────────────────────────────
                missions_res = await db.execute(
                    select(MissionOuvreur).where(
                        and_(
                            MissionOuvreur.bien_id.in_(bien_ids),
                            MissionOuvreur.date_mission == today_str,
                            MissionOuvreur.statut.in_(["acceptee", "proposee", "publiee"]),
                        )
                    )
                )
                missions = missions_res.scalars().all()
                if missions:
                    context_lines.append(f"{len(missions)} mission(s) ouvreur aujourd'hui")

                if not context_lines:
                    context_lines.append("Aucun élément urgent. Tout est à jour.")

                # ── Generate briefing via Claude ──────────────────────────────
                context_text = "\n".join(f"- {line}" for line in context_lines)
                first_name = user.first_name or user.email.split("@")[0]

                response = await client.messages.create(
                    model="claude-sonnet-4-5",
                    max_tokens=1024,
                    system=(
                        "Tu es Althy, assistante immobilière suisse. "
                        "Génère un briefing concis en français (max 3 lignes) pour ce gestionnaire. "
                        "Sois direct, actionnable et professionnel. Pas de salutation."
                    ),
                    messages=[{
                        "role": "user",
                        "content": f"Briefing du {today.strftime('%d/%m/%Y')} pour {first_name} :\n{context_text}",
                    }],
                )

                briefing_text = response.content[0].text.strip()

                # ── Store as notification ─────────────────────────────────────
                notif = Notification(
                    user_id=user.id,
                    type="briefing_quotidien",
                    titre=f"Briefing du {today.strftime('%d/%m/%Y')}",
                    message=briefing_text,
                    lu=False,
                )
                db.add(notif)
                created += 1

            except Exception as exc:
                logger.warning("Briefing failed for user %s: %s", user.id, exc)

        await db.commit()

    logger.info("daily_briefing_all_users: created=%d briefings", created)
    return {"briefings_created": created, "date": today_str}
