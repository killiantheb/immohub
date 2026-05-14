"""Emails transactionnels Sprint 10 — workflows signature + approbation + EDL.

§2.4.16 doctrine — Skribble SES Phase 1.0. 10 templates dans
`backend/app/templates/emails/` rendus via `.format()` (pattern existant,
pas Jinja2).

Doctrine :
  - §B.10 : si Resend retourne ≠ 2xx → propage EmailServiceError (caller 502).
  - §B.11 : ton sobre et professionnel, pas de marketing.
  - §B.12 : session DB dédiée `AsyncSessionLocal()` par appel (les triggers
    peuvent venir de routers/webhooks → on n'utilise pas leur session).

Helpers `send_*` chargent l'entité, résolvent le destinataire et le sender_name
dynamique, rendent le template, appellent `email_service.send_email`.
"""

from __future__ import annotations

import logging
import os
import uuid

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.avenant import Avenant
from app.models.contract import Contract
from app.models.mandat_gestion import MandatGestion
from app.models.resiliation import Resiliation
from app.models.user import User
from app.services.email_service import EmailServiceError, send_email
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("althy.sprint10_emails")

_TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "templates",
    "emails",
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _load_pair(name: str) -> tuple[str, str]:
    """Charge la paire .html + .txt d'un template depuis le dossier emails."""
    base = os.path.join(_TEMPLATES_DIR, name)
    with open(base + ".html", encoding="utf-8") as f:
        html = f.read()
    with open(base + ".txt", encoding="utf-8") as f:
        text_body = f.read()
    return html, text_body


def _common_ctx() -> dict[str, str]:
    """Variables communes à tous les templates (footer)."""
    return {
        "althy_creditor_name": settings.ALTHY_CREDITOR_NAME,
        "emails_from": settings.EMAILS_FROM,
    }


def _full_name(user: User) -> str:
    parts = [p for p in (user.first_name, user.last_name) if p]
    return " ".join(parts) or user.email.split("@")[0]


def _frontend_url(path: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


async def _resolve_sender_name(db: AsyncSession, user_id: uuid.UUID | None) -> str | None:
    """Sender name dynamique : agency_settings.agency_name > first+last > None.

    Si role=agence et agency_name renseigné → utilise agency_name.
    Sinon utilise first_name + last_name. Si None → fallback "Althy" côté
    email_service.
    """
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    if user is None:
        return None
    if user.role == "agence":
        row = await db.execute(
            text("SELECT agency_name FROM agency_settings WHERE user_id = :uid"),
            {"uid": str(user_id)},
        )
        rec = row.one_or_none()
        if rec and rec.agency_name and rec.agency_name.strip():
            return rec.agency_name.strip()
    full = _full_name(user)
    return full if full else None


# ── 1. Approbation propriétaire ──────────────────────────────────────────────


async def send_approbation_proprietaire(
    candidature_id: uuid.UUID,
    approval_token: str | None = None,
    deny_token: str | None = None,
) -> str | None:
    """Envoie la demande d'approbation au propriétaire.

    `candidature_id` = en Phase 1.0 c'est l'ID d'un `DossierLocataire`
    (cf §2.4.16 — pas de candidature marketplace Phase 2). Les tokens magic_link
    sont fournis par Lot 5 (workflow approbation) ; à défaut, lien vers /app.
    """
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("""
                    SELECT
                        dl.id AS dossier_id,
                        dl.employeur, dl.poste, dl.salaire_net,
                        dl.type_contrat, dl.anciennete,
                        l.id AS locataire_id, l.user_id AS candidate_user_id,
                        l.loyer, l.charges,
                        b.id AS bien_id, b.owner_id, b.adresse, b.cp, b.ville
                    FROM dossiers_locataires dl
                    JOIN locataires l ON l.id = dl.locataire_id
                    JOIN biens b ON b.id = l.bien_id
                    WHERE dl.id = :did
                """),
                {"did": str(candidature_id)},
            )
        ).fetchone()
        if row is None:
            logger.warning("send_approbation_proprietaire: dossier %s introuvable", candidature_id)
            return None

        owner = await db.get(User, row.owner_id)
        candidate = await db.get(User, row.candidate_user_id) if row.candidate_user_id else None
        if owner is None or not owner.email:
            logger.info("send_approbation_proprietaire: pas d'email owner")
            return None

        approval_link = (
            _frontend_url(f"/approuver/{approval_token}")
            if approval_token
            else _frontend_url(f"/app/dossiers/{candidature_id}")
        )
        deny_link = (
            _frontend_url(f"/approuver/{deny_token}?action=refuse")
            if deny_token
            else _frontend_url(f"/app/dossiers/{candidature_id}?action=refuse")
        )

        candidate_name = _full_name(candidate) if candidate else "Candidat"
        dossier_summary_parts = []
        if row.poste:
            dossier_summary_parts.append(f"{row.poste}")
        if row.employeur:
            dossier_summary_parts.append(f"chez {row.employeur}")
        if row.type_contrat:
            dossier_summary_parts.append(f"({row.type_contrat.upper()})")
        if row.salaire_net:
            sal = f"{float(row.salaire_net):,.0f}".replace(",", "'")
            dossier_summary_parts.append(f"— revenu net CHF {sal}")
        summary = " ".join(dossier_summary_parts) or "Dossier complet à 100%"

        loyer = row.loyer or 0
        monthly_rent_fmt = (
            f"{float(loyer):,.2f}".replace(",", "'") if loyer else "—"
        )

        html, text_body = _load_pair("approbation_proprietaire")
        ctx = {
            **_common_ctx(),
            "owner_name": _full_name(owner),
            "candidate_full_name": candidate_name,
            "candidate_dossier_summary": summary,
            "bien_address": f"{row.adresse}, {row.cp} {row.ville}",
            "monthly_rent": monthly_rent_fmt,
            "approval_link": approval_link,
            "deny_link": deny_link,
            "expires_at_formatted": "dans 14 jours",
        }

        sender = await _resolve_sender_name(db, row.owner_id)
        return await send_email(
            to=owner.email,
            subject=f"Demande d'approbation — {candidate_name}",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=sender,
        )


