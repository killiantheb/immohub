"""Service d'envoi d'emails — Resend (priorité) ou SMTP fallback.

Usage :
    from app.services.email_service import send_email
    msg_id = await send_email("user@example.ch", "Sujet", "<h1>Hello</h1>")

Helpers transactionnels :
    from app.services.email_service import send_qr_facture_email
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import httpx
from app.core.config import settings

logger = logging.getLogger("althy.email")

# Templates dir — partagé avec invitation_locataire.html / contract_created.html etc.
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"


class EmailServiceError(Exception):
    """Raised when email sending fails — Celery retry should catch this."""


async def send_email(
    to: str | list[str],
    subject: str,
    html: str,
    text: str | None = None,
    sender_name: str | None = None,
) -> str:
    """Send an email via Resend (if key set) or SMTP fallback.

    Args:
        sender_name: optional display name for the From header (e.g. agency
            name or bailleur full name). Falls back to "Althy" if None/empty.
            EMAILS_FROM (the email part) is always used — sender_name only
            controls the display label before <email>.

    Returns the message ID on success.
    Raises EmailServiceError on failure.
    """
    recipients = [to] if isinstance(to, str) else to

    # Resend rejects empty From with 422 — always materialise a non-empty
    # label, fallback to "Althy" (doctrine §B.10).
    display_name = (sender_name or "").strip() or "Althy"
    from_field = f"{display_name} <{settings.EMAILS_FROM}>"

    if settings.RESEND_API_KEY:
        return await _send_resend(recipients, subject, html, text, from_field)

    if settings.SMTP_HOST:
        return _send_smtp(recipients, subject, html, text, from_field)

    # Dev mode — log only
    logger.info("[email] DEV — %s → %s (no transport configured)", subject, recipients)
    return "dev-no-send"


async def _send_resend(
    to: list[str], subject: str, html: str, text: str | None, from_field: str
) -> str:
    """Send via Resend API (https://resend.com)."""
    payload: dict = {
        "from": from_field,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code not in (200, 201):
                raise EmailServiceError(
                    f"Resend {resp.status_code}: {resp.text[:300]}"
                )
            data = resp.json()
            msg_id = data.get("id", "unknown")
            logger.info("[email] Resend OK → %s (id=%s)", to, msg_id)
            return msg_id
    except httpx.HTTPError as exc:
        raise EmailServiceError(f"Resend HTTP error: {exc}") from exc


def _send_smtp(
    to: list[str], subject: str, html: str, text: str | None, from_field: str
) -> str:
    """Send via SMTP (synchronous — used as fallback)."""
    msg = MIMEMultipart("alternative")
    msg["From"] = from_field
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject

    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            if settings.SMTP_PORT != 25:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM, to, msg.as_string())
        logger.info("[email] SMTP OK → %s", to)
        return f"smtp-{id(msg)}"
    except smtplib.SMTPException as exc:
        raise EmailServiceError(f"SMTP error: {exc}") from exc


# ── Helpers transactionnels ───────────────────────────────────────────────────


def _format_chf(amount: float) -> str:
    """Format CHF suisse avec apostrophe milliers : 2400.0 → '2'400.00'."""
    integer_part, _, decimal_part = f"{amount:.2f}".partition(".")
    integer_with_sep = "{:,}".format(int(integer_part)).replace(",", "'")
    return f"{integer_with_sep}.{decimal_part}"


async def send_qr_facture_email(
    *,
    loyer_tx,
    locataire,
    bien,
    sender_name: str | None = None,
) -> str | None:
    """Envoie l'email QR-facture mensuel au locataire.

    Encapsule toute la chaîne : PDF gen → upload Supabase → signed URL → render
    template → envoi Resend. Appelé en best-effort par la cron
    `generate_monthly_rents` (rent_tasks.py) après commit DB.

    Args:
        loyer_tx: LoyerTransaction nouvellement créée (qr_reference + montants
                  + mois_concerne disponibles).
        locataire: Locataire avec user eager-loadé (lazy="selectin"). Si le
                   locataire n'a pas de user.email lié, on renvoie None sans
                   erreur (best-effort).
        bien: Bien (adresse pour le PDF et le template).
        sender_name: Display name optionnel pour le From header.

    Returns:
        Message ID Resend ou None si pas d'email locataire à servir.

    Phase 1.0 §B.4 : palette Prussian + Gold, pas d'orange. §B.3 : entité légale
    via `settings.ALTHY_CREDITOR_NAME`, jamais hardcodée.
    """
    # Lazy imports — évite circulaire models ↔ services.
    from app.services.qr_facture import generate_qr_bill_pdf
    from app.services.storage import get_signed_url, upload_pdf

    user = getattr(locataire, "user", None)
    if user is None or not user.email:
        logger.info(
            "[email] send_qr_facture_email skipped — no user/email on locataire %s",
            getattr(locataire, "id", "?"),
        )
        return None

    # ── Données dérivées ──
    mois_concerne = loyer_tx.mois_concerne
    mois_str = mois_concerne.strftime("%Y-%m")
    mois_label = mois_concerne.strftime("%B %Y").capitalize()
    montant_total = float(loyer_tx.montant_total)
    commission_pct = float(loyer_tx.commission_pct or 0)
    commission_montant = float(loyer_tx.commission_montant or 0)
    montant_reverse = float(
        loyer_tx.montant_reverse if loyer_tx.montant_reverse is not None else montant_total
    )

    tenant_name = " ".join(
        filter(None, [user.first_name, user.last_name])
    ).strip() or "Locataire"
    first_name = user.first_name or ""

    # ── PDF QR-facture + upload Supabase Storage (best-effort) ──
    pdf_bytes = generate_qr_bill_pdf(
        qr_reference=loyer_tx.qr_reference or "",
        montant_total=montant_total,
        bien_adresse=bien.adresse,
        tenant_name=tenant_name,
        mois_label=mois_label,
        commission_pct=commission_pct,
        commission_montant=commission_montant,
        montant_reverse=montant_reverse,
    )
    key = await upload_pdf(
        user_id=str(bien.owner_id),
        bien_id=str(bien.id),
        doc_type="qr-facture",
        mois=mois_str,
        pdf_bytes=pdf_bytes,
    )
    # Lien signé 14 jours — couvre les relances locataire sans régénération.
    download_url = await get_signed_url(key, expires_in=14 * 24 * 3600)

    # ── Render templates ──
    html_template = (_TEMPLATES_DIR / "qr_facture_locataire.html").read_text(encoding="utf-8")
    txt_template = (_TEMPLATES_DIR / "qr_facture_locataire.txt").read_text(encoding="utf-8")

    context = {
        "prenom_locataire": first_name,
        "bien_adresse": bien.adresse,
        "mois_label": mois_label,
        "montant_chf": _format_chf(montant_total),
        "qr_reference": loyer_tx.qr_reference or "",
        "download_url": download_url,
        "althy_creditor_name": settings.ALTHY_CREDITOR_NAME,
        "emails_from": settings.EMAILS_FROM,
    }
    html_body = html_template.format(**context)
    txt_body = txt_template.format(**context)

    subject = f"Votre QR-facture · loyer {mois_label}"
    return await send_email(
        to=user.email,
        subject=subject,
        html=html_body,
        text=txt_body,
        sender_name=sender_name,
    )
