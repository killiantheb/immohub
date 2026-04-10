"""Factures — /api/v1/factures

POST /factures/analyser  : Claude Vision → JSON structuré (montant, date, fournisseur…)
POST /depenses/          : Enregistre une dépense confirmée dans depenses_scannees
GET  /depenses/          : Liste les dépenses de l'utilisateur
"""

from __future__ import annotations

import base64
import json
import uuid as _uuid
from datetime import date
from typing import Annotated

import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import rate_limit
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["factures"])

DbDep  = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

# ── Constantes Vision ─────────────────────────────────────────────────────────

_MODEL   = "claude-sonnet-4-20250514"
_MAX_MB  = 10
_ALLOWED = {
    "image/jpeg":      "image",
    "image/png":       "image",
    "image/webp":      "image",
    "image/gif":       "image",
    "application/pdf": "document",
}

_VISION_PROMPT = """Analyse cette facture ou note de frais. Retourne UNIQUEMENT ce JSON valide
(aucun texte avant ni après) :
{
  "montant": 123.45,
  "date_iso": "YYYY-MM-DD",
  "fournisseur": "Nom du fournisseur",
  "description": "Description courte de la prestation",
  "numero_facture": "Numéro de facture si visible, null sinon",
  "type": "gros_entretien|menu_entretien|autre",
  "affectation": "proprio|locataire"
}

Règles de classification OBLF suisse :
- gros_entretien (à charge du PROPRIO) : toiture, chaudière/chauffage central,
  fenêtres/double vitrage, structure/façade, ascenseur, installation électrique principale,
  conduites principales eau/gaz, rénovation lourde, isolation.
- menu_entretien (à charge du LOCATAIRE) : robinetterie/joints, ampoules/fusibles,
  peinture intérieure légère, nettoyage, serrures/poignées, petites réparations <150 CHF,
  stores intérieurs, filtres VMC.
- autre : tout ce qui n'entre pas clairement dans les catégories ci-dessus
  (assurance, impôts, honoraires, frais administratifs, etc.)

Si une valeur est manquante ou illisible : utilise null (sauf type et affectation qui ont
toujours une valeur par défaut)."""


# ── POST /factures/analyser ───────────────────────────────────────────────────