# ── 2. Approbation donnée ────────────────────────────────────────────────────


async def send_approbation_donnee(candidature_id: uuid.UUID) -> str | None:
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("""
                    SELECT b.adresse, b.cp, b.ville, b.owner_id,
                           u.first_name, u.last_name, u.email AS owner_email,
                           lu.first_name AS cand_first, lu.last_name AS cand_last
                    FROM dossiers_locataires dl
                    JOIN locataires l ON l.id = dl.locataire_id
                    JOIN biens b ON b.id = l.bien_id
                    JOIN users u ON u.id = b.owner_id
                    LEFT JOIN users lu ON lu.id = l.user_id
                    WHERE dl.id = :did
                """),
                {"did": str(candidature_id)},
            )
        ).fetchone()
        if row is None or not row.owner_email:
            return None

        html, text_body = _load_pair("approbation_donnee")
        owner_name = " ".join(p for p in (row.first_name, row.last_name) if p) or "Bailleur"
        cand_name = " ".join(p for p in (row.cand_first, row.cand_last) if p) or "le candidat"
        next_steps_html = (
            "<li>Création automatique du bail (status=draft)</li>"
            "<li>Envoi du bail au locataire pour signature électronique Skribble</li>"
            "<li>Contre-signature par l'agence-mandataire</li>"
            "<li>Activation du bail + génération de la 1<sup>re</sup> QR-facture</li>"
        )
        next_steps_txt = (
            "1. Création automatique du bail (status=draft)\n"
            "2. Envoi du bail au locataire pour signature électronique Skribble\n"
            "3. Contre-signature par l'agence-mandataire\n"
            "4. Activation du bail + génération de la 1re QR-facture"
        )
        ctx_html = {
            **_common_ctx(),
            "owner_name": owner_name,
            "candidate_name": cand_name,
            "next_steps": next_steps_html,
            "bien_address": f"{row.adresse}, {row.cp} {row.ville}",
        }
        ctx_txt = {**ctx_html, "next_steps": next_steps_txt}
        sender = await _resolve_sender_name(db, row.owner_id)
        return await send_email(
            to=row.owner_email,
            subject="Approbation enregistrée",
            html=html.format(**ctx_html),
            text=text_body.format(**ctx_txt),
            sender_name=sender,
        )


