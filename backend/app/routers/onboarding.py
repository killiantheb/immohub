"""Onboarding integration — /api/v1/onboarding

POST /onboarding/analyser        Scrape + Claude synthesis → scraped agency data
POST /onboarding/creer-compte    Create Supabase user + magic link + email/SMS/QR
GET  /onboarding/session/{id}    Read onboarding session status (Realtime polling)
POST /onboarding/rejoindre       Consume a magic link token → return auth tokens
"""

from __future__ import annotations

import asyncio
import base64
import csv
import io
import json
import re
import secrets
import uuid as _uuid
from datetime import date as _date
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any

import anthropic
import httpx
from app.common.enums import normalize_bien_statut, normalize_bien_type
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import rate_limit
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

# ── Supabase admin helpers ────────────────────────────────────────────────────

_SUPABASE_ADMIN_HEADERS = {
    "apikey":        settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    "Content-Type":  "application/json",
}


def _auth_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/auth/v1{path}"


async def _supa_post(url: str, payload: dict, *, expected: int = 200) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=payload, headers=_SUPABASE_ADMIN_HEADERS)
    if r.status_code not in (expected, 200, 201):
        raise HTTPException(502, f"Supabase error: {r.text[:300]}")
    return r.json()


# ── Claude client ─────────────────────────────────────────────────────────────

def _claude() -> anthropic.AsyncAnthropic:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "Service IA non configuré")
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── Scraping helpers ──────────────────────────────────────────────────────────

async def _fetch_text(url: str, timeout: float = 8.0) -> str:
    """Fetch URL and return stripped text (best-effort)."""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 AlthyBot/1.0"}) as client:
            r = await client.get(url)
        if r.status_code != 200:
            return ""
        # Import here to avoid top-level optional dep failure
        from bs4 import BeautifulSoup  # type: ignore[import]
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)[:4000]
    except Exception:
        return ""


async def _google_places(query: str) -> dict:
    """Text-search Google Places API → first result details."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            # Text search
            r = await client.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": query, "key": settings.GOOGLE_MAPS_API_KEY, "language": "fr", "region": "ch"},
            )
            data = r.json()
            results = data.get("results", [])
            if not results:
                return {}
            place_id = results[0].get("place_id", "")

            # Details
            r2 = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "key":      settings.GOOGLE_MAPS_API_KEY,
                    "language": "fr",
                    "fields":   "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,photos,editorial_summary",
                },
            )
            detail = r2.json().get("result", {})

            # Logo via first photo
            logo_url = None
            if detail.get("photos"):
                ref = detail["photos"][0]["photo_reference"]
                logo_url = (
                    f"https://maps.googleapis.com/maps/api/place/photo"
                    f"?maxwidth=400&photo_reference={ref}&key={settings.GOOGLE_MAPS_API_KEY}"
                )

            return {
                "nom":        detail.get("name"),
                "adresse":    detail.get("formatted_address"),
                "telephone":  detail.get("formatted_phone_number"),
                "site_web":   detail.get("website"),
                "note":       detail.get("rating"),
                "nb_avis":    detail.get("user_ratings_total"),
                "logo_url":   logo_url,
                "description_courte": detail.get("editorial_summary", {}).get("overview"),
            }
    except Exception:
        return {}


_SYNTHESIS_PROMPT = """Tu es un assistant de données pour Althy, l'assistant immobilier suisse.
Voici les données brutes d'une agence immobilière ou entreprise suisse trouvées sur le web.

Synthétise ces données en JSON strict (aucun texte avant/après) :
{
  "nom_officiel": "Raison sociale officielle",
  "adresse": "Rue et numéro",
  "npa": "1200",
  "ville": "Genève",
  "canton": "GE",
  "telephone": "+41 22 xxx xx xx",
  "email_contact": "contact@agence.ch ou null",
  "logo_url": "URL logo ou null",
  "description": "2-3 phrases neutres et positives sur l'agence",
  "couleur_principale": "#RRGGBB ou null",
  "agents": [{"nom": "Prénom Nom", "titre": "Agent", "email": null}],
  "confidence": {"nom": 0.9, "adresse": 0.8, "telephone": 0.7, "email": 0.3}
}

