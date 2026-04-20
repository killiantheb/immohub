"""Resend API helpers — audiences + contacts.

Docs : https://resend.com/docs/api-reference/audiences

Les audiences Althy sont mappées par rôle (artisan, ouvreur, expert…).
L'ID de chaque audience est stocké en env : RESEND_AUDIENCE_<ROLE> (fallback
: création paresseuse au premier contact).
"""

from __future__ import annotations

import logging
import os

import httpx

from app.core.config import settings

logger = logging.getLogger("althy.resend")

_BASE = "https://api.resend.com"
_TIMEOUT = 10.0


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }


def _audience_env_key(role: str) -> str:
    return f"RESEND_AUDIENCE_{role.upper()}"


async def create_audience(name: str) -> str | None:
    """Crée une audience Resend et retourne son ID. Retourne None si la clé Resend n'est pas configurée."""
    if not settings.RESEND_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_BASE}/audiences",
            headers=_headers(),
            json={"name": name},
        )
    if resp.status_code not in (200, 201):
        logger.warning("resend.create_audience failed: %s %s", resp.status_code, resp.text[:200])
        return None
    return resp.json().get("id")


async def get_or_create_audience_for_role(role: str) -> str | None:
    """Retourne l'ID d'audience pour un rôle. Utilise l'env RESEND_AUDIENCE_<ROLE> si défini,
    sinon crée une audience à la volée."""
    if not settings.RESEND_API_KEY:
        return None

    env_key = _audience_env_key(role)
    cached = os.environ.get(env_key)
    if cached:
        return cached

    aid = await create_audience(f"waitlist-{role}")
    if aid:
        # Mémorise pour les appels suivants dans ce process — en prod,
        # l'opérateur doit fixer la var d'env pour persister entre redémarrages.
        os.environ[env_key] = aid
    return aid


async def add_contact_to_audience(
    email: str,
    audience_id: str,
    first_name: str | None = None,
) -> bool:
    """Ajoute un contact à une audience Resend. Idempotent côté Resend (dupes ignorés)."""
    if not settings.RESEND_API_KEY or not audience_id:
        return False

    payload: dict = {"email": email, "unsubscribed": False}
    if first_name:
        payload["first_name"] = first_name

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_BASE}/audiences/{audience_id}/contacts",
            headers=_headers(),
            json=payload,
        )
    if resp.status_code in (200, 201):
        return True
    # 409 = déjà présent — considéré comme succès
    if resp.status_code == 409:
        return True
    logger.warning(
        "resend.add_contact failed: %s %s (audience=%s)",
        resp.status_code, resp.text[:200], audience_id,
    )
    return False


async def send_transactional(
    to: str,
    subject: str,
    html: str,
    reply_to: str | None = None,
) -> str | None:
    """Envoi transactionnel simple. Retourne l'ID du message ou None si pas de clé / erreur."""
    if not settings.RESEND_API_KEY:
        logger.info("[resend] DEV — %s → %s (pas de clé configurée)", subject, to)
        return None

    payload: dict = {
        "from": f"Althy <{settings.EMAILS_FROM}>",
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(f"{_BASE}/emails", headers=_headers(), json=payload)
    if resp.status_code in (200, 201):
        return resp.json().get("id")
    logger.warning("resend.send failed: %s %s", resp.status_code, resp.text[:200])
    return None