# ── 3. Candidat refusé ───────────────────────────────────────────────────────


async def send_candidat_refuse(candidature_id: uuid.UUID) -> str | None:
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("""
                    SELECT b.adresse, b.cp, b.ville, b.agence_id,
                           u.email AS cand_email, u.first_name, u.last_name,
                           agcs.agency_name
                    FROM dossiers_locataires dl
                    JOIN locataires l ON l.id = dl.locataire_id
                    JOIN biens b ON b.id = l.bien_id
                    LEFT JOIN users u ON u.id = l.user_id
                    LEFT JOIN agency_settings agcs ON agcs.user_id = b.agence_id
                    WHERE dl.id = :did
                """),
                {"did": str(candidature_id)},
            )
        ).fetchone()
        if row is None or not row.cand_email:
            return None
        html, text_body = _load_pair("candidat_refuse")
        ctx = {
            **_common_ctx(),
            "candidate_name": " ".join(p for p in (row.first_name, row.last_name) if p) or "Locataire",
            "bien_address": f"{row.adresse}, {row.cp} {row.ville}",
            "agency_name": row.agency_name or settings.ALTHY_CREDITOR_NAME,
        }
        return await send_email(
            to=row.cand_email,
            subject="Mise à jour de votre dossier locataire",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=row.agency_name,
        )


# ── 4. Signature bail — locataire ────────────────────────────────────────────


async def send_signature_bail_locataire(
    contract_id: uuid.UUID, skribble_signing_url: str | None = None
) -> str | None:
    async with AsyncSessionLocal() as db:
        contract = await db.get(Contract, contract_id)
        if contract is None or contract.tenant_id is None:
            return None
        tenant = await db.get(User, contract.tenant_id)
        if tenant is None or not tenant.email:
            return None
        bien_row = (
            await db.execute(
                text("SELECT adresse, cp, ville FROM biens WHERE id = :bid"),
                {"bid": str(contract.bien_id)},
            )
        ).fetchone()
        bien_address = (
            f"{bien_row.adresse}, {bien_row.cp} {bien_row.ville}"
            if bien_row else "votre logement"
        )

        url = skribble_signing_url or _frontend_url(f"/app/contracts/{contract_id}/sign")
        html, text_body = _load_pair("signature_bail_locataire")
        ctx = {
            **_common_ctx(),
            "tenant_name": _full_name(tenant),
            "bien_address": bien_address,
            "contract_reference": contract.reference,
            "skribble_signing_url": url,
            "expires_at_formatted": "dans 7 jours",
        }
        sender = await _resolve_sender_name(db, contract.agency_id or contract.owner_id)
        return await send_email(
            to=tenant.email,
            subject=f"Signature du bail {contract.reference}",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=sender,
        )


# ── 5. Signature bail — agence (contre-signature) ────────────────────────────


async def send_signature_bail_agence(
    contract_id: uuid.UUID, skribble_signing_url: str | None = None
) -> str | None:
    async with AsyncSessionLocal() as db:
        contract = await db.get(Contract, contract_id)
        if contract is None or contract.agency_id is None:
            return None
        agence = await db.get(User, contract.agency_id)
        if agence is None or not agence.email:
            return None

        url = skribble_signing_url or _frontend_url(f"/app/contracts/{contract_id}/sign")
        sender = await _resolve_sender_name(db, contract.agency_id)
        agency_label = sender or _full_name(agence)

        summary_lines = []
        if contract.tenant_signed_at:
            summary_lines.append(
                f"Locataire signé le {contract.tenant_signed_at.strftime('%d.%m.%Y')}"
            )
        if contract.signed_at:
            summary_lines.append(
                f"Bailleur signé le {contract.signed_at.strftime('%d.%m.%Y')}"
            )
        signed_by_summary = " · ".join(summary_lines) or "Locataire signé via Skribble"

        html, text_body = _load_pair("signature_bail_agence")
        ctx = {
            **_common_ctx(),
            "agency_name": agency_label,
            "contract_reference": contract.reference,
            "signed_by_summary": signed_by_summary,
            "skribble_signing_url": url,
        }
        return await send_email(
            to=agence.email,
            subject=f"Contre-signature requise — {contract.reference}",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=None,
        )


