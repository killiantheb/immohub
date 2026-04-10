"""OAuth router — /api/v1/oauth

Google (Gmail + Calendar) et Microsoft (Outlook + Calendar).
Stocke les tokens dans user_oauth_tokens.
"""

from __future__ import annotations

import secrets
import urllib.parse
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import httpx
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/oauth", tags=["oauth"])

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

# ── Constants ─────────────────────────────────────────────────────────────────

_GOOGLE_AUTH_URL    = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token"
_GOOGLE_REVOKE_URL  = "https://oauth2.googleapis.com/revoke"
_GOOGLE_USERINFO    = "https://www.googleapis.com/oauth2/v2/userinfo"

_MS_AUTH_URL   = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
_MS_TOKEN_URL  = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
_MS_USERINFO   = "https://graph.microsoft.com/v1.0/me"

_GOOGLE_SCOPES = " ".join([
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
])

_MS_SCOPES = " ".join([
    "offline_access",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.ReadWrite",
    "User.Read",
])


def _frontend_url() -> str:
    origins = settings.ALLOWED_ORIGINS
    # Prefer HTTPS production URL
    for o in origins:
        if "althy.ch" in o and "https" in o:
            return o
    return origins[0]


def _callback_url(provider: str) -> str:
    base = (process.env.NEXT_PUBLIC_API_URL if False else _frontend_url())
    # Use the backend base (Railway) — derive from ALLOWED_ORIGINS heuristic
    # The callback must point to the FastAPI server, not the Next.js frontend
    # In Railway, the API is exposed via a different domain.
    # We use ALLOWED_ORIGINS[0] as fallback for dev; prod will override via env.
    return f"{_frontend_url()}/api/v1/oauth/{{provider}}/retour".replace("{provider}", provider)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _save_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str,
    access_token: str,
    refresh_token: str | None,
    expires_in: int,
    scopes: list[str],
) -> None:
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    await db.execute(
        text("""
            INSERT INTO user_oauth_tokens
                (id, user_id, provider, access_token, refresh_token, expires_at, scopes)
            VALUES
                (:id, :uid, :provider, :at, :rt, :exp, :scopes)
            ON CONFLICT (user_id, provider) DO UPDATE
            SET access_token  = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, user_oauth_tokens.refresh_token),
                expires_at    = EXCLUDED.expires_at,
                scopes        = EXCLUDED.scopes,
                updated_at    = now()
        """),
        {
            "id": uuid.uuid4(),
            "uid": user_id,
            "provider": provider,
            "at": access_token,
            "rt": refresh_token,
            "exp": expires_at,
            "scopes": scopes,
        },
    )
    await db.commit()


async def get_token_valide(db: AsyncSession, user_id: uuid.UUID, provider: str) -> str | None:
    """Retourne un access_token valide (auto-refresh si expiré)."""
    row = await db.execute(
        text("""
            SELECT access_token, refresh_token, expires_at
            FROM user_oauth_tokens
            WHERE user_id = :uid AND provider = :p
        """),
        {"uid": user_id, "p": provider},
    )
    r = row.one_or_none()
    if not r:
        return None

    # Still valid (with 60s buffer)
    if r.expires_at and r.expires_at > datetime.now(UTC) + timedelta(seconds=60):
        return r.access_token

    if not r.refresh_token:
        return r.access_token  # Return as-is; may be expired

    # Refresh
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            if provider == "google":
                resp = await http.post(_GOOGLE_TOKEN_URL, data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": r.refresh_token,
                    "grant_type": "refresh_token",
                })
                data = resp.json()
            else:  # microsoft
                resp = await http.post(
                    _MS_TOKEN_URL.format(tenant=settings.MICROSOFT_TENANT_ID),
                    data={
                        "client_id": settings.MICROSOFT_CLIENT_ID,
                        "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                        "refresh_token": r.refresh_token,
                        "grant_type": "refresh_token",
                        "scope": _MS_SCOPES,
                    },
                )
                data = resp.json()

        if not data.get("access_token"):
            return r.access_token

        expires_at = datetime.now(UTC) + timedelta(seconds=int(data.get("expires_in", 3600)))
        await db.execute(
            text("""
                UPDATE user_oauth_tokens
                SET access_token = :at,
                    refresh_token = COALESCE(:rt, refresh_token),
                    expires_at = :exp,
                    updated_at = now()
                WHERE user_id = :uid AND provider = :p
            """),
            {
                "at": data["access_token"],
                "rt": data.get("refresh_token"),
                "exp": expires_at,
                "uid": user_id,
                "p": provider,
            },
        )
        await db.commit()
        return data["access_token"]

    except Exception:
        return r.access_token


