"""Landing Chat — /api/v1/landing/chat (public, unauth)

Endpoint conversationnel public affiché sur althy.ch. Bridé à 4 intents :
  - estimation      (prix / estimation d'un bien)
  - recherche_bien  (louer / acheter)
  - autonomie       (proprio qui veut quitter son agence)
  - hors_scope      (question hors immobilier suisse)

Sécurité
--------
- Rate limit : 10 req/60s par IP, 30 req/h par IP (via redis).
- Max 4 tours par session anonyme (cookie `althy_landing_sid` signé HMAC).
- Contexte bridé, pas d'accès DB utilisateur, pas d'écriture DB.
- Budget tokens par session : 4 000 output (~4 tours * 1 000).

Protocole SSE
-------------
    data: {"type": "intent", "intent": "estimation", "entities": {"ville": "Genève", "type": "4.5"}}
    data: {"type": "text", "text": "..."}
    data: {"type": "done", "turn": 2, "turns_left": 2, "cta": "register|autonomie|biens"}
    data: [DONE]

Le front utilise `intent` + `entities` pour réagir (zoom Mapbox, filtre biens).
"""
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

import anthropic
import redis as redis_lib
from app.core.config import settings
from app.core.limiter import rate_limit
from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(prefix="/landing", tags=["landing"])

# ── Config ────────────────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-5-20251001"
MAX_TOKENS_PER_TURN = 500
MAX_TURNS_PER_SESSION = 4
COOKIE_NAME = "althy_landing_sid"
COOKIE_MAX_AGE = 60 * 60 * 24  # 24h
SESSION_REDIS_TTL = 60 * 60 * 2  # 2h

SYSTEM_PROMPT = """Tu es Althy IA, un assistant immobilier suisse affiché sur la landing page althy.ch.

Tu as exactement 4 domaines autorisés :
  1. Estimation d'un bien (loyer ou prix de vente) en Suisse.
  2. Recherche de biens à louer ou à acheter en Suisse romande.
  3. Althy Autonomie (CHF 39/mois) : propriétaire qui veut quitter son agence.
  4. Information générale sur Althy et ses services immobiliers suisses.

Règles strictes :
- Réponds toujours en français, 2-4 phrases maximum par tour.
- Refuse poliment toute question hors immobilier suisse (météo, sport, politique, code…).
- Ne donne JAMAIS de fourchette de prix précise sans avoir 3 infos min (ville, type, surface). Pose 1-2 questions courtes d'abord.
- Ne prétends pas avoir accès aux données utilisateur : tu es un démo publique.
- Après 2-3 échanges utiles, invite doucement à créer un compte gratuit ("Créez votre compte gratuit pour…") ou à consulter /autonomie, /biens ou /estimation selon l'intent.
- Ne mentionne aucun prix d'abonnement hors CHF 39/mois (Althy Autonomie), CHF 14 (Particulier), CHF 29 (Actif).
- Pas de markdown lourd, pas d'emoji sauf 1 max par réponse si pertinent.

Ton : chaleureux, précis, professionnel suisse. Tu vouvoies toujours."""


# ── Intent detection ──────────────────────────────────────────────────────────

_INTENT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("estimation",     re.compile(r"\b(estim\w*|combien\s+vaut|prix|valeur|loyer\s+juste|rendement)\b", re.I)),
    ("recherche_bien", re.compile(r"\b(cherch\w*|trouv\w*|louer|acheter|3\s*pi[èe]ces|4\s*pi[èe]ces|studio|appartement)\b", re.I)),
    ("autonomie",      re.compile(r"\b(quitter\s+mon\s+agence|g[eé]rer\s+seul|autonom\w*|sans\s+agence|propri[eé]taire)\b", re.I)),
]

_VILLES = re.compile(
    r"\b(gen[èe]ve|lausanne|fribourg|neuch[aâ]tel|sion|valais|vaud|montreux|vevey|nyon|morges|yverdon|bulle)\b",
    re.I,
)
_TYPE_BIEN = re.compile(r"\b(\d(?:\.\d)?\s*pi[èe]ces|studio|maison|villa|appartement|loft)\b", re.I)
_BUDGET = re.compile(r"(\d[\d'\s]{2,})\s*(chf|fr|francs?)?", re.I)
_SURFACE = re.compile(r"(\d{2,3})\s*m[²2]", re.I)


def detect_intent_and_entities(message: str) -> dict:
    """Return {intent, entities} where entities may be empty."""
    intent = "hors_scope"
    for name, pattern in _INTENT_PATTERNS:
        if pattern.search(message):
            intent = name
            break

    entities: dict[str, str] = {}
    if m := _VILLES.search(message):
        entities["ville"] = m.group(1).title()
    if m := _TYPE_BIEN.search(message):
        entities["type"] = m.group(1).lower().replace(" ", "")
    if m := _BUDGET.search(message):
        raw = m.group(1).replace("'", "").replace(" ", "")
        try:
            entities["budget"] = str(int(raw))
        except ValueError:
            pass
    if m := _SURFACE.search(message):
        entities["surface"] = m.group(1)

    return {"intent": intent, "entities": entities}


# ── Session (cookie signé HMAC + Redis pour compteur tours) ───────────────────

def _sign(sid: str) -> str:
    mac = hmac.new(settings.SECRET_KEY.encode(), sid.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{sid}.{mac}"


def _verify(signed: str) -> str | None:
    try:
        sid, mac = signed.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(settings.SECRET_KEY.encode(), sid.encode(), hashlib.sha256).hexdigest()[:16]
    return sid if hmac.compare_digest(mac, expected) else None


def _redis() -> redis_lib.Redis | None:
    try:
        return redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=1, decode_responses=True)
    except Exception:
        return None


