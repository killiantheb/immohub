"""Service d'envoi d'emails — Resend (priorité) ou SMTP fallback.

Usage :
    from app.services.email_service import send_email
    msg_id = await send_email("user@example.ch", "Sujet", "<h1>Hello</h1>")
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

logger = logging.getLogger("althy.email")


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
