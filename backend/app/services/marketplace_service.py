"""Marketplace — logique métier, helpers et sérialisation.

Extrait de marketplace.py pour garder le router < 600 lignes.
"""
from __future__ import annotations

import mimetypes
import uuid
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

import httpx
from app.core.config import settings
from app.models.candidature import Candidature
from app.models.listing import Listing
from app.models.property import Property
from app.models.user import User
from fastapi import HTTPException
from sqlalchemy import select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from fastapi import UploadFile

# ── Constantes ────────────────────────────────────────────────────────────────

_CANDIDATURE_BUCKET = "candidatures"
MAX_CANDIDATURE_FILES = 5
MAX_CANDIDATURE_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

TYPE_LABEL: dict[str, str] = {
    "apartment": "Appartement",
    "villa":     "Villa",
    "parking":   "Parking",
    "garage":    "Garage",
    "box":       "Box",
    "cave":      "Cave",
    "depot":     "Dépôt",
    "office":    "Bureau",
    "commercial":"Commercial",
    "hotel":     "Hôtel",
}


# ── Helpers upload ────────────────────────────────────────────────────────────

async def upload_to_supabase(data: bytes, path: str, content_type: str) -> str:
    """Upload un fichier vers Supabase Storage. Retourne l'URL publique."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{_CANDIDATURE_BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, content=data, headers=headers)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Supabase Storage error {resp.status_code}: {resp.text}")
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{_CANDIDATURE_BUCKET}/{path}"


# ── Sérialisation ─────────────────────────────────────────────────────────────

def statut_listing(listing: Listing, prop: Property) -> str:
    if listing.transaction_type == "vente":
        return "À vendre"
    if prop.status == "rented":
        return "Loué"
    return "À louer"


def serialize_listing(listing: Listing, prop: Property) -> dict:
    photos   = listing.photos if isinstance(listing.photos, list) else []
    tags     = listing.tags_ia if isinstance(listing.tags_ia, list) else []
    prix_val = float(listing.price) if listing.price else (
        float(prop.monthly_rent) if prop.monthly_rent else None
    )
    return {
        "id":                str(listing.id),
        "titre":             listing.title or f"{TYPE_LABEL.get(prop.type, prop.type)} à {prop.city}",
        "description":       listing.description_ai,
        "transaction_type":  listing.transaction_type,
        "prix":              prix_val,
        "charges":           float(prop.charges)  if prop.charges  else None,
        "caution":           float(prop.deposit)  if prop.deposit  else None,
        "adresse_affichee":  listing.adresse_affichee or prop.city,
        "ville":             prop.city,
        "code_postal":       prop.zip_code,
        "canton":            prop.canton,
        # Coordonnées arrondies à 3 décimales (~111 m) — vie privée
        "lat":               round(float(listing.lat), 3) if listing.lat else None,
        "lng":               round(float(listing.lng), 3) if listing.lng else None,
        "surface":           prop.surface,
        "pieces":            prop.rooms,
        "chambres":          prop.bedrooms,
        "sdb":               prop.bathrooms,
        "etage":             prop.floor,
        "type":              prop.type,
        "type_label":        TYPE_LABEL.get(prop.type, prop.type),
        "is_furnished":      prop.is_furnished,
        "has_parking":       prop.has_parking,
        "has_balcony":       prop.has_balcony,
        "has_terrace":       prop.has_terrace,
        "has_garden":        prop.has_garden,
        "pets_allowed":      prop.pets_allowed,
        "photos":            photos,
        "cover":             photos[0] if photos else None,
        "tags_ia":           tags,
        "is_premium":        listing.is_premium,
        "ai_score":          float(listing.ai_score) if listing.ai_score else None,
        "vues":              listing.views,
        "contacts_count":    listing.contacts_count,
        "published_at":      listing.published_at.isoformat() if listing.published_at else None,
        "statut":            statut_listing(listing, prop),
        "periode":           "/mois" if listing.transaction_type != "vente" else "",
        "created_at":        prop.created_at.isoformat(),
    }


def serialize_candidature(c: Candidature, applicant: User | None = None) -> dict:
    out: dict = {
        "id":                str(c.id),
        "listing_id":        str(c.listing_id),
        "user_id":           str(c.user_id),
        "statut":            c.statut,
        "documents":         c.documents if isinstance(c.documents, list) else [],
        "message":           c.message,
        "score_ia":          c.score_ia,
        "score_details":     c.score_details,
        "frais_payes":       c.frais_payes,
        "visite_proposee_at": c.visite_proposee_at.isoformat() if c.visite_proposee_at else None,
        "ouvreur_id":        str(c.ouvreur_id) if c.ouvreur_id else None,
        "created_at":        c.created_at.isoformat() if c.created_at else None,
        "updated_at":        c.updated_at.isoformat() if c.updated_at else None,
    }
    if applicant:
        out["candidat"] = {
            "id":     str(applicant.id),
            "email":  applicant.email,
            "prenom": applicant.first_name,
            "nom":    applicant.last_name,
        }
    return out


# ── Ownership helper ──────────────────────────────────────────────────────────

async def get_owned_listing(listing_id: uuid.UUID, user: User, db: AsyncSession) -> Listing:
    """Retourne le listing si l'utilisateur en est propriétaire, 404 sinon."""
    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(
                Listing.id == listing_id,
                Listing.is_active == True,
                Property.owner_id == user.id,
            )
        )
    ).first()
    if not row:
        raise HTTPException(404, "Listing introuvable ou non autorisé")
    return row[0]