# ── 6. Bail signé par tous (à locataire + bailleur) ──────────────────────────


async def send_bail_signe_tous(
    contract_id: uuid.UUID, signed_pdf_url: str | None = None
) -> tuple[str | None, str | None]:
    """Envoie 2 emails : un au locataire, un au bailleur.

    Retourne (msg_id_locataire, msg_id_bailleur) — l'un peut être None si l'user
    n'a pas d'email.
    """
    async with AsyncSessionLocal() as db:
        contract = await db.get(Contract, contract_id)
        if contract is None:
            return (None, None)

        bien_row = (
            await db.execute(
                text("SELECT adresse, cp, ville FROM biens WHERE id = :bid"),
                {"bid": str(contract.bien_id)},
            )
        ).fetchone()
        bien_address = (
            f"{bien_row.adresse}, {bien_row.cp} {bien_row.ville}"
            if bien_row else "votre logement"
        )
        pdf_url = signed_pdf_url or _frontend_url(f"/app/contracts/{contract_id}")
        start_date = (
            contract.start_date.strftime("%d.%m.%Y") if contract.start_date else "—"
        )

        prochaines_html = (
            "<ul style='margin:0;padding-left:20px;'>"
            "<li>Première QR-facture envoyée par email le 1<sup>er</sup> du mois</li>"
            "<li>État des lieux d'entrée à planifier (vous recevrez une invitation)</li>"
            "<li>Caution à verser dans les 10 jours</li>"
            "</ul>"
        )
        prochaines_txt = (
            "- Première QR-facture envoyée par email le 1er du mois\n"
            "- État des lieux d'entrée à planifier (vous recevrez une invitation)\n"
            "- Caution à verser dans les 10 jours"
        )

        html, text_body = _load_pair("bail_signe_tous")

        msg_locataire: str | None = None
        msg_bailleur: str | None = None

        if contract.tenant_id:
            tenant = await db.get(User, contract.tenant_id)
            if tenant and tenant.email:
                ctx_html = {
                    **_common_ctx(),
                    "tenant_name": _full_name(tenant),
                    "contract_reference": contract.reference,
                    "bien_address": bien_address,
                    "start_date_formatted": start_date,
                    "signed_pdf_url": pdf_url,
                    "prochaines_etapes": prochaines_html,
                }
                ctx_txt = {**ctx_html, "prochaines_etapes": prochaines_txt}
                sender = await _resolve_sender_name(db, contract.agency_id or contract.owner_id)
                msg_locataire = await send_email(
                    to=tenant.email,
                    subject=f"Bail {contract.reference} actif",
                    html=html.format(**ctx_html),
                    text=text_body.format(**ctx_txt),
                    sender_name=sender,
                )

        bailleur = await db.get(User, contract.owner_id)
        if bailleur and bailleur.email:
            ctx_html = {
                **_common_ctx(),
                "tenant_name": _full_name(bailleur),
                "contract_reference": contract.reference,
                "bien_address": bien_address,
                "start_date_formatted": start_date,
                "signed_pdf_url": pdf_url,
                "prochaines_etapes": prochaines_html,
            }
            ctx_txt = {**ctx_html, "prochaines_etapes": prochaines_txt}
            sender = (
                await _resolve_sender_name(db, contract.agency_id)
                if contract.agency_id else None
            )
            msg_bailleur = await send_email(
                to=bailleur.email,
                subject=f"Bail {contract.reference} actif",
                html=html.format(**ctx_html),
                text=text_body.format(**ctx_txt),
                sender_name=sender,
            )

        return (msg_locataire, msg_bailleur)


# ── 7. Avenant à signer (locataire) ──────────────────────────────────────────


_AVENANT_LABELS = {
    "animaux": "Autorisation d'animaux",
    "modification_loyer": "Modification du loyer",
    "modification_date": "Modification de la date",
    "prolongation": "Prolongation du bail",
    "resiliation_anticipee": "Résiliation anticipée",
    "changement_proprietaire": "Changement de propriétaire",
    "changement_locataire": "Changement de locataire",
    "charge_electrique": "Charge électrique",
    "accord_specifique": "Accord spécifique",
}


