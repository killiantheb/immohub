"""Supabase Admin API — invite users via service role key.

Uses httpx (already in deps) instead of supabase-py to stay consistent
with the rest of the backend which uses JWT verification + raw SQL.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("althy.supabase_admin")


class SupabaseAdminError(Exception):
    """Raised when a Supabase Admin API call fails."""


async def invite_user_by_email(
    email: str,
    *,
    user_metadata: dict[str, Any] | None = None,
    redirect_to: str | None = None,
) -> dict:
    """Invite a user via Supabase Auth Admin API.

    Creates the user in auth.users and sends an invitation email
    with a magic link to set their password.

    Returns the Supabase user object on success.
    Raises SupabaseAdminError on failure.
    """
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/invite"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {"email": email}
    if user_metadata:
        payload["data"] = user_metadata
    if redirect_to:
        payload["redirect_to"] = redirect_to

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code not in (200, 201):
            body = resp.text[:500]
            logger.error("[supabase_admin] invite failed %s: %s", resp.status_code, body)
            raise SupabaseAdminError(f"Supabase invite {resp.status_code}: {body}")

        data = resp.json()
        logger.info("[supabase_admin] invited %s (id=%s)", email, data.get("id", "?"))
        return data

    except httpx.HTTPError as exc:
        raise SupabaseAdminError(f"Supabase HTTP error: {exc}") from exc