Règles :
- Ton neutre et positif, jamais promotionnel
- canton = code 2 lettres suisse (GE, VD, VS, ZH, BE…)
- Si une donnée est absente/incertaine : null
- confidence entre 0 (pas trouvé) et 1 (très certain)
- agents[] : maximum 5 entrées"""


# ── POST /onboarding/analyser ─────────────────────────────────────────────────

class AnalyserPayload(BaseModel):
    requete:  str          # Nom agence ou URL
    role:     str = "agence"
    email:    str | None = None


@router.post("/analyser")
async def analyser_agence(
    payload: AnalyserPayload,
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(10, 60),
) -> dict:
    """
    Scrape en parallèle (site web + Google Places) puis synthèse Claude.
    Sauvegarde dans agency_scrape_cache + onboarding_sessions.
    """
    requete = payload.requete.strip()[:200]

    # ── Check cache (valid 30 days) ──────────────────────────────────────────
    cache_row = await db.execute(
        text("""
            SELECT scraped_data FROM agency_scrape_cache
            WHERE query = :q AND expires_at > now()
            ORDER BY created_at DESC LIMIT 1
        """),
        {"q": requete},
    )
    cached = cache_row.one_or_none()
    if cached:
        return dict(cached.scraped_data) | {"from_cache": True}

    # ── Parallel scrape ──────────────────────────────────────────────────────
    # Detect if input is a URL or a name query
    is_url = requete.startswith("http")
    website_url = requete if is_url else None

    # If name, try to find website first via Google Places
    places_task  = asyncio.create_task(_google_places(f"{requete} agence immobilière Suisse"))
    website_task = asyncio.create_task(_fetch_text(website_url)) if website_url else None

    places_data: dict = await places_task
    if not website_url and places_data.get("site_web"):
        website_url = places_data["site_web"]

    website_text = ""
    if website_url:
        if website_task:
            website_text = await website_task
        else:
            website_text = await _fetch_text(website_url)

    # ── Build raw context for Claude ─────────────────────────────────────────
    raw_context = f"Requête originale : {requete}\n\n"
    if places_data:
        raw_context += f"Données Google Places :\n{json.dumps(places_data, ensure_ascii=False, indent=2)}\n\n"
    if website_text:
        raw_context += f"Contenu du site web ({website_url}) :\n{website_text[:3000]}\n"

    # ── Claude synthesis ──────────────────────────────────────────────────────
    client = _claude()
    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": f"{_SYNTHESIS_PROMPT}\n\n---\n{raw_context}",
            }],
        )
        raw = msg.content[0].text.strip()  # type: ignore[union-attr]
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip().rstrip("```").strip()
        synth: dict[str, Any] = json.loads(raw)
    except Exception as exc:
        raise HTTPException(502, f"Erreur synthèse IA : {exc}")

    # Merge logo from Places if Claude didn't find one
    if not synth.get("logo_url") and places_data.get("logo_url"):
        synth["logo_url"] = places_data["logo_url"]
    synth["source_url"] = website_url

    # ── Persist in cache ──────────────────────────────────────────────────────
    cache_id = _uuid.uuid4()
    try:
        await db.execute(
            text("""
                INSERT INTO agency_scrape_cache
                    (id, query, source_url, scraped_data, confidence, logo_url)
                VALUES
                    (:id, :q, :url, :data, :conf, :logo)
            """),
            {
                "id":   cache_id,
                "q":    requete,
                "url":  website_url,
                "data": json.dumps(synth),
                "conf": float(sum(synth.get("confidence", {}).values()) / max(len(synth.get("confidence", {})), 1)),
                "logo": synth.get("logo_url"),
            },
        )
        await db.commit()
    except Exception:
        await db.rollback()

    # ── Create onboarding session ─────────────────────────────────────────────
    session_token = secrets.token_urlsafe(24)
    session_id    = _uuid.uuid4()
    try:
        await db.execute(
            text("""
                INSERT INTO onboarding_sessions
                    (id, user_id, session_token, mode, role, data)
                VALUES
                    (:id, :uid, :token, 'auto', :role, :data)
            """),
            {
                "id":    session_id,
                "uid":   current_user.id,
                "token": session_token,
                "role":  payload.role,
                "data":  json.dumps({"synth": synth, "requete": requete}),
            },
        )
        await db.commit()
    except Exception:
        await db.rollback()
        session_id    = None
        session_token = None

    return synth | {
        "session_id":    str(session_id) if session_id else None,
        "session_token": session_token,
        "from_cache":    False,
    }


# ── POST /onboarding/creer-compte ─────────────────────────────────────────────

class CreerComptePayload(BaseModel):
    session_id:  str | None = None       # optional — links to scrape data
    donnees:     dict                    # agency data (possibly edited by user)
    mode_envoi:  str = "email"           # email | sms | qr | email+sms
    prenom:      str | None = None
    nom:         str | None = None
    email:       str
    telephone:   str | None = None
    role:        str = "agence"


@router.post("/creer-compte", status_code=status.HTTP_201_CREATED)
async def creer_compte(
    payload: CreerComptePayload,
    current_user: AuthDep,
    db: DbDep,
    _: None = rate_limit(5, 60),
) -> dict:
    """
    1. Crée le compte Supabase via Admin API (pas de mot de passe — magic link)
    2. Génère un magic_link (UUID, expire 7 jours)
    3. Envoie email HTML personnalisé via Resend (ou SMTP)
    4. Envoie SMS via Twilio si demandé
    5. Génère QR code si mode_envoi contient 'qr'
    Retourne { user_id, magic_link_url, qr_base64? }
    """
    email  = payload.email.strip().lower()
    role   = payload.role
    donnees = payload.donnees
    prenom = payload.prenom or donnees.get("nom_officiel", "").split()[0]
    nom    = payload.nom or ""

    # ── 1. Create Supabase user (no password — passwordless) ─────────────────
    temp_password = secrets.token_urlsafe(20)
    try:
        supa = await _supa_post(
            _auth_url("/admin/users"),
            {
                "email":         email,
                "password":      temp_password,
                "email_confirm": True,
                "user_metadata": {"first_name": prenom, "last_name": nom, "role": role},
            },
            expected=201,
        )
    except HTTPException as exc:
        # If user already exists, fetch existing
        if "already" in str(exc.detail).lower() or "422" in str(exc.detail):
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"{settings.SUPABASE_URL}/auth/v1/admin/users",
                    headers=_SUPABASE_ADMIN_HEADERS,
                    params={"email": email},
                )
            users = r.json().get("users", [])
            if not users:
                raise HTTPException(409, f"Email déjà utilisé : {email}")
            supa = users[0]
        else:
            raise

    supabase_uid = supa["id"]

    # ── 2. Upsert user in our DB ─────────────────────────────────────────────
    user_id_val = _uuid.UUID(supabase_uid)
    try:
        await db.execute(
            text("""
                INSERT INTO users (id, email, prenom, nom, role)
                VALUES (:id, :email, :prenom, :nom, :role)
                ON CONFLICT (id) DO UPDATE SET
                    email  = EXCLUDED.email,
                    prenom = COALESCE(EXCLUDED.prenom, users.prenom),
                    nom    = COALESCE(EXCLUDED.nom, users.nom)
            """),
            {"id": user_id_val, "email": email, "prenom": prenom, "nom": nom, "role": role},
        )
        await db.commit()
    except Exception:
        await db.rollback()

    # ── 3. Generate magic link token ─────────────────────────────────────────
    token      = secrets.token_urlsafe(32)
    magic_id   = _uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.execute(
        text("""
            INSERT INTO magic_links
                (id, token, type, created_by, target_email, target_role, payload, expires_at)
            VALUES
                (:id, :token, 'invitation', :by, :email, :role, :payload, :exp)
        """),
        {
            "id":      magic_id,
            "token":   token,
            "by":      current_user.id,
            "email":   email,
            "role":    role,
            "payload": json.dumps({"user_id": supabase_uid, "donnees": donnees}),
            "exp":     expires_at,
        },
    )
    await db.commit()

    magic_link_url = f"{settings.FRONTEND_URL}/rejoindre/{token}"

    # ── 4. Email via Resend ───────────────────────────────────────────────────
    if "email" in payload.mode_envoi and settings.RESEND_API_KEY:
        nom_agence = donnees.get("nom_officiel") or "votre agence"
        html_body  = await _generate_email_html(prenom, nom_agence, magic_link_url)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from":    f"Althy <{settings.EMAILS_FROM}>",
                        "to":      [email],
                        "subject": f"Bienvenue sur Althy, {prenom} — votre accès immédiat",
                        "html":    html_body,
                    },
                )
        except Exception:
            pass  # non-blocking — log would go to Sentry

    # ── 5. SMS via Twilio ─────────────────────────────────────────────────────
    if "sms" in payload.mode_envoi and payload.telephone and settings.TWILIO_ACCOUNT_SID:
        sms_body = (
            f"Bonjour {prenom}, votre espace Althy est prêt ! "
            f"Connectez-vous ici (valable 7j) : {magic_link_url}"
        )
        try:
            async with httpx.AsyncClient(timeout=8, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)) as client:
                await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                    data={
                        "From": settings.TWILIO_FROM_NUMBER,
                        "To":   payload.telephone,
                        "Body": sms_body,
                    },
                )
        except Exception:
            pass

    # ── 6. QR code ────────────────────────────────────────────────────────────
    qr_base64: str | None = None
    if "qr" in payload.mode_envoi:
        qr_base64 = _generate_qr(magic_link_url)
        # Persist QR code record
        qr_code_val = secrets.token_urlsafe(16)
        try:
            await db.execute(
                text("""
                    INSERT INTO qr_codes (id, user_id, code, type, payload)
                    VALUES (:id, :uid, :code, 'invitation', :payload)
                """),
                {
                    "id":      _uuid.uuid4(),
                    "uid":     current_user.id,
                    "code":    qr_code_val,
                    "payload": json.dumps({"magic_link_url": magic_link_url, "email": email}),
                },
            )
            await db.commit()
        except Exception:
            await db.rollback()

    # ── 7. Mark session complete if session_id supplied ───────────────────────
    if payload.session_id:
        try:
            await db.execute(
                text("""
                    UPDATE onboarding_sessions
                    SET completed = TRUE, completed_at = now(),
                        user_id = :uid,
                        data = data || :extra::jsonb
                    WHERE id = :sid
                """),
                {
                    "uid":   user_id_val,
                    "sid":   _uuid.UUID(payload.session_id),
                    "extra": json.dumps({"magic_link_token": token, "invited_email": email}),
                },
            )
            await db.commit()
        except Exception:
            await db.rollback()

    return {
        "ok":             True,
        "user_id":        supabase_uid,
        "magic_link_url": magic_link_url,
        "expires_at":     expires_at.isoformat(),
        "qr_base64":      qr_base64,
        "mode_envoi":     payload.mode_envoi,
    }


# ── GET /onboarding/session/{session_id} ─────────────────────────────────────

@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Statut d'une session d'onboarding (polling / Realtime)."""
    try:
        sid = _uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(422, "session_id invalide")

    row = await db.execute(
        text("""
            SELECT id, mode, role, step, data, completed, completed_at, expires_at, created_at
            FROM onboarding_sessions
            WHERE id = :id AND user_id = :uid
        """),
        {"id": sid, "uid": current_user.id},
    )
    r = row.one_or_none()
    if not r:
        raise HTTPException(404, "Session introuvable")

    return {
        "id":           str(r.id),
        "mode":         r.mode,
        "role":         r.role,
        "step":         r.step,
        "data":         r.data,
        "completed":    r.completed,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "expires_at":   r.expires_at.isoformat(),
        "created_at":   r.created_at.isoformat(),
    }