async def send_avenant_a_signer(
    avenant_id: uuid.UUID, skribble_signing_url: str | None = None
) -> str | None:
    async with AsyncSessionLocal() as db:
        avenant = await db.get(Avenant, avenant_id)
        if avenant is None:
            return None
        contract = await db.get(Contract, avenant.contract_id)
        if contract is None or contract.tenant_id is None:
            return None
        tenant = await db.get(User, contract.tenant_id)
        if tenant is None or not tenant.email:
            return None

        url = skribble_signing_url or _frontend_url(f"/app/avenants/{avenant_id}/sign")
        html, text_body = _load_pair("avenant_a_signer")
        ctx = {
            **_common_ctx(),
            "tenant_name": _full_name(tenant),
            "contract_reference": contract.reference,
            "avenant_type_label": _AVENANT_LABELS.get(
                avenant.avenant_type, avenant.avenant_type
            ),
            "avenant_objet": avenant.objet[:200],
            "skribble_signing_url": url,
        }
        sender = await _resolve_sender_name(db, contract.agency_id or contract.owner_id)
        return await send_email(
            to=tenant.email,
            subject=f"Avenant à signer — {contract.reference}",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=sender,
        )


# ── 8. Résiliation envoyée ───────────────────────────────────────────────────


async def send_resiliation_envoyee(resiliation_id: uuid.UUID) -> str | None:
    async with AsyncSessionLocal() as db:
        resiliation = await db.get(Resiliation, resiliation_id)
        if resiliation is None:
            return None
        contract = await db.get(Contract, resiliation.contract_id)
        if contract is None:
            return None

        recipient_user_id = None
        if resiliation.initiateur == "locataire":
            recipient_user_id = contract.tenant_id
        elif resiliation.initiateur == "bailleur":
            recipient_user_id = contract.owner_id
        elif resiliation.initiateur == "agence_mandataire":
            recipient_user_id = contract.agency_id
        if recipient_user_id is None:
            return None
        recipient = await db.get(User, recipient_user_id)
        if recipient is None or not recipient.email:
            return None

        warning_html = ""
        warning_txt = ""
        if resiliation.initiateur == "bailleur" and not contract.is_furnished:
            warning_html = (
                "<div style='background:#FFF6E5;border-left:3px solid #C9A961;"
                "padding:14px 18px;margin:0 0 16px 0;font-size:13px;line-height:1.6;"
                "color:#7A6428;'>"
                "<strong>Important :</strong> pour les baux d'habitation, la formule "
                "officielle cantonale (CO 266l) reste obligatoire. Ce courrier ne "
                "la remplace pas — pensez à la transmettre en parallèle au locataire."
                "</div>"
            )
            warning_txt = (
                "IMPORTANT : pour les baux d'habitation, la formule officielle "
                "cantonale (CO 266l) reste obligatoire. Ce courrier ne la "
                "remplace pas.\n"
            )

        html, text_body = _load_pair("resiliation_envoyee")
        ctx_html = {
            **_common_ctx(),
            "recipient_name": _full_name(recipient),
            "contract_reference": contract.reference,
            "date_resiliation_formatted": resiliation.date_resiliation.strftime("%d.%m.%Y"),
            "respect_preavis_bool": "Oui" if resiliation.respect_preavis else "Non",
            "message_co_266l": warning_html,
        }
        ctx_txt = {**ctx_html, "message_co_266l": warning_txt}
        sender = await _resolve_sender_name(db, contract.agency_id or contract.owner_id)
        return await send_email(
            to=recipient.email,
            subject=f"Résiliation enregistrée — {contract.reference}",
            html=html.format(**ctx_html),
            text=text_body.format(**ctx_txt),
            sender_name=sender,
        )


# ── 9. EDL à planifier ───────────────────────────────────────────────────────


