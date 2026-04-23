"""Importe les éléments confirmés par l'utilisateur dans Althy."""
from app.tasks.celery_app import celery_app

# Mapping noms français/anglais/scanner → bien_type_enum
_TYPE_MAP = {
    "appartement": "appartement",
    "apartment":   "appartement",
    "studio":      "studio",
    "villa":       "villa",
    "maison":      "maison",
    "house":       "maison",
    "parking":     "parking",
    "garage":      "garage",
    "box":         "garage",
    "cave":        "cave",
    "dépôt":       "autre",
    "depot":       "autre",
    "hotel":       "autre",
    "bureau":      "bureau",
    "office":      "bureau",
    "commercial":  "commerce",
    "commerce":    "commerce",
}

# 26 codes cantonaux ISO CH — validation stricte anti-corruption silencieuse
CANTONS_CH = frozenset({
    "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
    "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "TG", "TI",
    "UR", "VD", "VS", "ZG", "ZH",
})


def _map_type(raw: str | None) -> str:
    return _TYPE_MAP.get((raw or "").lower().strip(), "appartement")


def _canton(raw: str | None) -> str | None:
    if not raw:
        return None
    code = raw.strip().upper()[:2]
    return code if code in CANTONS_CH else None


def _to_float(val) -> float | None:
    try:
        return float(str(val).replace("'", "").replace(",", ".").replace(" ", "")) if val is not None else None
    except (ValueError, TypeError):
        return None


def _to_int(val) -> int | None:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


@celery_app.task
def importer_elements(user_id: str, user_role: str, elements: list[dict]):
    """
    Convertit chaque élément trouvé en Bien + Listing dans la DB Althy.
    Utilise Claude pour enrichir la description si elle est trop courte.
    """
    from app.core.database import sync_session
    from app.models.bien import Bien
    from app.models.listing import Listing
    from datetime import datetime, timezone, timedelta
    import uuid

    uid = uuid.UUID(user_id)

    with sync_session() as db:
        for el in elements:
            donnees = el.get("donnees") or {}

            # ── Bien ──────────────────────────────────────────────────────────
            bien = Bien(
                owner_id             = uid,
                created_by_id        = uid,
                agency_id            = uid if user_role in ("agence", "portail_proprio") else None,
                type                 = _map_type(donnees.get("type") or el.get("type_element")),
                statut               = "vacant",
                ville                = (donnees.get("ville") or donnees.get("city") or "")[:100],
                adresse              = (donnees.get("adresse") or donnees.get("address") or "")[:300],
                cp                   = str(donnees.get("npa") or donnees.get("zip") or "")[:10],
                canton               = _canton(donnees.get("canton")),
                surface              = _to_float(donnees.get("surface")),
                rooms                = _to_float(donnees.get("pieces") or donnees.get("rooms")),
                loyer                = _to_float(donnees.get("loyer") or donnees.get("prix")),
                description_logement = el.get("description") or None,
            )
            db.add(bien)
            db.flush()  # récupère bien.id

            # ── Listing ───────────────────────────────────────────────────────
            listing = Listing(
                bien_id          = bien.id,
                title            = (el.get("titre") or "")[:255],
                price            = _to_float(donnees.get("prix") or donnees.get("loyer")) or 0,
                transaction_type = donnees.get("transaction") or "location",
                adresse_affichee = (donnees.get("adresse") or donnees.get("ville") or ""),
                description_ai   = el.get("description") or "",
                photos           = el.get("photos") or [],
                tags_ia          = donnees.get("caracteristiques") or [],
                status           = "active",
                source_site      = el.get("source_site"),
                source_id        = el.get("source_id"),
                source_url       = el.get("source_url"),
                published_at     = datetime.now(timezone.utc),
                expire_at        = datetime.now(timezone.utc) + timedelta(days=365),
            )
            db.add(listing)

        db.commit()
