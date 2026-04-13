"""Importe les éléments confirmés par l'utilisateur dans Althy."""
from app.tasks.celery_app import celery_app

# Mapping noms français/scanner → property_type_enum
_TYPE_MAP = {
    "appartement": "apartment",
    "apartment":   "apartment",
    "villa":       "villa",
    "maison":      "villa",
    "house":       "villa",
    "parking":     "parking",
    "garage":      "garage",
    "box":         "box",
    "cave":        "cave",
    "dépôt":       "depot",
    "depot":       "depot",
    "bureau":      "office",
    "office":      "office",
    "commercial":  "commercial",
    "hotel":       "hotel",
}


def _map_type(raw: str | None) -> str:
    return _TYPE_MAP.get((raw or "").lower().strip(), "apartment")


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
    Convertit chaque élément trouvé en Property + Listing dans la DB Althy.
    Utilise Claude pour enrichir la description si elle est trop courte.
    """
    from app.core.database import sync_session
    from app.models.property import Property
    from app.models.listing import Listing
    from datetime import datetime, timezone, timedelta
    import uuid

    uid = uuid.UUID(user_id)

    with sync_session() as db:
        for el in elements:
            donnees = el.get("donnees") or {}

            # ── Property ──────────────────────────────────────────────────────
            prop = Property(
                owner_id       = uid,
                created_by_id  = uid,
                agency_id      = uid if user_role in ("agence", "portail_proprio") else None,
                type           = _map_type(donnees.get("type") or el.get("type_element")),
                status         = "available",
                city           = (donnees.get("ville") or donnees.get("city") or "")[:100],
                address        = (donnees.get("adresse") or donnees.get("address") or "")[:500],
                zip_code       = str(donnees.get("npa") or donnees.get("zip") or "")[:10],
                surface        = _to_float(donnees.get("surface")),
                rooms          = _to_int(donnees.get("pieces") or donnees.get("rooms")),
                monthly_rent   = _to_float(donnees.get("loyer") or donnees.get("prix")),
                description    = el.get("description") or "",
            )
            db.add(prop)
            db.flush()  # récupère prop.id

            # ── Listing ───────────────────────────────────────────────────────
            listing = Listing(
                property_id      = prop.id,
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