# ── Google ────────────────────────────────────────────────────────────────────

@router.get("/google/autoriser")
async def google_autoriser(current_user: AuthDep) -> dict:
    """Génère l'URL d'autorisation Google OAuth2."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth non configuré")

    state = f"{current_user.id}:{secrets.token_urlsafe(16)}"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": _callback_url("google"),
        "response_type": "code",
        "scope": _GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return {"auth_url": f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"}


@router.get("/google/retour")
async def google_retour(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Callback Google — échange le code contre des tokens."""
    try:
        user_id = uuid.UUID(state.split(":")[0])
    except (ValueError, IndexError):
        raise HTTPException(400, "State OAuth invalide")

    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.post(_GOOGLE_TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": _callback_url("google"),
        })
        data = resp.json()

    if not data.get("access_token"):
        raise HTTPException(502, f"Google OAuth échoué : {data.get('error_description', 'token manquant')}")

    scopes = data.get("scope", _GOOGLE_SCOPES).split()
    await _save_token(db, user_id, "google", data["access_token"], data.get("refresh_token"), int(data.get("expires_in", 3600)), scopes)

    return RedirectResponse(f"{_frontend_url()}/app/settings?oauth=google&status=ok")


# ── Microsoft ─────────────────────────────────────────────────────────────────

@router.get("/microsoft/autoriser")
async def microsoft_autoriser(current_user: AuthDep) -> dict:
    """Génère l'URL d'autorisation Microsoft OAuth2."""
    if not settings.MICROSOFT_CLIENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Microsoft OAuth non configuré")

    state = f"{current_user.id}:{secrets.token_urlsafe(16)}"
    auth_url = _MS_AUTH_URL.format(tenant=settings.MICROSOFT_TENANT_ID)
    params = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "redirect_uri": _callback_url("microsoft"),
        "response_type": "code",
        "scope": _MS_SCOPES,
        "state": state,
    }
    return {"auth_url": f"{auth_url}?{urllib.parse.urlencode(params)}"}


@router.get("/microsoft/retour")
async def microsoft_retour(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Callback Microsoft — échange le code contre des tokens."""
    try:
        user_id = uuid.UUID(state.split(":")[0])
    except (ValueError, IndexError):
        raise HTTPException(400, "State OAuth invalide")

    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.post(
            _MS_TOKEN_URL.format(tenant=settings.MICROSOFT_TENANT_ID),
            data={
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _callback_url("microsoft"),
                "scope": _MS_SCOPES,
            },
        )
        data = resp.json()

    if not data.get("access_token"):
        raise HTTPException(502, f"Microsoft OAuth échoué : {data.get('error_description', 'token manquant')}")

    scopes = data.get("scope", _MS_SCOPES).split()
    await _save_token(db, user_id, "microsoft", data["access_token"], data.get("refresh_token"), int(data.get("expires_in", 3600)), scopes)

    return RedirectResponse(f"{_frontend_url()}/app/settings?oauth=microsoft&status=ok")


# ── Statut ────────────────────────────────────────────────────────────────────

@router.get("/statut")
async def statut_oauth(current_user: AuthDep, db: DbDep) -> list[dict]:
    """Retourne les providers connectés avec email et statut d'expiration."""
    rows = await db.execute(
        text("""
            SELECT provider, expires_at, updated_at
            FROM user_oauth_tokens
            WHERE user_id = :uid
            ORDER BY provider
        """),
        {"uid": current_user.id},
    )
    now = datetime.now(UTC)
    result = []
    for r in rows:
        result.append({
            "provider": r.provider,
            "connected": True,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "expired": (r.expires_at < now) if r.expires_at else False,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return result


@router.delete("/{provider}")
async def deconnecter_oauth(provider: str, current_user: AuthDep, db: DbDep) -> dict:
    """Déconnecte un provider OAuth."""
    await db.execute(
        text("DELETE FROM user_oauth_tokens WHERE user_id = :uid AND provider = :p"),
        {"uid": current_user.id, "p": provider},
    )
    await db.commit()
    return {"ok": True, "provider": provider}
