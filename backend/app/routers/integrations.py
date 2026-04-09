"""Router FastAPI — /api/v1/integrations

Gmail · Outlook · Google Calendar · Outlook Calendar

Flow OAuth2 :
  GET  /integrations/{provider}/connect  → redirect URL vers le provider
  GET  /integrations/{provider}/callback → échange le code → stocke token
  GET  /integrations/status              → état de toutes les intégrations
  DELETE /integrations/{provider}        → déconnecter

Email IA :
  POST /integrations/email/classify      → classe les derniers emails par bien (Claude)

Calendar :
  POST /integrations/calendar/push-event → crée un événement (visite, EDL, intervention)
  GET  /integrations/calendar/events     → liste les événements pushés
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
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

# ── OAuth2 provider config ─────────────────────────────────────────────────────

_GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO  = "https://www.googleapis.com/oauth2/v2/userinfo"

_MICROSOFT_AUTH_URL  = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
_MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
_MICROSOFT_USERINFO  = "https://graph.microsoft.com/v1.0/me"

SCOPES = {
    "gmail":            "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    "google_calendar":  "https://www.googleapis.com/auth/calendar",
    "outlook":          "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access",
    "outlook_calendar": "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
}


def _callback_url(provider: str) -> str:
    base = settings.ALLOWED_ORIGINS[0]
    return f"{base.rstrip('/')}/api/v1/integrations/{provider}/callback"


# ── Connect (generate OAuth URL) ──────────────────────────────────────────────

@router.get("/{provider}/connect")
async def connect_integration(
    provider: str,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """
    Génère l'URL OAuth2 pour connecter Gmail, Outlook, Google Calendar ou Outlook Calendar.
    Retourne { url } — le frontend redirige l'utilisateur vers cette URL.
    """
    valid_providers = {"gmail", "google_calendar", "outlook", "outlook_calendar"}
    if provider not in valid_providers:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Provider inconnu : {provider}")

    state = f"{current_user.id}:{secrets.token_urlsafe(16)}"
    scope = SCOPES[provider]

    if provider in ("gmail", "google_calendar"):
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth non configuré")
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": _callback_url(provider),
            "response_type": "code",
            "scope": scope,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        url = f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    else:  # outlook | outlook_calendar
        if not settings.MICROSOFT_CLIENT_ID:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Microsoft OAuth non configuré")
        auth_url = _MICROSOFT_AUTH_URL.format(tenant=settings.MICROSOFT_TENANT_ID)
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "redirect_uri": _callback_url(provider),
            "response_type": "code",
            "scope": scope,
            "state": state,
        }
        url = f"{auth_url}?{urllib.parse.urlencode(params)}"

    # Sauvegarder l'état pour validation dans le callback
    await db.execute(
        text("""
            INSERT INTO user_integrations (user_id, provider, scope, is_active)
            VALUES (:uid, :p, :s, false)
            ON CONFLICT (user_id, provider) DO UPDATE
            SET scope = :s, is_active = false, updated_at = now()
        """),
        {"uid": str(current_user.id), "p": provider, "s": scope},
    )
    await db.commit()

    return {"url": url, "provider": provider}


# ── Callback (exchange code for token) ────────────────────────────────────────

@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Reçoit le code OAuth du provider, échange contre access+refresh token,
    stocke en base et redirige vers le dashboard.
    """
    # Extraire user_id du state
    try:
        user_id_str = state.split(":")[0]
        user_id = uuid.UUID(user_id_str)
    except (ValueError, IndexError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "State OAuth invalide")

    token_data: dict = {}
    email: str | None = None

    async with httpx.AsyncClient(timeout=20.0) as http:
        if provider in ("gmail", "google_calendar"):
            resp = await http.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": _callback_url(provider),
                },
            )
            token_data = resp.json()
            # Récupérer l'email de l'utilisateur
            if token_data.get("access_token"):
                info = await http.get(
                    _GOOGLE_USERINFO,
                    headers={"Authorization": f"Bearer {token_data['access_token']}"},
                )
                email = info.json().get("email")

        else:  # outlook | outlook_calendar
            resp = await http.post(
                _MICROSOFT_TOKEN_URL.format(tenant=settings.MICROSOFT_TENANT_ID),
                data={
                    "client_id": settings.MICROSOFT_CLIENT_ID,
                    "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": _callback_url(provider),
                    "scope": SCOPES[provider],
                },
            )
            token_data = resp.json()
            if token_data.get("access_token"):
                info = await http.get(
                    _MICROSOFT_USERINFO,
                    headers={"Authorization": f"Bearer {token_data['access_token']}"},
                )
                email = info.json().get("mail") or info.json().get("userPrincipalName")

    if not token_data.get("access_token"):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Échec OAuth {provider}: {token_data.get('error_description', 'token manquant')}")

    expires_in = token_data.get("expires_in", 3600)
    expires_at = datetime.now(UTC) + timedelta(seconds=int(expires_in))

    await db.execute(
        text("""
            INSERT INTO user_integrations
                (user_id, provider, access_token, refresh_token, token_expires_at, email, is_active)
            VALUES
                (:uid, :p, :at, :rt, :exp, :email, true)
            ON CONFLICT (user_id, provider) DO UPDATE
            SET access_token = :at, refresh_token = COALESCE(:rt, refresh_token),
                token_expires_at = :exp, email = COALESCE(:email, user_integrations.email),
                is_active = true, updated_at = now()
        """),
        {
            "uid": str(user_id), "p": provider,
            "at": token_data.get("access_token"),
            "rt": token_data.get("refresh_token"),
            "exp": expires_at, "email": email,
        },
    )
    await db.commit()

    # Redirect vers le dashboard settings
    return RedirectResponse(
        url=f"{settings.ALLOWED_ORIGINS[0]}/app/settings?integration={provider}&status=success"
    )


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def integrations_status(current_user: AuthDep, db: DbDep) -> list[dict]:
    """Retourne l'état de toutes les intégrations de l'utilisateur."""
    rows = (await db.execute(
        text("""
            SELECT provider, is_active, email, token_expires_at, updated_at
            FROM user_integrations
            WHERE user_id = :uid
        """),
        {"uid": str(current_user.id)},
    )).fetchall()

    now = datetime.now(UTC)
    result = []
    for row in rows:
        exp = row[3]
        is_expired = exp and exp.replace(tzinfo=UTC) < now if exp else False
        result.append({
            "provider": row[0],
            "connected": row[1] and not is_expired,
            "email": row[2],
            "expires_at": row[3].isoformat() if row[3] else None,
            "connected_at": row[4].isoformat() if row[4] else None,
        })

    # Ajouter les providers non connectés
    connected_providers = {r["provider"] for r in result}
    for p in ("gmail", "google_calendar", "outlook", "outlook_calendar"):
        if p not in connected_providers:
            result.append({"provider": p, "connected": False, "email": None, "expires_at": None, "connected_at": None})

    return result


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.delete("/{provider}")
async def disconnect_integration(
    provider: str,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Déconnecter une intégration (supprime le token)."""
    await db.execute(
        text("UPDATE user_integrations SET is_active = false, access_token = null, refresh_token = null WHERE user_id = :uid AND provider = :p"),
        {"uid": str(current_user.id), "p": provider},
    )
    await db.commit()
    return {"disconnected": True, "provider": provider}


# ── Email AI classify ─────────────────────────────────────────────────────────

class EmailClassifyResponse(BaseModel):
    classified: int
    emails: list[dict]


@router.post("/email/classify", response_model=EmailClassifyResponse)
async def classify_emails(
    current_user: AuthDep,
    db: DbDep,
    max_emails: int = Query(20, ge=1, le=50),
) -> EmailClassifyResponse:
    """
    Récupère les derniers emails non lus (Gmail ou Outlook) et les classe par bien via Claude.
    Retourne la liste avec : sujet, expéditeur, bien_id proposé, catégorie, priorité.
    """
    import json as _json
    from anthropic import AsyncAnthropic
    from app.services.ai_service import MODEL, _check_rate_limit, _log_usage

    if not _check_rate_limit(str(current_user.id)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Limite IA atteinte")

    # Chercher le token actif (Gmail ou Outlook)
    row = (await db.execute(
        text("""
            SELECT provider, access_token, token_expires_at
            FROM user_integrations
            WHERE user_id = :uid AND provider IN ('gmail', 'outlook') AND is_active = true
            ORDER BY updated_at DESC LIMIT 1
        """),
        {"uid": str(current_user.id)},
    )).fetchone()

    if not row or not row[1]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Aucun compte email connecté. Connectez Gmail ou Outlook d'abord.")

    provider, access_token, _ = row

    # Récupérer les emails
    raw_emails: list[dict] = []
    async with httpx.AsyncClient(timeout=20.0) as http:
        if provider == "gmail":
            # Gmail API — liste des messages non lus
            list_resp = await http.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                params={"q": "is:unread", "maxResults": max_emails},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            messages = list_resp.json().get("messages", [])
            for msg in messages[:max_emails]:
                detail = await http.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}",
                    params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                headers = {h["name"]: h["value"] for h in detail.json().get("payload", {}).get("headers", [])}
                raw_emails.append({
                    "id": msg["id"],
                    "subject": headers.get("Subject", "(sans objet)"),
                    "from": headers.get("From", ""),
                    "date": headers.get("Date", ""),
                    "snippet": detail.json().get("snippet", ""),
                })
        else:  # outlook
            resp = await http.get(
                "https://graph.microsoft.com/v1.0/me/messages",
                params={"$filter": "isRead eq false", "$top": max_emails, "$select": "subject,from,receivedDateTime,bodyPreview"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            for msg in resp.json().get("value", []):
                raw_emails.append({
                    "id": msg.get("id", ""),
                    "subject": msg.get("subject", "(sans objet)"),
                    "from": msg.get("from", {}).get("emailAddress", {}).get("address", ""),
                    "date": msg.get("receivedDateTime", ""),
                    "snippet": msg.get("bodyPreview", "")[:200],
                })

    if not raw_emails:
        return EmailClassifyResponse(classified=0, emails=[])

    # Récupérer les biens de l'utilisateur pour le contexte
    biens_rows = (await db.execute(
        text("SELECT id, adresse, ville FROM biens WHERE owner_id = :uid AND is_active = true LIMIT 20"),
        {"uid": str(current_user.id)},
    )).fetchall()
    biens_ctx = [{"id": str(r[0]), "adresse": f"{r[1]}, {r[2]}"} for r in biens_rows]

    # Classification Claude
    email_list_str = "\n".join(
        f"Email {i+1}: Sujet: {e['subject']} | De: {e['from']} | Extrait: {e['snippet'][:150]}"
        for i, e in enumerate(raw_emails)
    )
    biens_str = "\n".join(f"- Bien {b['id']}: {b['adresse']}" for b in biens_ctx)

    prompt = f"""Tu es un assistant immobilier. Classe ces emails par bien immobilier.

Biens disponibles:
{biens_str or "Aucun bien renseigné"}

Emails:
{email_list_str}

Pour chaque email, retourne ce JSON (tableau) :
[
  {{
    "email_index": 1,
    "bien_id": "<uuid ou null si inconnu>",
    "categorie": "loyer|travaux|locataire|visite|administratif|autre",
    "priorite": "haute|normale|basse",
    "resume": "<résumé en 10 mots max>"
  }}
]
Retourne UNIQUEMENT le JSON, pas de markdown."""

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model=MODEL, max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    await _log_usage(db, str(current_user.id), "classify_emails", msg.usage)

    classified_list: list[dict] = []
    try:
        raw_resp = msg.content[0].text.strip()  # type: ignore[union-attr]
        if "```" in raw_resp:
            raw_resp = raw_resp.split("```")[1].lstrip("json").strip()
        classifications = _json.loads(raw_resp)
        for c in classifications:
            idx = c.get("email_index", 1) - 1
            if 0 <= idx < len(raw_emails):
                classified_list.append({
                    **raw_emails[idx],
                    "bien_id": c.get("bien_id"),
                    "categorie": c.get("categorie", "autre"),
                    "priorite": c.get("priorite", "normale"),
                    "resume": c.get("resume", ""),
                })
    except Exception:
        classified_list = [{**e, "bien_id": None, "categorie": "autre", "priorite": "normale", "resume": ""} for e in raw_emails]

    return EmailClassifyResponse(classified=len(classified_list), emails=classified_list)


# ── Calendar push event ────────────────────────────────────────────────────────

class CalendarEventRequest(BaseModel):
    title: str
    start_at: datetime
    end_at: datetime
    description: str | None = None
    bien_id: uuid.UUID | None = None
    event_type: str = "visite"  # visite | edl | intervention | rappel
    add_reminder_24h: bool = True


@router.post("/calendar/push-event")
async def push_calendar_event(
    payload: CalendarEventRequest,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """
    Crée un événement dans le calendrier connecté (Google ou Outlook).
    Ajoute automatiquement un rappel 24h avant si add_reminder_24h=true.
    """
    # Chercher le calendrier actif
    row = (await db.execute(
        text("""
            SELECT provider, access_token
            FROM user_integrations
            WHERE user_id = :uid AND provider IN ('google_calendar', 'outlook_calendar') AND is_active = true
            ORDER BY updated_at DESC LIMIT 1
        """),
        {"uid": str(current_user.id)},
    )).fetchone()

    if not row:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Aucun calendrier connecté.")

    provider, access_token = row
    external_id: str | None = None

    description = payload.description or ""
    if payload.bien_id:
        description += f"\n\nBien ID : {payload.bien_id}"
    description += "\n\nGénéré par Althy — www.althy.ch"

    async with httpx.AsyncClient(timeout=20.0) as http:
        if provider == "google_calendar":
            event_body: dict = {
                "summary": payload.title,
                "description": description,
                "start": {"dateTime": payload.start_at.isoformat(), "timeZone": "Europe/Zurich"},
                "end": {"dateTime": payload.end_at.isoformat(), "timeZone": "Europe/Zurich"},
            }
            if payload.add_reminder_24h:
                event_body["reminders"] = {
                    "useDefault": False,
                    "overrides": [
                        {"method": "email", "minutes": 1440},  # 24h
                        {"method": "popup", "minutes": 60},    # 1h
                    ],
                }
            resp = await http.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                json=event_body,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code in (200, 201):
                external_id = resp.json().get("id")

        else:  # outlook_calendar
            event_body = {
                "subject": payload.title,
                "body": {"contentType": "Text", "content": description},
                "start": {"dateTime": payload.start_at.isoformat(), "timeZone": "Europe/Zurich"},
                "end": {"dateTime": payload.end_at.isoformat(), "timeZone": "Europe/Zurich"},
            }
            if payload.add_reminder_24h:
                event_body["reminderMinutesBeforeStart"] = 1440
                event_body["isReminderOn"] = True
            resp = await http.post(
                "https://graph.microsoft.com/v1.0/me/events",
                json=event_body,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code in (200, 201):
                external_id = resp.json().get("id")

    # Sauvegarder l'événement en base
    await db.execute(
        text("""
            INSERT INTO calendar_events
                (user_id, provider, external_id, title, start_at, end_at, description, bien_id, event_type)
            VALUES
                (:uid, :p, :eid, :title, :start, :end, :desc, :bid, :etype)
        """),
        {
            "uid": str(current_user.id), "p": provider.replace("_calendar", ""),
            "eid": external_id, "title": payload.title,
            "start": payload.start_at, "end": payload.end_at,
            "desc": payload.description, "bid": str(payload.bien_id) if payload.bien_id else None,
            "etype": payload.event_type,
        },
    )
    await db.commit()

    return {
        "created": external_id is not None,
        "external_id": external_id,
        "provider": provider,
        "reminder_24h": payload.add_reminder_24h,
    }


@router.get("/calendar/events")
async def list_calendar_events(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = None,
) -> list[dict]:
    """Liste les événements calendrier pushés par Althy."""
    where = "WHERE user_id = :uid"
    params: dict = {"uid": str(current_user.id)}
    if bien_id:
        where += " AND bien_id = :bid"
        params["bid"] = str(bien_id)

    rows = (await db.execute(
        text(f"SELECT id, provider, title, start_at, end_at, event_type, bien_id, external_id FROM calendar_events {where} ORDER BY start_at DESC LIMIT 50"),
        params,
    )).fetchall()

    return [
        {
            "id": str(r[0]), "provider": r[1], "title": r[2],
            "start_at": r[3].isoformat() if r[3] else None,
            "end_at": r[4].isoformat() if r[4] else None,
            "event_type": r[5],
            "bien_id": str(r[6]) if r[6] else None,
            "external_id": r[7],
        }
        for r in rows
    ]