# ── Scoring IA (candidature) ──────────────────────────────────────────────────

async def score_candidature_ia(
    user: User,
    listing: Listing,
    prop: Property,
    docs: list[dict],
    db: AsyncSession,
    message: str = "",
) -> tuple[int | None, dict | None]:
    """
    Score IA non-bloquant d'une candidature locataire.
    Retourne (score_ia, score_details) ou (None, None) en cas d'erreur.
    """
    from app.services.ai_service import score_tenant_application
    try:
        tenant_data = {
            "prenom":            user.first_name,
            "listing_titre":     listing.title or f"Bien à {prop.city}",
            "ville":             prop.city,
            "loyer_demande":     float(listing.price or prop.monthly_rent or 0),
            "documents_fournis": [d["type"] for d in docs],
            "nb_fiches_salaire": sum(1 for d in docs if d["type"] == "fiche_salaire"),
            "a_cni":             any(d["type"] == "cni" for d in docs),
            "a_references":      any(d["type"] == "reference" for d in docs),
            "message":           message,
        }
        result = await score_tenant_application(tenant_data, db, str(user.id))
        return int(result.score), {
            "recommendation": result.recommendation,
            "risk_flags":     result.risk_flags,
            "summary":        result.summary,
        }
    except Exception:
        return None, None


# ── Publication d'un bien (logique métier) ────────────────────────────────────

async def publier_bien_service(body: "PublierRequest", user: User, db: AsyncSession) -> Listing:  # type: ignore[name-defined]
    """
    Crée ou met à jour un Listing sur la marketplace.
    - Si body.property_id fourni → upsert sur le bien existant (vérifie l'ownership).
    - Sinon → crée un nouveau Property + Listing.
    Génère la description IA si absente.
    """
    from app.services.geocoding import geocode  # import tardif pour éviter les dépendances circulaires
    from app.services.ai_service import generate_listing_description

    now        = datetime.now(timezone.utc)
    expire_at  = now + timedelta(days=30)

    if body.property_id:
        # ── Mode upsert : bien existant ───────────────────────────────────────
        prop = (
            await db.execute(
                select(Property).where(
                    Property.id == body.property_id,
                    Property.is_active == True,
                )
            )
        ).scalar_one_or_none()
        if not prop:
            raise HTTPException(404, "Bien introuvable")
        if prop.owner_id != user.id and prop.agency_id != user.id and user.role != "super_admin":
            raise HTTPException(403, "Ce bien ne vous appartient pas")

        titre = body.titre or f"{TYPE_LABEL.get(body.type, prop.type)} à {prop.city}"

        existing = (
            await db.execute(select(Listing).where(Listing.property_id == body.property_id))
        ).scalar_one_or_none()

        if existing:
            existing.title            = titre
            existing.price            = body.prix
            existing.transaction_type = body.transaction_type
            existing.adresse_affichee = body.adresse_affichee or prop.city
            if body.photos:
                existing.photos = body.photos
            if body.tags_ia:
                existing.tags_ia = body.tags_ia
            if body.description:
                existing.description_ai = body.description
            existing.status       = "active"
            existing.published_at = now
            existing.expire_at    = expire_at
            await db.commit()
            await db.refresh(existing)
            listing = existing
        else:
            listing = Listing(
                property_id=prop.id, title=titre,
                description_ai=body.description, price=body.prix,
                status="active", transaction_type=body.transaction_type,
                lat=prop.lat if hasattr(prop, "lat") else None,
                lng=prop.lng if hasattr(prop, "lng") else None,
                adresse_affichee=body.adresse_affichee or prop.city,
                photos=body.photos, tags_ia=body.tags_ia,
                is_premium=False, published_at=now, expire_at=expire_at,
            )
            db.add(listing)
            await db.commit()
            await db.refresh(listing)
    else:
        # ── Mode création : nouveau bien ──────────────────────────────────────
        prop = Property(
            owner_id=user.id, created_by_id=user.id,
            type=body.type, status="available",
            address=body.adresse, city=body.ville,
            zip_code=body.code_postal, country="CH",
            surface=body.surface, rooms=body.pieces,
            monthly_rent=body.prix if body.transaction_type in ("location", "colocation") else None,
            charges=body.charges, deposit=body.caution,
            price_sale=body.prix if body.transaction_type == "vente" else None,
            is_furnished=body.is_furnished, has_parking=body.has_parking,
            has_balcony=body.has_balcony, has_terrace=body.has_terrace,
            has_garden=body.has_garden, pets_allowed=body.pets_allowed,
            canton=body.canton,
        )
        db.add(prop)
        await db.flush()

        lat, lng = None, None
        try:
            coords = await geocode(body.adresse, body.ville, body.code_postal)
            if coords:
                lat, lng = coords
        except Exception:
            pass

        titre = body.titre or f"{TYPE_LABEL.get(body.type, body.type)} à {body.ville}"
        listing = Listing(
            property_id=prop.id, title=titre,
            description_ai=body.description, price=body.prix,
            status="active", transaction_type=body.transaction_type,
            lat=lat, lng=lng,
            adresse_affichee=body.adresse_affichee or body.ville,
            photos=body.photos, tags_ia=body.tags_ia,
            is_premium=False, published_at=now, expire_at=expire_at,
        )
        db.add(listing)
        await db.commit()
        await db.refresh(listing)

    # ── Description IA (non bloquant) ─────────────────────────────────────────
    if not listing.description_ai:
        try:
            listing.description_ai = await generate_listing_description(prop, db, str(user.id))
            await db.commit()
        except Exception:
            pass

    return listing