async def send_edl_a_planifier(
    changement_id: uuid.UUID,
    phase: str,
    date_suggestion: str | None = None,
) -> str | None:
    """phase ∈ {entree, sortie}."""
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("""
                    SELECT b.adresse, b.cp, b.ville, b.owner_id,
                           l.user_id AS tenant_user_id,
                           u.email AS tenant_email,
                           u.first_name AS tenant_first, u.last_name AS tenant_last
                    FROM changements_locataire cl
                    JOIN biens b ON b.id = cl.bien_id
                    LEFT JOIN locataires l ON l.bien_id = b.id AND l.statut = 'actif'
                    LEFT JOIN users u ON u.id = l.user_id
                    WHERE cl.id = :cid
                """),
                {"cid": str(changement_id)},
            )
        ).fetchone()
        if row is None or not row.tenant_email:
            return None

        html, text_body = _load_pair("edl_a_planifier")
        phase_label = {"entree": "d'entrée", "sortie": "de sortie"}.get(phase, phase)
        ctx = {
            **_common_ctx(),
            "phase": phase_label,
            "bien_address": f"{row.adresse}, {row.cp} {row.ville}",
            "date_suggestion_formatted": date_suggestion or "à convenir",
            "planning_link": _frontend_url(f"/app/changements/{changement_id}"),
        }
        sender = await _resolve_sender_name(db, row.owner_id)
        return await send_email(
            to=row.tenant_email,
            subject=f"État des lieux {phase_label} à planifier",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=sender,
        )


# ── 10. Rappel signature en attente ──────────────────────────────────────────


_DOC_TYPE_LABELS = {
    "contract": "bail",
    "avenant": "avenant",
    "resiliation": "résiliation",
    "mandat": "mandat de gestion",
}


async def send_rappel_signature_pending(
    document_type: str,
    document_id: uuid.UUID,
    skribble_signing_url: str | None = None,
    days_since_sent: int = 3,
) -> str | None:
    """document_type ∈ {contract, avenant, resiliation, mandat}."""
    async with AsyncSessionLocal() as db:
        recipient_user_id = None
        agency_id_for_sender = None

        if document_type == "contract":
            contract = await db.get(Contract, document_id)
            if contract is None:
                return None
            agency_id_for_sender = contract.agency_id
            if contract.tenant_signed_at is None and contract.tenant_id:
                recipient_user_id = contract.tenant_id
            elif contract.skribble_status == "partial_signed" and contract.agency_id:
                recipient_user_id = contract.agency_id
        elif document_type == "avenant":
            avenant = await db.get(Avenant, document_id)
            if avenant is None:
                return None
            contract = await db.get(Contract, avenant.contract_id)
            agency_id_for_sender = contract.agency_id if contract else None
            if avenant.signed_at_locataire is None and contract:
                recipient_user_id = contract.tenant_id
        elif document_type == "resiliation":
            resiliation = await db.get(Resiliation, document_id)
            if resiliation is None:
                return None
            contract = await db.get(Contract, resiliation.contract_id)
            agency_id_for_sender = contract.agency_id if contract else None
            if resiliation.initiateur == "locataire" and contract:
                recipient_user_id = contract.tenant_id
            elif resiliation.initiateur == "bailleur" and contract:
                recipient_user_id = contract.owner_id
            elif resiliation.initiateur == "agence_mandataire" and contract:
                recipient_user_id = contract.agency_id
        elif document_type == "mandat":
            mandat = await db.get(MandatGestion, document_id)
            if mandat is None:
                return None
            agency_id_for_sender = mandat.agence_id
            if mandat.signed_at_mandant is None:
                recipient_user_id = mandat.mandant_id
            elif mandat.signed_at_agence is None:
                recipient_user_id = mandat.agence_id
        else:
            return None

        if recipient_user_id is None:
            return None
        recipient = await db.get(User, recipient_user_id)
        if recipient is None or not recipient.email:
            return None

        url = skribble_signing_url or _frontend_url(
            f"/app/{document_type}s/{document_id}/sign"
        )
        html, text_body = _load_pair("rappel_signature_pending")
        ctx = {
            **_common_ctx(),
            "recipient_name": _full_name(recipient),
            "document_type": _DOC_TYPE_LABELS.get(document_type, document_type),
            "skribble_signing_url": url,
            "days_since_sent": str(days_since_sent),
        }
        sender = await _resolve_sender_name(db, agency_id_for_sender)
        return await send_email(
            to=recipient.email,
            subject="Rappel : signature en attente",
            html=html.format(**ctx),
            text=text_body.format(**ctx),
            sender_name=sender,
        )