# ── GET /onboarding/sessions ─────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    current_user: AuthDep,
    db: DbDep,
    limit: int = 20,
) -> list[dict]:
    """Liste les sessions d'onboarding créées par cet utilisateur (admin / agence)."""
    rows = await db.execute(
        text("""
            SELECT id, mode, role, step, data, completed, completed_at, created_at
            FROM onboarding_sessions
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"uid": current_user.id, "limit": limit},
    )
    return [
        {
            "id":           str(r.id),
            "mode":         r.mode,
            "role":         r.role,
            "step":         r.step,
            "data":         r.data,
            "completed":    r.completed,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "created_at":   r.created_at.isoformat(),
        }
        for r in rows
    ]


# ── POST /onboarding/rejoindre (public — no auth) ────────────────────────────

class RejoindrePayload(BaseModel):
    token:  str
    prenom: str
    nom:    str
    email:  str


@router.post("/rejoindre")
async def rejoindre(
    payload: RejoindrePayload,
    db: DbDep,
) -> dict:
    """
    Consomme un magic link et retourne des tokens d'authentification Supabase.
    Utilisé par la page publique /rejoindre/[token].
    """
    email = payload.email.strip().lower()

    row = await db.execute(
        text("""
            SELECT id, target_email, target_role, payload, used, expires_at
            FROM magic_links
            WHERE token = :token AND type = 'invitation'
        """),
        {"token": payload.token},
    )
    link = row.one_or_none()
    if not link:
        raise HTTPException(404, "Lien introuvable ou expiré")
    if link.used:
        raise HTTPException(409, "Ce lien a déjà été utilisé")
    if link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(410, "Lien expiré — demandez un nouveau lien à votre agence")

    # Email must match (or be the target)
    if link.target_email and link.target_email.lower() != email:
        raise HTTPException(403, "L'email ne correspond pas à l'invitation")

    link_payload: dict = link.payload or {}
    user_id_str = link_payload.get("user_id")
    if not user_id_str:
        raise HTTPException(400, "Lien invalide — contactez votre agence")

    # Update prenom/nom in our DB
    try:
        await db.execute(
            text("UPDATE users SET prenom = :p, nom = :n WHERE id = :id"),
            {"p": payload.prenom, "n": payload.nom, "id": _uuid.UUID(user_id_str)},
        )
        # Mark magic link used
        await db.execute(
            text("""
                UPDATE magic_links SET used = TRUE, used_at = now(), used_by = :uid
                WHERE token = :token
            """),
            {"uid": _uuid.UUID(user_id_str), "token": payload.token},
        )
        await db.commit()
    except Exception:
        await db.rollback()

    # Generate a Supabase sign-in link (OTP) for the user
    try:
        link_data = await _supa_post(
            _auth_url("/admin/generate_link"),
            {
                "type":       "magiclink",
                "email":      email,
                "redirect_to": f"{settings.FRONTEND_URL}/bienvenue?auto=true",
            },
        )
        auth_url = link_data.get("action_link") or link_data.get("hashed_token")
    except Exception:
        auth_url = None

    return {
        "ok":        True,
        "user_id":   user_id_str,
        "role":      link.target_role,
        "auth_url":  auth_url,       # Front redirects to this URL for auto sign-in
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_qr(url: str) -> str:
    """Generate QR code PNG → base64 data URI."""
    try:
        import qrcode  # type: ignore[import]
        from qrcode.image.pil import PilImage  # type: ignore[import]

        qr = qrcode.QRCode(
            version=3,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1A1612", back_color="#FFFFFF", image_factory=PilImage)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


async def _generate_email_html(prenom: str, nom_agence: str, magic_link_url: str) -> str:
    """Generate personalized HTML email via Claude with warm/professional tone."""
    if not settings.ANTHROPIC_API_KEY:
        return _fallback_email_html(prenom, nom_agence, magic_link_url)

    prompt = f"""Génère un email HTML complet (<!DOCTYPE html>…</html>) de bienvenue pour {prenom},
nouveau membre de {nom_agence} sur Althy, la plateforme immobilière suisse.

Consignes :
- Ton bienveillant et professionnel, jamais promotionnel
- Mentionner que Althy simplifie la gestion immobilière
- CTA principal : bouton orange (#E8602C) "Accéder à mon espace Althy" → {magic_link_url}
- Mentionner que le lien est valable 7 jours
- Design sobre : fond blanc, police Inter/sans-serif, max 600px de large
- Footer : "Althy · althy.ch · noreply@althy.ch"
- NE PAS inclure de pièces jointes ni d'images externes non fiables
- Retourner UNIQUEMENT le HTML complet, aucun texte avant ni après"""

    try:
        client = _claude()
        msg = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        html = msg.content[0].text.strip()  # type: ignore[union-attr]
        if "```" in html:
            html = html.split("```")[1].lstrip("html").strip().rstrip("```").strip()
        return html
    except Exception:
        return _fallback_email_html(prenom, nom_agence, magic_link_url)


def _fallback_email_html(prenom: str, nom_agence: str, magic_link_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Bienvenue sur Althy</title></head>
<body style="font-family:Inter,sans-serif;background:#FAF8F5;margin:0;padding:32px 0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EAE3D9">
    <div style="background:#1A1612;padding:28px 32px;text-align:center">
      <span style="font-family:'Cormorant Garamond',serif;font-size:28px;color:#E8602C;letter-spacing:6px">ALTHY</span>
    </div>
    <div style="padding:32px">
      <h2 style="color:#1A1612;font-size:20px;font-weight:700;margin:0 0 16px">Bonjour {prenom},</h2>
      <p style="color:#3D3530;font-size:14px;line-height:1.7;margin:0 0 12px">
        Bienvenue sur <strong>Althy</strong>, votre assistant immobilier suisse disponible 24h/24.
        {nom_agence} vous a invité à rejoindre la plateforme.
      </p>
      <p style="color:#3D3530;font-size:14px;line-height:1.7;margin:0 0 28px">
        Cliquez ci-dessous pour accéder à votre espace — aucun mot de passe requis.
        Ce lien est valable <strong>7 jours</strong>.
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="{magic_link_url}"
           style="display:inline-block;background:#E8602C;color:#fff;text-decoration:none;
                  padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
          Accéder à mon espace Althy →
        </a>
      </div>
      <p style="color:#8A7A6A;font-size:12px;line-height:1.6;margin:0">
        Si ce lien ne fonctionne pas, copiez cette URL dans votre navigateur :<br>
        <a href="{magic_link_url}" style="color:#E8602C;word-break:break-all">{magic_link_url}</a>
      </p>
    </div>
    <div style="background:#FAF8F5;padding:20px 32px;border-top:1px solid #EAE3D9;text-align:center">
      <p style="color:#8A7A6A;font-size:11px;margin:0">
        Althy · <a href="https://althy.ch" style="color:#8A7A6A">althy.ch</a> ·
        <a href="mailto:noreply@althy.ch" style="color:#8A7A6A">noreply@althy.ch</a>
      </p>
    </div>
  </div>
</body>
</html>"""


# ── Scan onboarding ───────────────────────────────────────────────────────────

from sqlalchemy import select as _select
from app.models.onboarding import OnboardingScan


@router.get("/scan")
async def get_scan(user: AuthDep, db: DbDep):
    """Retourne le dernier scan onboarding de l'utilisateur."""
    result = await db.execute(
        _select(OnboardingScan)
        .where(OnboardingScan.user_id == user.id)
        .order_by(OnboardingScan.created_at.desc())
    )
    scan = result.scalar_one_or_none()
    if not scan:
        return {"status": "pending", "elements": [], "nb": 0}
    return {
        "status":   scan.status,
        "nb":       scan.nb_elements,
        "elements": json.loads(scan.elements_trouves or "[]"),
    }


class ConfirmerRequest(BaseModel):
    confirmes: list[str]
    rejetes:   list[str]


@router.post("/confirmer")
async def confirmer(body: ConfirmerRequest, user: AuthDep, db: DbDep):
    """Valide les éléments sélectionnés et lance l'import en arrière-plan."""
    result = await db.execute(
        _select(OnboardingScan).where(OnboardingScan.user_id == user.id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun scan trouvé")

    elements = json.loads(scan.elements_trouves or "[]")
    a_importer = [e for e in elements if e.get("source_id") in body.confirmes]

    from app.tasks.import_elements import importer_elements
    importer_elements.delay(
        user_id   = str(user.id),
        user_role = user.role,
        elements  = a_importer,
    )

    scan.status = "done"
    await db.commit()
    return {"status": "import_lance", "nb": len(a_importer)}


# ══════════════════════════════════════════════════════════════════════════════
# Import CSV / XLSX — /onboarding/import-csv
# ══════════════════════════════════════════════════════════════════════════════

# ── Column aliases → canonical field name ────────────────────────────────────

_COL_ALIASES: dict[str, str] = {
    # adresse
    "adresse": "adresse", "address": "adresse", "rue": "adresse", "street": "adresse",
    "adresse_bien": "adresse", "bien": "adresse",
    # ville
    "ville": "ville", "city": "ville", "localite": "ville", "localite": "ville",
    # cp / npa
    "cp": "cp", "npa": "cp", "code_postal": "cp", "postal_code": "cp",
    "zip": "cp", "code": "cp",
    # type
    "type": "type", "type_bien": "type", "bien_type": "type", "categorie": "type",
    "category": "type",
    # loyer
    "loyer": "loyer", "loyer_mensuel": "loyer", "rent": "loyer",
    "monthly_rent": "loyer", "loyer_net": "loyer",
    # charges
    "charges": "charges", "charges_mensuelles": "charges",
    "charges_locatives": "charges",
    # surface
    "surface": "surface", "superficie": "surface", "m2": "surface",
    "surface_m2": "surface",
    # locataire nom
    "locataire_nom": "locataire_nom", "nom_locataire": "locataire_nom",
    "tenant_name": "locataire_nom", "nom": "locataire_nom", "name": "locataire_nom",
    "tenant": "locataire_nom",
    # locataire prénom
    "locataire_prenom": "locataire_prenom", "prenom_locataire": "locataire_prenom",
    "tenant_firstname": "locataire_prenom", "prenom": "locataire_prenom",
    "firstname": "locataire_prenom",
    # date entrée
    "date_entree": "date_entree", "entree": "date_entree", "debut_bail": "date_entree",
    "lease_start": "date_entree", "date_debut": "date_entree",
    # statut
    "statut": "statut", "status": "statut", "etat": "statut",
    "occupation": "statut",
}

def _normalize_col(col: str) -> str | None:
    key = col.strip().lower()
    key = re.sub(r"[\s\-]+", "_", key)
    key = re.sub(r"[éèêë]", "e", key)
    key = re.sub(r"[àâä]", "a", key)
    key = re.sub(r"[ùûü]", "u", key)
    key = re.sub(r"[ôö]", "o", key)
    key = re.sub(r"[îï]", "i", key)
    return _COL_ALIASES.get(key)


def _parse_decimal_val(val: str) -> Decimal | None:
    if not val or not val.strip():
        return None
    v = val.strip()
    v = re.sub(r"['\s]", "", v)
    v = v.replace("CHF", "").replace("chf", "").replace("Fr.", "").replace("fr.", "")
    v = v.replace(",", ".")
    v = re.sub(r"[^0-9.]", "", v)
    if not v:
        return None
    try:
        return Decimal(v)
    except InvalidOperation:
        return None


def _parse_date_val(val: str) -> _date | None:
    if not val or not val.strip():
        return None
    v = val.strip()
    # dd.mm.yyyy or dd/mm/yyyy
    m = re.match(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})$", v)
    if m:
        try:
            return _date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    # yyyy-mm-dd
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
    if m:
        try:
            return _date.fromisoformat(v)
        except ValueError:
            pass
    return None


def _parse_csv_bytes(content: bytes, filename: str) -> list[dict[str, str]]:
    """Return list of dicts from CSV or XLSX bytes."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"
    if ext == "xlsx":
        try:
            import openpyxl  # type: ignore[import]
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            rows_raw = list(ws.iter_rows(values_only=True))
            if not rows_raw:
                return []
            headers = [str(c or "").strip() for c in rows_raw[0]]
            result: list[dict[str, str]] = []
            for row in rows_raw[1:]:
                if all(c is None for c in row):
                    continue
                result.append({
                    headers[i]: str(row[i] if row[i] is not None else "").strip()
                    for i in range(min(len(headers), len(row)))
                })
            return result
        except ImportError:
            raise HTTPException(400, "Support XLSX non disponible. Convertissez en CSV d'abord.")
    else:
        text_content = content.decode("utf-8-sig", errors="replace")
        try:
            dialect = csv.Sniffer().sniff(text_content[:2048], delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(text_content), dialect=dialect)
        return [dict(row) for row in reader]


# ── Schemas ───────────────────────────────────────────────────────────────────

class CsvRow(BaseModel):
    adresse: str = ""
    ville: str = ""
    cp: str = ""
    type: str = "appartement"
    loyer: str = ""
    charges: str = ""
    surface: str = ""
    statut: str = "vacant"
    locataire_nom: str = ""
    locataire_prenom: str = ""
    date_entree: str = ""
    erreurs: list[str] = []


class CsvPreviewResponse(BaseModel):
    rows: list[CsvRow]
    colonnes_detectees: dict[str, str]
    total_lignes: int
    colonnes_inconnues: list[str]


class CsvImportPayload(BaseModel):
    rows: list[CsvRow]


class CsvImportResult(BaseModel):
    biens_crees: int
    locataires_crees: int
    total_lignes: int
    lignes_ignorees: int
    erreurs: list[dict[str, Any]]


def _map_raw_rows(raw_rows: list[dict[str, str]]) -> tuple[list[CsvRow], dict[str, str], list[str]]:
    if not raw_rows:
        return [], {}, []

    all_cols = list(raw_rows[0].keys())
    col_map: dict[str, str] = {}   # original header → canonical
    unknown: list[str] = []
    for col in all_cols:
        canonical = _normalize_col(col)
        if canonical:
            col_map[col] = canonical
        else:
            unknown.append(col)

    # Reverse: canonical → first matching original header
    rev: dict[str, str] = {}
    for orig, canon in col_map.items():
        rev.setdefault(canon, orig)

    def get(row: dict[str, str], field: str) -> str:
        orig = rev.get(field)
        return row.get(orig, "").strip() if orig else ""

    rows: list[CsvRow] = []
    for raw in raw_rows:
        errs: list[str] = []
        adresse = get(raw, "adresse")
        ville   = get(raw, "ville")
        cp      = get(raw, "cp")
        if not adresse: errs.append("Adresse manquante")
        if not ville:   errs.append("Ville manquante")
        if not cp:      errs.append("NPA manquant")

        type_raw   = get(raw, "type")
        type_val   = normalize_bien_type(type_raw)
        statut_raw = get(raw, "statut")
        statut_val = normalize_bien_statut(statut_raw)

        rows.append(CsvRow(
            adresse=adresse,
            ville=ville,
            cp=cp,
            type=type_val,
            loyer=get(raw, "loyer"),
            charges=get(raw, "charges"),
            surface=get(raw, "surface"),
            statut=statut_val,
            locataire_nom=get(raw, "locataire_nom"),
            locataire_prenom=get(raw, "locataire_prenom"),
            date_entree=get(raw, "date_entree"),
            erreurs=errs,
        ))

    return rows, col_map, unknown


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/import-csv/preview", response_model=CsvPreviewResponse)
async def preview_csv_import(
    current_user: AuthDep,
    file: UploadFile = File(...),
) -> CsvPreviewResponse:
    """Parse CSV/XLSX and return rows preview — no DB write."""
    if current_user.role not in ("super_admin",):
        raise HTTPException(403, "Accès réservé aux super_admins")

    fname = file.filename or "upload.csv"
    ext   = fname.rsplit(".", 1)[-1].lower() if "." in fname else "csv"
    if ext not in ("csv", "xlsx"):
        raise HTTPException(400, "Format non supporté. Utilisez CSV ou XLSX.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Fichier trop volumineux (max 10 Mo)")
    if not content:
        raise HTTPException(400, "Fichier vide")

    try:
        raw_rows = _parse_csv_bytes(content, fname)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Impossible de lire le fichier : {exc!s:.200}")

    if not raw_rows:
        raise HTTPException(400, "Le fichier ne contient aucune ligne de données")

    rows, col_map, unknown = _map_raw_rows(raw_rows)

    return CsvPreviewResponse(
        rows=rows,
        colonnes_detectees={v: k for k, v in col_map.items()},
        total_lignes=len(rows),
        colonnes_inconnues=unknown,
    )


@router.post("/import-csv", response_model=CsvImportResult)
async def import_csv(
    payload: CsvImportPayload,
    current_user: AuthDep,
    db: DbDep,
) -> CsvImportResult:
    """Batch-create biens + locataires from parsed rows."""
    if current_user.role not in ("super_admin",):
        raise HTTPException(403, "Accès réservé aux super_admins")

    from app.models.bien import Bien
    from app.models.locataire import Locataire

    biens_crees      = 0
    locataires_crees = 0
    lignes_ignorees  = 0
    erreurs: list[dict[str, Any]] = []

    for i, row in enumerate(payload.rows):
        ligne = i + 1
        if not row.adresse.strip() or not row.ville.strip() or not row.cp.strip():
            lignes_ignorees += 1
            erreurs.append({"ligne": ligne, "message": "Ignorée — adresse/ville/NPA manquants"})
            continue

        try:
            bien = Bien(
                owner_id=current_user.id,
                adresse=row.adresse.strip(),
                ville=row.ville.strip(),
                cp=row.cp.strip(),
                type=row.type or "appartement",
                loyer=_parse_decimal_val(row.loyer),
                charges=_parse_decimal_val(row.charges),
                surface=(
                    float(re.sub(r"[^0-9.]", "", row.surface.replace(",", ".")))
                    if row.surface and row.surface.strip() else None
                ),
                statut=row.statut or "vacant",
            )
            db.add(bien)
            await db.flush()
            biens_crees += 1

            has_loc = bool(row.locataire_nom or row.locataire_prenom or row.date_entree)
            if has_loc or row.statut == "loue":
                note_parts = " ".join(filter(None, [row.locataire_prenom.strip(), row.locataire_nom.strip()]))
                loc = Locataire(
                    bien_id=bien.id,
                    loyer=_parse_decimal_val(row.loyer),
                    charges=_parse_decimal_val(row.charges),
                    date_entree=_parse_date_val(row.date_entree),
                    statut="actif",
                    note_interne=note_parts or None,
                )
                db.add(loc)
                locataires_crees += 1

        except Exception as exc:
            lignes_ignorees += 1
            erreurs.append({"ligne": ligne, "message": str(exc)[:200]})

    try:
        await db.flush()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f"Erreur lors de l'import : {exc!s:.300}")

    return CsvImportResult(
        biens_crees=biens_crees,
        locataires_crees=locataires_crees,
        total_lignes=len(payload.rows),
        lignes_ignorees=lignes_ignorees,
        erreurs=erreurs,
    )