# ── Dépôt de candidature avec upload fichiers ─────────────────────────────────

async def upload_candidature_files(
    documents: list["UploadFile"],
    user_id: uuid.UUID,
    listing_id: uuid.UUID,
) -> list[dict]:
    """
    Upload les fichiers vers Supabase Storage.
    Retourne la liste [{type, url, nom}] utilisable comme `documents` d'une Candidature.
    Lève HTTPException si un fichier dépasse la limite.
    """
    uploaded: list[dict] = []
    for f in documents:
        content = await f.read()
        if len(content) > MAX_CANDIDATURE_FILE_BYTES:
            raise HTTPException(413, f"Le fichier {f.filename} dépasse 10 MB")
        ext  = (f.filename or "").rsplit(".", 1)[-1].lower()
        path = f"{user_id}/{listing_id}/{uuid.uuid4()}.{ext}"
        ct   = f.content_type or mimetypes.guess_type(f.filename or "")[0] or "application/octet-stream"
        try:
            public_url = await upload_to_supabase(content, path, ct)
        except RuntimeError as exc:
            raise HTTPException(502, f"Erreur upload fichier : {exc}")

        fname_lower = (f.filename or "").lower()
        doc_type = "autre"
        if "cni" in fname_lower or "identite" in fname_lower or "passeport" in fname_lower:
            doc_type = "cni"
        elif "salaire" in fname_lower or "salary" in fname_lower:
            doc_type = "fiche_salaire"
        elif "reference" in fname_lower or "ref" in fname_lower:
            doc_type = "reference"
        uploaded.append({"type": doc_type, "url": public_url, "nom": f.filename or path})

    return uploaded


async def notify_owner_new_candidature(
    owner_id: uuid.UUID,
    candidat_label: str,
    listing_title: str,
    property_id: uuid.UUID,
    score_ia: int | None,
    db: AsyncSession,
) -> None:
    """Insère une notification 'nouvelle_candidature' pour le propriétaire."""
    score_label = f" (score IA : {score_ia}/100)" if score_ia is not None else ""
    await db.execute(
        sa_text("""
            INSERT INTO notifications
                (user_id, type, titre, message, lien, created_at, updated_at)
            VALUES
                (:uid, 'nouvelle_candidature', 'Nouvelle candidature', :msg, :lien, now(), now())
        """),
        {
            "uid":  str(owner_id),
            "msg":  f"{candidat_label} a déposé un dossier pour « {listing_title} »{score_label}.",
            "lien": f"/app/biens/{property_id}/locataire",
        },
    )
