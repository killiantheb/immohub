from __future__ import annotations

import asyncio
import json
from typing import List, Optional

from app.services.smart_onboarding_service import deep_search, detect_profile_from_speech
from app.core.limiter import rate_limit
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/smart-onboarding", tags=["Smart Onboarding"])


class SpeechInput(BaseModel):
    transcript: str


class ManualInput(BaseModel):
    role: str
    name: str
    website: Optional[str] = None
    uid_number: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialties: Optional[List[str]] = []


SEARCH_MESSAGES = {
    "agency": [
        "Je cherche sur le registre du commerce suisse (zefix.ch)…",
        "Consultation de votre site web et portails immobiliers…",
        "Vérification sur ImmoScout24, Homegate, LinkedIn…",
        "Récupération de vos coordonnées et spécialités…",
        "Finalisation de votre profil agence…",
    ],
    "company": [
        "Je cherche sur zefix.ch…",
        "Consultation de vos avis Google Maps…",
        "Vérification dans les annuaires professionnels…",
        "Récupération de vos certifications…",
        "Finalisation de votre profil artisan…",
    ],
    "owner": [
        "Recherche d'informations publiques…",
        "Consultation des annuaires suisses…",
        "Vérification LinkedIn et profils publics…",
        "Compilation des données trouvées…",
    ],
    "opener": ["Création de votre profil ouvreur…"],
    "tenant": ["Création de votre espace locataire…"],
}


async def _stream_search(role: str, name: str, **kwargs):
    """Générateur SSE — streame les étapes de recherche puis le résultat final."""
    messages = SEARCH_MESSAGES.get(role, SEARCH_MESSAGES["owner"])

    for i, msg in enumerate(messages[:-1]):
        progress = int((i / len(messages)) * 85)
        yield f"data: {json.dumps({'step': 'searching', 'message': msg, 'progress': progress})}\n\n"
        await asyncio.sleep(0.4)

    try:
        result = await deep_search(role, name, **kwargs)
    except Exception as e:
        result = {"confidence_score": 0.1, "notes": f"Erreur recherche : {e}"}

    yield f"data: {json.dumps({'step': 'searching', 'message': messages[-1], 'progress': 95})}\n\n"
    await asyncio.sleep(0.2)

    score = int((result.get("confidence_score", 0)) * 100)
    msg_final = (
        f"J'ai trouvé {score}% des informations. Vérifiez et complétez si besoin."
        if score > 30
        else "Peu d'informations publiques disponibles. Profil de base créé — complétez les détails."
    )
    yield f"data: {json.dumps({'step': 'complete', 'role': role, 'result': result, 'message': msg_final, 'progress': 100})}\n\n"


@router.post("/from-speech")
async def onboard_from_speech(data: SpeechInput, _=rate_limit(5, 60)) -> StreamingResponse:
    """Mode vocal — détecte le profil depuis la parole puis cherche."""

    async def generate():
        yield f"data: {json.dumps({'step': 'detecting', 'message': 'Althy analyse ce que vous avez dit…'})}\n\n"
        await asyncio.sleep(0.1)

        profile = await detect_profile_from_speech(data.transcript)

        if not profile.get("name"):
            yield f"data: {json.dumps({'step': 'need_more', 'message': profile.get('althy_response', 'Pouvez-vous me donner votre nom ?')})}\n\n"
            return

        role = profile.get("role", "owner")
        yield f"data: {json.dumps({'step': 'detected', 'profile': profile, 'message': profile.get('althy_response', 'Compris.')})}\n\n"
        await asyncio.sleep(0.5)

        async for chunk in _stream_search(
            role,
            profile.get("name", ""),
            website=profile.get("website"),
            uid=profile.get("uid_number"),
            location=profile.get("location"),
            email=profile.get("email"),
            phone=profile.get("phone"),
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/from-manual")
async def onboard_from_manual(data: ManualInput, _=rate_limit(5, 60)) -> StreamingResponse:
    """Mode boutons — l'utilisateur a choisi son rôle et rempli le minimum."""

    async def generate():
        yield f"data: {json.dumps({'step': 'searching', 'message': f'Je cherche {data.name} sur le web…', 'progress': 5})}\n\n"
        await asyncio.sleep(0.2)

        async for chunk in _stream_search(
            data.role,
            data.name,
            website=data.website,
            uid=data.uid_number,
            location=data.location,
            email=data.email,
            phone=data.phone,
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Session endpoint (used by /bienvenue?auto=true) ───────────────────────────

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from typing import Annotated

_DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/session/{session_id}")
async def get_onboarding_session(session_id: str, db: _DbDep) -> dict:
    """Récupère les données d'une session d'onboarding (mode auto-invitation)."""
    try:
        row = await db.execute(
            text("""
                SELECT id, role, email, scraped_data, status, created_at
                FROM onboarding_sessions
                WHERE id = :sid
                LIMIT 1
            """),
            {"sid": session_id},
        )
        r = row.one_or_none()
    except Exception:
        raise HTTPException(404, "Session introuvable")

    if not r:
        raise HTTPException(404, "Session introuvable")

    scraped = r.scraped_data or {}
    if isinstance(scraped, str):
        import json as _j
        scraped = _j.loads(scraped)

    return {
        "session_id": str(r.id),
        "role": r.role,
        "email": r.email,
        "status": r.status,
        "scraped_data": scraped,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
