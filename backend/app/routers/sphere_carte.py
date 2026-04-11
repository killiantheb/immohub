"""Sphere parse-location — POST /api/v1/sphere/parse-location

Parse une requête en langage naturel (ville, type de bien, budget, pièces)
via Claude Sonnet et retourne coordonnées + filtres structurés.
Endpoint léger et rapide — pas de contexte utilisateur requis.
"""

from __future__ import annotations

import json
import re
from typing import Any

import anthropic
from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Annotated

router = APIRouter(prefix="/sphere", tags=["sphere-carte"])

AuthDep = Annotated[User, Depends(get_current_user)]

# ── Fallback local ────────────────────────────────────────────────────────────

CITY_FALLBACK: dict[str, tuple[float, float]] = {
    "genève":    (6.143, 46.204),
    "lausanne":  (6.632, 46.519),
    "fribourg":  (7.161, 46.806),
    "neuchâtel": (6.931, 46.992),
    "sion":      (7.359, 46.233),
    "nyon":      (6.239, 46.383),
    "montreux":  (6.911, 46.433),
    "yverdon":   (6.641, 46.778),
    # Villes supplémentaires
    "morges":    (6.499, 46.512),
    "vevey":     (6.844, 46.461),
    "verbier":   (7.225, 46.097),
    "berne":     (7.447, 46.948),
    "zürich":    (8.541, 47.376),
    "zurich":    (8.541, 47.376),
    "bâle":      (7.589, 47.560),
    "bale":      (7.589, 47.560),
    "lugano":    (8.951, 46.004),
    "lucerne":   (8.307, 47.050),
    "valais":    (7.500, 46.200),
    "vaud":      (6.700, 46.600),
    "jura":      (7.200, 47.340),
}

# Mapping minuscules → nom affiché avec casse correcte
_CITY_DISPLAY: dict[str, str] = {
    "genève": "Genève", "lausanne": "Lausanne", "fribourg": "Fribourg",
    "neuchâtel": "Neuchâtel", "sion": "Sion", "nyon": "Nyon",
    "montreux": "Montreux", "yverdon": "Yverdon", "morges": "Morges",
    "vevey": "Vevey", "verbier": "Verbier", "berne": "Berne",
    "zürich": "Zürich", "zurich": "Zürich", "bâle": "Bâle", "bale": "Bâle",
    "lugano": "Lugano", "lucerne": "Lucerne", "valais": "Valais",
    "vaud": "Vaud", "jura": "Jura",
}

# ── Prompt système ────────────────────────────────────────────────────────────

_SYSTEM = (
    "Tu es un assistant qui extrait des informations de recherche immobilière.\n"
    "Retourne UNIQUEMENT un JSON valide avec : ville (str), lng (float), lat (float),\n"
    "filtres { type_bien, budget_max, nb_pieces, type_transaction }.\n"
    "Si la ville n'est pas en Suisse romande, retourne Genève par défaut.\n\n"
    "Règles supplémentaires :\n"
    "- Ville par défaut si non précisée : \"Genève\"\n"
    "- Villes disponibles : Genève, Lausanne, Fribourg, Neuchâtel, Sion, Nyon, "
    "Montreux, Morges, Vevey, Yverdon, Verbier, Berne, Zürich, Bâle, Lugano, Lucerne\n"
    "- type_bien : studio|appartement|maison|villa|chalet|local|terrain ou null\n"
    "- type_transaction : location|vente|saisonnier ou null\n"
    "- \"studio\" → nb_pieces=1, type_bien=\"studio\"\n"
    "- \"2 pièces\" / \"T2\" / \"F2\" → nb_pieces=2\n"
    "- Budget en CHF : mensuel si location, total si vente\n"
    "- \"sous CHF 2000\" → budget_max=2000\n"
    "- Pour lng/lat, utilise les coordonnées réelles de la ville identifiée.\n"
    "- Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour."
)


# ── Schémas ───────────────────────────────────────────────────────────────────

class ParseLocationRequest(BaseModel):
    query: str


class ParseLocationResponse(BaseModel):
    ville: str
    lng: float
    lat: float
    filtres: dict[str, Any]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_city(ville_raw: str) -> tuple[str, float, float]:
    """Résout un nom de ville → (nom affiché, lng, lat).
    Priorité : correspondance exacte → partielle → fallback Genève.
    """
    key = ville_raw.strip().lower()

    # Correspondance exacte (insensible à la casse)
    if key in CITY_FALLBACK:
        lng, lat = CITY_FALLBACK[key]
        return _CITY_DISPLAY.get(key, ville_raw.title()), lng, lat

    # Correspondance partielle
    for city_key, coords in CITY_FALLBACK.items():
        if key in city_key or city_key in key:
            lng, lat = coords
            return _CITY_DISPLAY.get(city_key, city_key.title()), lng, lat

    # Fallback Genève
    lng, lat = CITY_FALLBACK["genève"]
    return "Genève", lng, lat


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

    Utilise Claude Sonnet. Fallback local sur CITY_FALLBACK si Claude échoue.
    """
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Requête vide")

    parsed: dict[str, Any] = {}

    # ── Appel Claude Sonnet ───────────────────────────────────────────────────
    if settings.ANTHROPIC_API_KEY:
        try:
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=256,
                temperature=0,
                system=_SYSTEM,
                messages=[{"role": "user", "content": query}],
            )
            raw = msg.content[0].text.strip()

            # Strip markdown fences si présents
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", raw, re.DOTALL)
                if m:
                    try:
                        parsed = json.loads(m.group())
                    except json.JSONDecodeError:
                        parsed = {}

        except (anthropic.APIStatusError, anthropic.APIError):
            parsed = {}
    # Si pas de clé API ou échec → parsed reste {} → fallback local ci-dessous

    # ── Résolution ville (Claude ou fallback local) ───────────────────────────
    ville_raw: str = (parsed.get("ville") or "Genève").strip()

    # Si Claude a fourni lng/lat directement et que la ville est reconnue,
    # on peut utiliser ses coordonnées ; sinon on utilise CITY_FALLBACK.
    ville_display, lng, lat = _resolve_city(ville_raw)

    # Préférer les coordonnées du fallback local (fiables) sur celles de Claude
    # sauf si la ville n'est pas dans notre dictionnaire (ville inconnue)
    claude_lng = parsed.get("lng")
    claude_lat = parsed.get("lat")
    if claude_lng is None or claude_lat is None:
        # Claude n'a pas retourné de coords → on garde celles du fallback
        pass
    elif ville_display == "Genève" and ville_raw.lower() not in ("genève", "geneve", "geneva"):
        # Fallback forcé sur Genève car ville non reconnue : on garde nos coords
        pass
    # Sinon on garde CITY_FALLBACK qui est plus précis

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

    # Extraire depuis filtres imbriqués si Claude a mis un sous-objet "filtres"
    if not filtres and isinstance(parsed.get("filtres"), dict):
        filtres = {k: v for k, v in parsed["filtres"].items() if v is not None}

    return ParseLocationResponse(
        ville=ville_display,
        lng=lng,
        lat=lat,
        filtres=filtres,
    )
