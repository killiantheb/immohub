"""estimation.py — POST /api/v1/estimation/rapide

Endpoint public (sans auth) pour l'estimation IA rapide du loyer.
Rate-limité à 5 requêtes par IP par heure.
Log chaque estimation dans estimation_logs pour analytics.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Annotated

import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import rate_limit
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/estimation", tags=["estimation"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

import logging
_logger = logging.getLogger("althy.estimation")

MODEL      = "claude-sonnet-4-20250514"
MAX_TOKENS = 300

# ── Schemas ───────────────────────────────────────────────────────────────────

class EstimationRequest(BaseModel):
    adresse:    str   = Field(...,             min_length=3, max_length=200)
    pieces:     int   = Field(...,             ge=1, le=20)
    surface_m2: float = Field(...,             ge=5, le=2000)
    type:       str   = Field("appartement",   pattern="^(appartement|maison|studio|villa|commerce)$")


class EstimationResponse(BaseModel):
    min:        int
    max:        int
    confiance:  float
    quartier:   str
    comparable: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    """Parse JSON depuis la réponse Claude — gère les markdown fences éventuels."""
    cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
    return json.loads(cleaned)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/rapide", response_model=EstimationResponse)
async def estimation_rapide(
    request: Request,
    body:    EstimationRequest,
    db:      DbDep,
    _rl=rate_limit(5, 3600),          # 5 requêtes / IP / heure
):
    """
    Estimation IA du loyer mensuel — SANS authentification.
    Lead magnet landing page : retourne min/max/confiance/quartier/comparable.
    """
    prompt = (
        "Tu es un expert immobilier suisse spécialisé en Suisse romande. "
        "Estime le loyer mensuel en CHF pour le bien suivant :\n\n"
        f"  Adresse/ville : {body.adresse}\n"
        f"  Type          : {body.type}\n"
        f"  Pièces        : {body.pieces}\n"
        f"  Surface       : {body.surface_m2} m²\n\n"
        "Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire :\n"
        '{"min": <entier>, "max": <entier>, "confiance": <float 0-1>, '
        '"quartier": "<type de quartier>", "comparable": "<exemple bien similaire récent>"}'
    )

    try:
        client  = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        raw  = message.content[0].text if message.content else ""
        data = _extract_json(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(422, f"Réponse IA non parseable : {exc}") from exc
    except anthropic.APIError as exc:
        raise HTTPException(503, "Service d'estimation temporairement indisponible") from exc
    except Exception as exc:
        raise HTTPException(503, "Service d'estimation temporairement indisponible") from exc

    result = EstimationResponse(
        min=int(data.get("min", 0)),
        max=int(data.get("max", 0)),
        confiance=float(data.get("confiance", 0.7)),
        quartier=str(data.get("quartier", "")),
        comparable=str(data.get("comparable", "")),
    )

    # ── Log analytics — best-effort, jamais bloquant ──────────────────────────
    ip = request.client.host if request.client else "unknown"
    try:
        await db.execute(
            text("""
                INSERT INTO estimation_logs
                    (adresse, pieces, surface_m2, type, resultat, ip, created_at)
                VALUES
                    (:adresse, :pieces, :surface_m2, :type, :resultat::jsonb, :ip, :created_at)
            """),
            {
                "adresse":    body.adresse,
                "pieces":     body.pieces,
                "surface_m2": body.surface_m2,
                "type":       body.type,
                "resultat":   json.dumps({
                    "min":       result.min,
                    "max":       result.max,
                    "confiance": result.confiance,
                }),
                "ip":         ip,
                "created_at": datetime.now(timezone.utc),
            },
        )
        await db.commit()
    except Exception:
        pass  # Ne jamais bloquer l'estimation sur un échec de log

    return result


# ── Deferred estimation (fallback when AI estimation fails) ──────────────────

class DeferredEstimationRequest(BaseModel):
    address: str = Field(..., min_length=1, max_length=200)
    city:    str = Field(..., min_length=1, max_length=100)
    type:    str = Field("appartement")
    surface: float = Field(..., ge=5, le=5000)
    rooms:   int | None = None
    email:   str = Field(..., min_length=3, max_length=200)


@router.post("/deferred")
async def estimation_deferred(
    request: Request,
    body: DeferredEstimationRequest,
    db: DbDep,
):
    """Enregistre une demande d'estimation différée quand l'IA est indisponible.

    - Insère dans estimation_logs avec status='deferred'
    - Envoie un email à l'admin pour traitement manuel si besoin
    - Retourne { status: "queued", eta: "24h" }
    """
    ip = request.client.host if request.client else "unknown"

    # Log the deferred request
    try:
        await db.execute(
            text("""
                INSERT INTO estimation_logs
                    (adresse, pieces, surface_m2, type, resultat, ip, created_at)
                VALUES
                    (:adresse, :pieces, :surface_m2, :type, :resultat::jsonb, :ip, :created_at)
            """),
            {
                "adresse":    f"{body.address}, {body.city}",
                "pieces":     body.rooms or 0,
                "surface_m2": body.surface,
                "type":       body.type,
                "resultat":   json.dumps({
                    "status": "deferred",
                    "email":  body.email,
                }),
                "ip":         ip,
                "created_at": datetime.now(timezone.utc),
            },
        )
        await db.commit()
    except Exception as exc:
        _logger.warning("[estimation/deferred] DB log failed: %s", exc)
        # Best-effort — don't block the response

    # Notify admin via Resend
    try:
        if settings.RESEND_API_KEY:
            import httpx
            html = f"""
            <div style="font-family:DM Sans,sans-serif;max-width:560px;margin:0 auto">
                <h2 style="color:#E8602C">Estimation différée — à traiter</h2>
                <p><strong>Adresse :</strong> {body.address}, {body.city}</p>
                <p><strong>Type :</strong> {body.type} · {body.surface} m²{f" · {body.rooms} pièces" if body.rooms else ""}</p>
                <p><strong>Email client :</strong> {body.email}</p>
                <p><strong>IP :</strong> {ip}</p>
                <hr style="border:none;border-top:1px solid #E8E4DC;margin:20px 0" />
                <p style="font-size:13px;color:#7A7469">
                    L'estimation IA a échoué. Répondre manuellement à {body.email} sous 24h.
                </p>
            </div>
            """
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": f"Althy <{settings.EMAILS_FROM}>",
                        "to": [settings.EMAILS_FROM],
                        "subject": f"Estimation différée — {body.address}, {body.city}",
                        "html": html,
                    },
                )
                if resp.status_code not in (200, 201):
                    _logger.warning("[estimation/deferred] Resend %s: %s", resp.status_code, resp.text[:200])
        else:
            _logger.info("[estimation/deferred] DEV — email ignoré pour %s", body.email)
    except Exception as exc:
        _logger.error("[estimation/deferred] Admin notification error: %s", exc)

    return {"status": "queued", "eta": "24h"}
