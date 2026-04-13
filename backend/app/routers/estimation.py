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

MODEL      = "claude-sonnet-4-20250514"
MAX_TOKENS = 300

_TYPE_FR: dict[str, str] = {
    "apartment": "appartement",
    "house":     "maison",
    "studio":    "studio",
    "villa":     "villa",
    "commercial": "local commercial",
}

# ── Schemas ───────────────────────────────────────────────────────────────────

class EstimationRequest(BaseModel):
    adresse:    str   = Field(...,          min_length=3, max_length=200)
    pieces:     int   = Field(...,          ge=1, le=20)
    surface_m2: float = Field(...,          ge=5, le=2000)
    type:       str   = Field("apartment", pattern="^(apartment|house|studio|villa|commercial)$")


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
    type_fr = _TYPE_FR.get(body.type, body.type)

    prompt = (
        "Tu es un expert immobilier suisse spécialisé en Suisse romande. "
        "Estime le loyer mensuel en CHF pour le bien suivant :\n\n"
        f"  Adresse/ville : {body.adresse}\n"
        f"  Type          : {type_fr}\n"
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
