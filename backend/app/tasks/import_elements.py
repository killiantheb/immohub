"""Tâche Celery : import des éléments validés lors de l'onboarding."""
from app.tasks.celery_app import celery_app

# Mapping type_element (scanner) → property_type_enum (DB)
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
    if not raw:
        return "apartment"
    return _TYPE_MAP.get(raw.lower().strip(), "apartment")


@celery_app.task(bind=True, max_retries=2, time_limit=300)
def importer_elements(self, user_id: str, user_role: str, elements: list[dict]):
    """
    Importe les éléments confirmés par l'utilisateur après le scan onboarding.
    Crée une Property + Listing par élément.
    Les doublons sont ignorés via ON CONFLICT sur (source_site, source_id).
    """
    import json
    from app.core.database import sync_session
    from sqlalchemy import text

    if not elements:
        return {"status": "done", "nb": 0}

    try:
        with sync_session() as db:
            imported = 0
            for el in elements:
                donnees = el.get("donnees") or {}

                # ── 1. Upsert property ────────────────────────────────────────
                prop_row = db.execute(
                    text("""
                        INSERT INTO properties
                            (owner_id, created_by_id, type, status,
                             address, city, zip_code,
                             description, rooms, surface, monthly_rent)
                        VALUES
                            (:owner_id, :owner_id, :type, 'available',
                             :address, :city, :zip_code,
                             :description, :rooms, :surface, :monthly_rent)
                        RETURNING id
                    """),
                    {
                        "owner_id":     user_id,
                        "type":         _map_type(el.get("type_element")),
                        "address":      (donnees.get("adresse") or donnees.get("address") or "")[:500],
                        "city":         (donnees.get("ville") or donnees.get("city") or "")[:100],
                        "zip_code":     str(donnees.get("npa") or donnees.get("zip") or "")[:10],
                        "description":  el.get("description") or "",
                        "rooms":        _to_int(donnees.get("pieces") or donnees.get("rooms")),
                        "surface":      _to_float(donnees.get("surface")),
                        "monthly_rent": _to_float(donnees.get("loyer") or donnees.get("prix")),
                    },
                ).fetchone()

                if not prop_row:
                    continue

                prop_id = prop_row[0]

                # ── 2. Insert listing with source tracing ─────────────────────
                listing_inserted = db.execute(
                    text("""
                        INSERT INTO listings
                            (property_id, title, status,
                             photos, source_site, source_id, source_url)
                        VALUES
                            (:property_id, :title, 'draft',
                             :photos, :source_site, :source_id, :source_url)
                        ON CONFLICT (property_id) DO NOTHING
                        RETURNING id
                    """),
                    {
                        "property_id": str(prop_id),
                        "title":       (el.get("titre") or "")[:255],
                        "photos":      json.dumps(el.get("photos") or [], ensure_ascii=False),
                        "source_site": el.get("source_site"),
                        "source_id":   el.get("source_id"),
                        "source_url":  el.get("source_url"),
                    },
                ).fetchone()

                if listing_inserted:
                    imported += 1

        return {"status": "done", "nb": imported}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


def _to_int(val) -> int | None:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _to_float(val) -> float | None:
    try:
        return float(str(val).replace("'", "").replace(",", ".").replace(" ", "")) if val is not None else None
    except (ValueError, TypeError):
        return None