def _get_turns(sid: str) -> int:
    r = _redis()
    if not r:
        return 0
    try:
        return int(r.get(f"landing:turns:{sid}") or 0)
    except Exception:
        return 0


def _bump_turns(sid: str) -> int:
    r = _redis()
    if not r:
        return 1
    try:
        n = r.incr(f"landing:turns:{sid}")
        if n == 1:
            r.expire(f"landing:turns:{sid}", SESSION_REDIS_TTL)
        return n
    except Exception:
        return 1


def _get_history(sid: str) -> list[dict]:
    r = _redis()
    if not r:
        return []
    try:
        raw = r.get(f"landing:history:{sid}")
        return json.loads(raw) if raw else []
    except Exception:
        return []


def _push_history(sid: str, user_msg: str, assistant_msg: str) -> None:
    r = _redis()
    if not r:
        return
    try:
        hist = _get_history(sid)
        hist.append({"role": "user", "content": user_msg})
        hist.append({"role": "assistant", "content": assistant_msg})
        hist = hist[-8:]  # keep last 4 turns max
        r.setex(f"landing:history:{sid}", SESSION_REDIS_TTL, json.dumps(hist))
    except Exception:
        pass


# ── Request / response ───────────────────────────────────────────────────────

class LandingChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)


# ── POST /landing/chat ───────────────────────────────────────────────────────

@router.post("/chat")
async def landing_chat(
    payload: LandingChatRequest,
    request: Request,
    response: Response,
    sid_cookie: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
    _=rate_limit(10, 60),
) -> StreamingResponse:
    """Public conversational endpoint — bridé, anonyme, rate-limited."""
    # Resolve or mint session id
    sid = _verify(sid_cookie) if sid_cookie else None
    is_new_session = False
    if not sid:
        sid = secrets.token_urlsafe(18)
        is_new_session = True

    turns_used = _get_turns(sid)
    if turns_used >= MAX_TURNS_PER_SESSION:
        async def _quota_gen() -> AsyncGenerator[str, None]:
            payload_done = {
                "type": "done",
                "turn": turns_used,
                "turns_left": 0,
                "cta": "register",
                "quota_reached": True,
            }
            yield f"data: {json.dumps({'type': 'text', 'text': 'Vous avez atteint la limite de questions gratuites. Créez votre compte gratuit pour continuer avec Althy IA.'})}\n\n"
            yield f"data: {json.dumps(payload_done)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(
            _quota_gen(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    detection = detect_intent_and_entities(payload.message)
    history = _get_history(sid)

    async def _generate() -> AsyncGenerator[str, None]:
        # 1. Emit intent + entities first
        yield f"data: {json.dumps({'type': 'intent', **detection})}\n\n"

        # 2. Stream Claude
        messages = history + [{"role": "user", "content": payload.message}]
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        full_reply = ""

        try:
            async with client.messages.stream(
                model=MODEL,
                max_tokens=MAX_TOKENS_PER_TURN,
                system=SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    full_reply += text
                    yield f"data: {json.dumps({'type': 'text', 'text': text.replace(chr(10), chr(92) + 'n')})}\n\n"
        except anthropic.APIError as exc:
            log.error("Landing chat Claude error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'error': 'Erreur temporaire. Réessayez.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # 3. Persist + increment turn counter
        new_turn = _bump_turns(sid)
        _push_history(sid, payload.message, full_reply)

        # 4. Choose CTA based on intent
        cta = {
            "estimation":     "estimation",
            "recherche_bien": "biens",
            "autonomie":      "autonomie",
            "hors_scope":     "register",
        }.get(detection["intent"], "register")

        done_payload = {
            "type": "done",
            "turn": new_turn,
            "turns_left": max(0, MAX_TURNS_PER_SESSION - new_turn),
            "cta": cta,
        }
        yield f"data: {json.dumps(done_payload)}\n\n"
        yield "data: [DONE]\n\n"

    # Set signed cookie if new session
    if is_new_session:
        response.set_cookie(
            key=COOKIE_NAME,
            value=_sign(sid),
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=not settings.DEBUG,
        )

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /landing/chat (EventSource fallback) ─────────────────────────────────

@router.get("/chat")
async def landing_chat_get(
    request: Request,
    response: Response,
    message: str,
    sid_cookie: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
    _=rate_limit(10, 60),
) -> StreamingResponse:
    """Version GET pour EventSource (ne supporte que GET)."""
    if len(message) < 1 or len(message) > 500:
        raise HTTPException(status_code=400, detail="Message invalide (1-500 chars)")
    return await landing_chat(
        LandingChatRequest(message=message),
        request,
        response,
        sid_cookie=sid_cookie,
    )


# ── GET /landing/session (état compteur) ─────────────────────────────────────

@router.get("/session")
async def landing_session(
    sid_cookie: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> dict:
    """Retourne l'état de la session anonyme (pour afficher 'il vous reste N questions')."""
    sid = _verify(sid_cookie) if sid_cookie else None
    if not sid:
        return {"turns_used": 0, "turns_left": MAX_TURNS_PER_SESSION}
    used = _get_turns(sid)
    return {
        "turns_used": used,
        "turns_left": max(0, MAX_TURNS_PER_SESSION - used),
    }
