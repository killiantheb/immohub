"""Sphere Carte — /api/v1/sphere/carte

Parse une requête en langage naturel (ville, type de bien, budget, pièces)
via Claude Haiku et retourne coordonnées + filtres structurés.
Endpoint léger et rapide — pas de contexte utilisateur requis.
"""

from __future__ import annotations

import json
from typing import Any

import anthropic
from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Annotated

router = APIRouter(prefix="/sphere/carte", tags=["sphere-carte"])

AuthDep = Annotated[User, Depends(get_current_user)]

# ── Villes connues ────────────────────────────────────────────────────────────

VILLES: dict[str, dict[str, float]] = {
    "Genève":    {"lng": 6.143,  "lat": 46.204},
    "Lausanne":  {"lng": 6.632,  "lat": 46.519},
    "Fribourg":  {"lng": 7.161,  "lat": 46.806},
    "Neuchâtel": {"lng": 6.931,  "lat": 46.992},
    "Sion":      {"lng": 7.359,  "lat": 46.233},
    "Nyon":      {"lng": 6.239,  "lat": 46.383},
    "Montreux":  {"lng": 6.911,  "lat": 46.433},
    "Morges":    {"lng": 6.499,  "lat": 46.512},
    "Vevey":     {"lng": 6.844,  "lat": 46.461},
    "Yverdon":   {"lng": 6.641,  "lat": 46.778},
    "Verbier":   {"lng": 7.225,  "lat": 46.097},
    "Berne":     {"lng": 7.447,  "lat": 46.948},
    "Zürich":    {"lng": 8.541,  "lat": 47.376},
    "Bâle":      {"lng": 7.589,  "lat": 47.560},
    "Lugano":    {"lng": 8.951,  "lat": 46.004},
    "Lucerne":   {"lng": 8.307,  "lat": 47.050},
    "Valais":    {"lng": 7.500,  "lat": 46.200},
    "Vaud":      {"lng": 6.700,  "lat": 46.600},
    "Jura":      {"lng": 7.200,  "lat": 47.340},
}

# ── Prompt système ────────────────────────────────────────────────────────────

_SYSTEM = """Tu es un parser de recherches immobilières pour Althy (Suisse romande).

Analyse la requête et extrais ces champs au format JSON strict.
Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour.

{
  "ville": "Ville suisse la plus pertinente (string, obligatoire)",
  "type_bien": "studio|appartement|maison|villa|chalet|local|terrain ou null",
  "budget_max": nombre_CHF_ou_null,
  "nb_pieces": nombre_entier_ou_null,
  "type_transaction": "location|vente|saisonnier ou null"
}

Règles :
- Ville par défaut si non précisée : "Genève"
- Villes disponibles : Genève, Lausanne, Fribourg, Neuchâtel, Sion, Nyon, Montreux, Morges, Vevey, Yverdon, Verbier, Berne, Zürich, Bâle, Lugano, Lucerne, Valais, Vaud, Jura
- "studio" → nb_pieces=1, type_bien="studio"
- "2 pièces" / "T2" / "F2" → nb_pieces=2
- Budget en CHF : mensuel si location, total si vente
- "moins de 2000" → budget_max=2000
- Si ville inconnue, choisir la ville de la liste la plus proche géographiquement"""


# ── Schémas ───────────────────────────────────────────────────────────────────

class ParseLocationRequest(BaseModel):
    query: str


class ParseLocationResponse(BaseModel):
    ville: str
    lng: float
    lat: float
    filtres: dict[str, Any]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/parse-location", response_model=ParseLocationResponse)
async def parse_location(
    body: ParseLocationRequest,
    _user: AuthDep,
) -> ParseLocationResponse:
    """
    Parse une requête en langage naturel et retourne :
    - La ville identifiée + ses coordonnées GPS
    - Les filtres extraits (type_bien, budget_max, nb_pieces, type_transaction)

    Utilise Claude Haiku pour la rapidité.
    Fallback sur Genève si la ville n'est pas reconnue.
    """
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Requête vide")

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Service IA non configuré")

    # ── Appel Claude Haiku ────────────────────────────────────────────────────
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            temperature=0,
            system=_SYSTEM,
            messages=[{"role": "user", "content": query}],
        )
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur Claude : {exc.status_code}") from exc
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail="Service IA temporairement indisponible") from exc

    raw = msg.content[0].text.strip()

    # Strip markdown fences si présents
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

    # ── Parse JSON ────────────────────────────────────────────────────────────
    try:
        parsed: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        # Claude a peut-être ajouté du texte — tentative d'extraction
        import re
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group())
            except json.JSONDecodeError:
                parsed = {}
        else:
            parsed = {}

    # ── Résolution de la ville ────────────────────────────────────────────────
    ville_raw: str = (parsed.get("ville") or "Genève").strip()
    coords = VILLES.get(ville_raw)

    if not coords:
        # Recherche partielle insensible à la casse
        ville_low = ville_raw.lower()
        for v_name, v_coords in VILLES.items():
            if ville_low in v_name.lower() or v_name.lower() in ville_low:
                ville_raw = v_name
                coords = v_coords
                break

    if not coords:
        ville_raw = "Genève"
        coords = VILLES["Genève"]

    # ── Filtres (champs non nuls) ─────────────────────────────────────────────
    filtres: dict[str, Any] = {
        k: v
        for k, v in {
            "type_bien":        parsed.get("type_bien"),
            "budget_max":       parsed.get("budget_max"),
            "nb_pieces":        parsed.get("nb_pieces"),
            "type_transaction": parsed.get("type_transaction"),
        }.items()
        if v is not None
    }

    return ParseLocationResponse(
        ville=ville_raw,
        lng=coords["lng"],
        lat=coords["lat"],
        filtres=filtres,
    )