@router.post("/factures/analyser")
async def analyser_facture(
    current_user: AuthDep,
    fichier: UploadFile = File(...),
    _=rate_limit(20, 60),
) -> dict:
    """Analyse une facture (image ou PDF) via Claude Vision.

    Retourne le JSON structuré extrait. Ne persiste rien —
    c'est l'étape de confirmation qui enregistre via POST /depenses/.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Service IA non configuré")

    # Validate MIME type
    media_type = fichier.content_type or ""
    if media_type not in _ALLOWED:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Format non supporté : {media_type}. Acceptés : JPEG, PNG, WEBP, GIF, PDF",
        )

    # Read + size guard
    contenu = await fichier.read()
    if len(contenu) > _MAX_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Fichier trop volumineux (max {_MAX_MB} Mo)")

    b64 = base64.standard_b64encode(contenu).decode()
    bloc_type = _ALLOWED[media_type]

    # Build Claude content block
    if bloc_type == "image":
        contenu_vision: list = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": b64,
                },
            },
            {"type": "text", "text": _VISION_PROMPT},
        ]
    else:
        # PDF document block
        contenu_vision = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64,
                },
            },
            {"type": "text", "text": _VISION_PROMPT},
        ]

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        message = await client.messages.create(
            model=_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": contenu_vision}],
        )
    except anthropic.APIError as exc:
        raise HTTPException(502, f"Erreur Vision IA : {exc}") from exc

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip().rstrip("```").strip()

    try:
        data = json.loads(raw)
    except Exception as exc:
        raise HTTPException(502, "Réponse IA non analysable — réessayez") from exc

    # Sanitize
    return {
        "montant":         _safe_float(data.get("montant")),
        "date_iso":        _safe_date(data.get("date_iso")),
        "fournisseur":     str(data.get("fournisseur") or "")[:300] or None,
        "description":     str(data.get("description") or "")[:500] or None,
        "numero_facture":  str(data.get("numero_facture") or "")[:100] or None,
        "type":            _safe_enum(data.get("type"), {"gros_entretien", "menu_entretien", "autre"}, "autre"),
        "affectation":     _safe_enum(data.get("affectation"), {"proprio", "locataire"}, "proprio"),
    }


# ── POST /depenses/ ───────────────────────────────────────────────────────────

class DepenseCreate(BaseModel):
    bien_id:        str | None = None
    montant:        float | None = None
    date_facture:   str | None = None   # YYYY-MM-DD
    fournisseur:    str | None = None
    description:    str | None = None
    numero_facture: str | None = None
    type_entretien: str | None = None   # gros_entretien | menu_entretien | autre
    affectation:    str | None = None   # proprio | locataire
    url_fichier:    str | None = None
    media_type:     str | None = None


@router.post("/depenses/", status_code=status.HTTP_201_CREATED)
async def creer_depense(
    payload: DepenseCreate,
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Enregistre une dépense scannée confirmée dans depenses_scannees."""
    bien_uuid: _uuid.UUID | None = None
    if payload.bien_id:
        try:
            bien_uuid = _uuid.UUID(payload.bien_id)
        except ValueError:
            raise HTTPException(422, "bien_id invalide")

    date_val: date | None = None
    if payload.date_facture:
        try:
            date_val = date.fromisoformat(payload.date_facture)
        except ValueError:
            pass

    depense_id = _uuid.uuid4()
    try:
        await db.execute(
            text("""
                INSERT INTO depenses_scannees
                    (id, owner_id, bien_id, montant, date_facture,
                     fournisseur, description, numero_facture,
                     type_entretien, affectation,
                     url_fichier_source, media_type,
                     statut, confirme_par_user)
                VALUES
                    (:id, :owner, :bien, :montant, :date,
                     :fournisseur, :description, :num_facture,
                     :type_entretien, :affectation,
                     :url, :media,
                     'confirme', TRUE)
            """),
            {
                "id":            depense_id,
                "owner":         current_user.id,
                "bien":          bien_uuid,
                "montant":       payload.montant,
                "date":          date_val,
                "fournisseur":   payload.fournisseur,
                "description":   payload.description,
                "num_facture":   payload.numero_facture,
                "type_entretien":payload.type_entretien,
                "affectation":   payload.affectation,
                "url":           payload.url_fichier,
                "media":         payload.media_type,
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f"Erreur lors de l'enregistrement : {exc}") from exc

    return {
        "id":           str(depense_id),
        "ok":           True,
        "message":      "Dépense enregistrée avec succès",
    }


# ── GET /depenses/ ────────────────────────────────────────────────────────────

@router.get("/depenses/")
async def lister_depenses(
    current_user: AuthDep,
    db: DbDep,
    bien_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Retourne les dépenses de l'utilisateur (optionnellement filtrées par bien)."""
    filters = "WHERE d.owner_id = :uid AND d.is_active = TRUE"
    params: dict = {"uid": current_user.id, "limit": limit}

    bien_uuid: _uuid.UUID | None = None
    if bien_id:
        try:
            bien_uuid = _uuid.UUID(bien_id)
            filters += " AND d.bien_id = :bien_id"
            params["bien_id"] = bien_uuid
        except ValueError:
            pass

    try:
        rows = await db.execute(
            text(f"""
                SELECT d.id, d.bien_id, d.montant, d.date_facture,
                       d.fournisseur, d.description, d.numero_facture,
                       d.type_entretien, d.affectation, d.statut,
                       d.created_at, b.adresse AS bien_adresse
                FROM depenses_scannees d
                LEFT JOIN biens b ON b.id = d.bien_id
                {filters}
                ORDER BY d.created_at DESC
                LIMIT :limit
            """),
            params,
        )
        return [
            {
                "id":            str(r.id),
                "bien_id":       str(r.bien_id) if r.bien_id else None,
                "bien_adresse":  r.bien_adresse,
                "montant":       float(r.montant) if r.montant else None,
                "date_facture":  r.date_facture.isoformat() if r.date_facture else None,
                "fournisseur":   r.fournisseur,
                "description":   r.description,
                "numero_facture":r.numero_facture,
                "type_entretien":r.type_entretien,
                "affectation":   r.affectation,
                "statut":        r.statut,
                "created_at":    r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    except Exception:
        return []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val: object) -> float | None:
    try:
        return float(val)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _safe_date(val: object) -> str | None:
    if not val:
        return None
    try:
        date.fromisoformat(str(val))
        return str(val)
    except ValueError:
        return None


def _safe_enum(val: object, allowed: set[str], default: str) -> str:
    return str(val) if str(val) in allowed else default
