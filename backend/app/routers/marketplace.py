"""Marketplace — /api/v1/marketplace

Routes publiques (aucune auth) :  GET /biens  GET /carte  GET /{id}
Routes authentifiées :            POST /publier  PATCH /{id}  DELETE /{id}
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

import mimetypes

import httpx
from app.core.config import settings
from app.core.database import get_db
from app.core.security import ROLES_PROPERTY_MANAGERS, get_current_user, get_optional_current_user
from app.models.candidature import Candidature
from app.models.interest import Interest
from app.models.listing import Listing
from app.models.property import Property
from app.models.user import User
from app.services.ai_service import generate_listing_description, score_tenant_application
from app.core.rate_limit import limiter
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

_CANDIDATURE_BUCKET = "candidatures"
_MAX_FILES = 5
_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


async def _upload_to_supabase(data: bytes, path: str, content_type: str) -> str:
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

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]
OptUserDep = Annotated[User | None, Depends(get_optional_current_user)]

_TYPE_LABEL: dict[str, str] = {
    "apartment": "Appartement",
    "villa": "Villa",
    "parking": "Parking",
    "garage": "Garage",
    "box": "Box",
    "cave": "Cave",
    "depot": "Dépôt",
    "office": "Bureau",
    "commercial": "Commercial",
    "hotel": "Hôtel",
}


def _serialize(listing: Listing, prop: Property) -> dict:
    photos = listing.photos if isinstance(listing.photos, list) else []
    tags = listing.tags_ia if isinstance(listing.tags_ia, list) else []
    return {
        "id": str(listing.id),
        "titre": listing.title or f"{_TYPE_LABEL.get(prop.type, prop.type)} à {prop.city}",
        "description": listing.description_ai,
        "transaction_type": listing.transaction_type,
        "prix": float(listing.price) if listing.price else (
            float(prop.monthly_rent) if prop.monthly_rent else None
        ),
        "charges": float(prop.charges) if prop.charges else None,
        "caution": float(prop.deposit) if prop.deposit else None,
        "adresse_affichee": listing.adresse_affichee or prop.city,
        "ville": prop.city,
        "code_postal": prop.zip_code,
        "canton": prop.canton,
        # Coordonnées arrondies à 3 décimales (~111m) — protège la vie privée
        "lat": round(float(listing.lat), 3) if listing.lat else None,
        "lng": round(float(listing.lng), 3) if listing.lng else None,
        "surface": prop.surface,
        "pieces": prop.rooms,
        "chambres": prop.bedrooms,
        "sdb": prop.bathrooms,
        "etage": prop.floor,
        "type": prop.type,
        "type_label": _TYPE_LABEL.get(prop.type, prop.type),
        "is_furnished": prop.is_furnished,
        "has_parking": prop.has_parking,
        "has_balcony": prop.has_balcony,
        "has_terrace": prop.has_terrace,
        "has_garden": prop.has_garden,
        "pets_allowed": prop.pets_allowed,
        "photos": photos,
        "cover": photos[0] if photos else None,
        "tags_ia": tags,
        "is_premium": listing.is_premium,
        "ai_score": float(listing.ai_score) if listing.ai_score else None,
        "vues": listing.views,
        "contacts_count": listing.contacts_count,
        "published_at": listing.published_at.isoformat() if listing.published_at else None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/biens")
async def list_biens(
    db: DbDep,
    response: Response,
    transaction_type: str | None = Query(None),
    ville: str | None = Query(None),
    canton: str | None = Query(None),
    prix_min: float | None = Query(None),
    prix_max: float | None = Query(None),
    pieces: int | None = Query(None),
    surface_min: float | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, le=50),
):
    """Liste publique des biens actifs sur la marketplace."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    conds = [
        Listing.status == "active",
        Listing.is_active == True,
        Property.is_active == True,
    ]
    if transaction_type:
        conds.append(Listing.transaction_type == transaction_type)
    if ville:
        conds.append(Property.city.ilike(f"%{ville}%"))
    if canton:
        conds.append(Property.canton.ilike(f"%{canton}%"))
    if prix_min is not None:
        conds.append(Listing.price >= prix_min)
    if prix_max is not None:
        conds.append(Listing.price <= prix_max)
    if pieces is not None:
        conds.append(Property.rooms >= pieces)
    if surface_min is not None:
        conds.append(Property.surface >= surface_min)

    join = select(Listing, Property).join(Property, Listing.property_id == Property.id)

    # Total
    total = (
        await db.execute(
            select(func.count(Listing.id))
            .join(Property, Listing.property_id == Property.id)
            .where(*conds)
        )
    ).scalar_one()

    # Items — premium en premier, puis plus récents
    rows = (
        await db.execute(
            join.where(*conds)
            .order_by(Listing.is_premium.desc(), Listing.published_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    return {
        "items": [_serialize(l, p) for l, p in rows],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // size)),
    }


@router.get("/carte")
async def carte_geojson(
    db: DbDep,
    response: Response,
    transaction_type: str | None = Query(None),
):
    """GeoJSON des biens actifs géolocalisés (pour Mapbox)."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    conds = [
        Listing.status == "active",
        Listing.is_active == True,
        Property.is_active == True,
        Listing.lat.isnot(None),
        Listing.lng.isnot(None),
    ]
    if transaction_type:
        conds.append(Listing.transaction_type == transaction_type)

    rows = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(*conds)
        )
    ).all()

    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [
                round(float(l.lng), 3),
                round(float(l.lat), 3),
            ]},
            "properties": {
                "id": str(l.id),
                "titre": l.title or f"{_TYPE_LABEL.get(p.type, p.type)} à {p.city}",
                "prix": float(l.price) if l.price else None,
                "transaction_type": l.transaction_type,
                "is_premium": l.is_premium,
                "cover": (l.photos[0] if isinstance(l.photos, list) and l.photos else None),
                "ville": p.city,
                "surface": p.surface,
                "pieces": p.rooms,
            },
        }
        for l, p in rows
    ]

    return {"type": "FeatureCollection", "features": features}


@router.get("/{listing_id}")
async def get_bien(listing_id: uuid.UUID, db: DbDep, response: Response):
    """Détail public d'un bien actif. Incrémente le compteur de vues."""
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(
                Listing.id == listing_id,
                Listing.status == "active",
                Listing.is_active == True,
                Property.is_active == True,
            )
        )
    ).first()

    if not row:
        raise HTTPException(404, "Bien introuvable")

    listing, prop = row
    listing.views = (listing.views or 0) + 1
    await db.commit()

    return _serialize(listing, prop)


# ── Schemas mutations ─────────────────────────────────────────────────────────

class PublierRequest(BaseModel):
    # Si property_id fourni → upsert listing sur un bien existant (vérification ownership)
    # Si absent → crée Property + Listing (mode wizard)
    property_id: uuid.UUID | None = None
    type: str = "apartment"
    transaction_type: str = "location"
    adresse: str
    ville: str
    code_postal: str
    canton: str | None = None
    surface: float | None = None
    pieces: int | None = None
    prix: float
    charges: float | None = None
    caution: float | None = None
    is_furnished: bool = False
    has_parking: bool = False
    has_balcony: bool = False
    has_terrace: bool = False
    has_garden: bool = False
    pets_allowed: bool = False
    titre: str | None = None
    description: str | None = None
    tags_ia: list[str] = []
    photos: list[str] = []
    adresse_affichee: str | None = None


class ModifierRequest(BaseModel):
    titre: str | None = None
    description: str | None = None
    tags_ia: list[str] | None = None
    photos: list[str] | None = None
    prix: float | None = None
    charges: float | None = None
    status: str | None = None
    adresse_affichee: str | None = None
    is_premium: bool | None = None


# ── Routes authentifiées ──────────────────────────────────────────────────────

@router.post("/publier", status_code=201)
@limiter.limit("20/minute")
async def publier_bien(request: Request, body: PublierRequest, db: DbDep, user: AuthUserDep):
    """
    Publie un bien sur la marketplace.
    - Si property_id fourni : vérifie l'ownership, upsert le Listing.
    - Si absent : crée un nouveau Property + Listing.
    Génère la description IA si absente. Expire dans 30 jours.
    """
    from datetime import timedelta

    if user.role not in ROLES_PROPERTY_MANAGERS:
        raise HTTPException(403, "Seuls les propriétaires et agences peuvent publier")

    now = datetime.now(timezone.utc)
    expire_at = now + timedelta(days=30)

    # ── Mode upsert : bien existant ───────────────────────────────────────────
    if body.property_id:
        prop_row = (
            await db.execute(
                select(Property).where(
                    Property.id == body.property_id,
                    Property.is_active == True,
                )
            )
        ).scalar_one_or_none()
        if not prop_row:
            raise HTTPException(404, "Bien introuvable")
        if prop_row.owner_id != user.id and prop_row.agency_id != user.id and user.role != "super_admin":
            raise HTTPException(403, "Ce bien ne vous appartient pas")

        prop = prop_row

        # Chercher listing existant ou en créer un
        existing_listing = (
            await db.execute(
                select(Listing).where(Listing.property_id == body.property_id)
            )
        ).scalar_one_or_none()

        titre = body.titre or f"{_TYPE_LABEL.get(body.type, prop.type)} à {prop.city}"

        if existing_listing:
            # Upsert
            existing_listing.title = titre
            existing_listing.price = body.prix
            existing_listing.transaction_type = body.transaction_type
            existing_listing.adresse_affichee = body.adresse_affichee or prop.city
            if body.photos:
                existing_listing.photos = body.photos
            if body.tags_ia:
                existing_listing.tags_ia = body.tags_ia
            if body.description:
                existing_listing.description_ai = body.description
            existing_listing.status = "active"
            existing_listing.published_at = now
            existing_listing.expire_at = expire_at
            await db.commit()
            await db.refresh(existing_listing)
            listing = existing_listing
        else:
            listing = Listing(
                property_id=prop.id,
                title=titre,
                description_ai=body.description,
                price=body.prix,
                status="active",
                transaction_type=body.transaction_type,
                lat=prop.lat if hasattr(prop, "lat") else None,
                lng=prop.lng if hasattr(prop, "lng") else None,
                adresse_affichee=body.adresse_affichee or prop.city,
                photos=body.photos,
                tags_ia=body.tags_ia,
                is_premium=False,
                published_at=now,
                expire_at=expire_at,
            )
            db.add(listing)
            await db.commit()
            await db.refresh(listing)

    # ── Mode création : nouveau bien ──────────────────────────────────────────
    else:
        prop = Property(
            owner_id=user.id,
            created_by_id=user.id,
            type=body.type,
            status="available",
            address=body.adresse,
            city=body.ville,
            zip_code=body.code_postal,
            country="CH",
            surface=body.surface,
            rooms=body.pieces,
            monthly_rent=body.prix if body.transaction_type in ("location", "colocation") else None,
            charges=body.charges,
            deposit=body.caution,
            price_sale=body.prix if body.transaction_type == "vente" else None,
            is_furnished=body.is_furnished,
            has_parking=body.has_parking,
            has_balcony=body.has_balcony,
            has_terrace=body.has_terrace,
            has_garden=body.has_garden,
            pets_allowed=body.pets_allowed,
            canton=body.canton,
        )
        db.add(prop)
        await db.flush()

        # Géocodage
        lat, lng = None, None
        try:
            from app.services.geocoding import geocode
            coords = await geocode(body.adresse, body.ville, body.code_postal)
            if coords:
                lat, lng = coords
        except Exception:
            pass

        titre = body.titre or f"{_TYPE_LABEL.get(body.type, body.type)} à {body.ville}"

        listing = Listing(
            property_id=prop.id,
            title=titre,
            description_ai=body.description,
            price=body.prix,
            status="active",
            transaction_type=body.transaction_type,
            lat=lat,
            lng=lng,
            adresse_affichee=body.adresse_affichee or body.ville,
            photos=body.photos,
            tags_ia=body.tags_ia,
            is_premium=False,
            published_at=now,
            expire_at=expire_at,
        )
        db.add(listing)
        await db.commit()
        await db.refresh(listing)

    # ── Génération description IA si absente (non bloquant) ───────────────────
    if not listing.description_ai:
        try:
            desc = await generate_listing_description(prop, db, str(user.id))
            listing.description_ai = desc
            await db.commit()
        except Exception:
            pass

    return {"id": str(listing.id), "url": f"/biens/{listing.id}"}


@router.patch("/{listing_id}")
async def modifier_listing(
    listing_id: uuid.UUID,
    body: ModifierRequest,
    db: DbDep,
    user: AuthUserDep,
):
    """Modifie un listing appartenant à l'utilisateur connecté."""
    listing = await _get_owned_listing(listing_id, user, db)

    if body.titre is not None:
        listing.title = body.titre
    if body.description is not None:
        listing.description_ai = body.description
    if body.tags_ia is not None:
        listing.tags_ia = body.tags_ia
    if body.photos is not None:
        listing.photos = body.photos
    if body.prix is not None:
        listing.price = body.prix
    if body.charges is not None:
        # Stored on Property
        pass
    if body.status is not None:
        listing.status = body.status
    if body.adresse_affichee is not None:
        listing.adresse_affichee = body.adresse_affichee
    if body.is_premium is not None:
        listing.is_premium = body.is_premium

    await db.commit()
    await db.refresh(listing)

    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(Listing.id == listing.id)
        )
    ).first()
    return _serialize(row[0], row[1]) if row else {"id": str(listing.id)}


@router.delete("/{listing_id}", status_code=204)
async def archiver_listing(listing_id: uuid.UUID, db: DbDep, user: AuthUserDep):
    """Archive (soft-delete) un listing de l'utilisateur."""
    listing = await _get_owned_listing(listing_id, user, db)
    listing.status = "archived"
    listing.is_active = False
    await db.commit()


# ── Helper auth ───────────────────────────────────────────────────────────────

async def _get_owned_listing(
    listing_id: uuid.UUID, user: User, db: AsyncSession
) -> Listing:
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


# ── Swipe / Intérêts ──────────────────────────────────────────────────────────

class InteresseRequest(BaseModel):
    listing_id: uuid.UUID
    session_id: str | None = None  # pour les anonymes
    message: str | None = None


@router.post("/interesse", status_code=201)
@limiter.limit("30/minute")
async def enregistrer_interet(
    request: Request,
    body: InteresseRequest,
    db: DbDep,
    user: OptUserDep,
):
    """
    Swipe droit — enregistre un intérêt pour un listing.
    Fonctionne pour les utilisateurs connectés (user_id) et anonymes (session_id).
    Notifie le propriétaire du bien.
    """
    if not user and not body.session_id:
        raise HTTPException(400, "session_id requis pour les utilisateurs non connectés")

    # Vérifier que le listing existe et est actif
    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(
                Listing.id == body.listing_id,
                Listing.status == "active",
                Listing.is_active == True,
                Property.is_active == True,
            )
        )
    ).first()
    if not row:
        raise HTTPException(404, "Listing introuvable")

    listing, prop = row

    # Éviter les doublons (upsert gracieux)
    existing_filter = [Interest.listing_id == body.listing_id]
    if user:
        existing_filter.append(Interest.user_id == user.id)
    else:
        existing_filter.append(Interest.session_id == body.session_id)

    existing = (await db.execute(select(Interest).where(*existing_filter))).scalar_one_or_none()
    if existing:
        return {"id": str(existing.id), "already_exists": True}

    interest = Interest(
        listing_id=body.listing_id,
        user_id=user.id if user else None,
        session_id=body.session_id if not user else None,
        status="pending",
        message=body.message,
    )
    db.add(interest)
    listing.contacts_count = (listing.contacts_count or 0) + 1

    # ── Notification proprio ───────────────────────────────────────────────────
    owner_id = prop.owner_id or prop.agency_id
    if owner_id:
        titre_bien = listing.title or f"Bien à {prop.city}"
        candidat_label = (
            f"{user.first_name} {user.last_name}".strip() if user and user.first_name
            else "Un visiteur"
        )
        notif_msg = f"{candidat_label} est intéressé par « {titre_bien} »."
        if body.message:
            notif_msg += f" Message : {body.message[:120]}"
        await db.execute(
            sa_text("""
                INSERT INTO notifications
                    (user_id, type, titre, message, lien, created_at, updated_at)
                VALUES
                    (:uid, 'nouvel_interet', 'Nouvel intérêt', :msg, :lien, now(), now())
            """),
            {
                "uid": str(owner_id),
                "msg": notif_msg,
                "lien": f"/app/biens/{listing.property_id}/locataire",
            },
        )

    await db.commit()
    await db.refresh(interest)

    return {"id": str(interest.id), "already_exists": False}


@router.get("/swipe-next")
async def swipe_next(
    db: DbDep,
    user: OptUserDep,
    session_id: str | None = Query(None),
    transaction_type: str | None = Query(None),
    size: int = Query(10, le=30),
):
    """
    Retourne les prochains biens à swiper (exclus : déjà vus par user/session).
    Utilisé pour alimenter le pool client du swipe.
    """
    # Conditions de base
    conds = [
        Listing.status == "active",
        Listing.is_active == True,
        Property.is_active == True,
    ]
    if transaction_type:
        conds.append(Listing.transaction_type == transaction_type)

    # Sous-requête : listings déjà vus
    seen_filter = []
    if user:
        seen_filter.append(Interest.user_id == user.id)
    if session_id:
        seen_filter.append(Interest.session_id == session_id)

    if seen_filter:
        from sqlalchemy import or_
        seen_ids = select(Interest.listing_id).where(or_(*seen_filter))
        conds.append(Listing.id.not_in(seen_ids))

    rows = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(*conds)
            .order_by(Listing.is_premium.desc(), Listing.published_at.desc())
            .limit(size)
        )
    ).all()

    return {"items": [_serialize(l, p) for l, p in rows], "count": len(rows)}


@router.get("/mes-favoris")
async def mes_favoris(db: DbDep, user: AuthUserDep):
    """Retourne les biens aimés (swipe droit) par l'utilisateur connecté."""
    rows = (
        await db.execute(
            select(Listing, Property, Interest)
            .join(Property, Listing.property_id == Property.id)
            .join(Interest, Interest.listing_id == Listing.id)
            .where(
                Interest.user_id == user.id,
                Listing.is_active == True,
                Property.is_active == True,
            )
            .order_by(Interest.created_at.desc())
        )
    ).all()

    items = []
    for listing, prop, interest in rows:
        bien = _serialize(listing, prop)
        bien["interest_status"] = interest.status
        bien["interest_id"] = str(interest.id)
        bien["interest_at"] = interest.created_at.isoformat()
        items.append(bien)

    return {"items": items, "total": len(items)}


# ── Dossier candidature ───────────────────────────────────────────────────────

class DocumentCandidat(BaseModel):
    type: str       # cni | fiche_salaire | reference | autre
    url: str
    nom: str


class PostulerRequest(BaseModel):
    listing_id: uuid.UUID
    documents: list[DocumentCandidat]
    message: str | None = None


class CandidatureStatutRequest(BaseModel):
    statut: str                         # acceptee | refusee
    visite_proposee_at: str | None = None
    ouvreur_id: uuid.UUID | None = None


def _serialize_candidature(c: Candidature, applicant: User | None = None) -> dict:
    out: dict = {
        "id": str(c.id),
        "listing_id": str(c.listing_id),
        "user_id": str(c.user_id),
        "statut": c.statut,
        "documents": c.documents if isinstance(c.documents, list) else [],
        "message": c.message,
        "score_ia": c.score_ia,
        "score_details": c.score_details,
        "frais_payes": c.frais_payes,
        "visite_proposee_at": c.visite_proposee_at.isoformat() if c.visite_proposee_at else None,
        "ouvreur_id": str(c.ouvreur_id) if c.ouvreur_id else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
    if applicant:
        out["candidat"] = {
            "id": str(applicant.id),
            "email": applicant.email,
            "prenom": applicant.first_name,
            "nom": applicant.last_name,
        }
    return out


@router.post("/postuler", status_code=201)
@limiter.limit("10/minute")
async def postuler(request: Request, body: PostulerRequest, db: DbDep, user: AuthUserDep):
    """
    Soumet une candidature pour un listing.
    Déclenche le scoring IA automatique.
    Auth obligatoire.
    """
    # Vérifier que le listing existe et est actif
    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(
                Listing.id == body.listing_id,
                Listing.status == "active",
                Listing.is_active == True,
                Property.is_active == True,
            )
        )
    ).first()
    if not row:
        raise HTTPException(404, "Listing introuvable ou inactif")

    listing, prop = row

    # Empêcher le proprio de postuler à son propre bien
    if prop.owner_id == user.id or prop.agency_id == user.id:
        raise HTTPException(403, "Vous ne pouvez pas postuler à votre propre annonce")

    # Vérifier doublon
    existing = (
        await db.execute(
            select(Candidature).where(
                Candidature.listing_id == body.listing_id,
                Candidature.user_id == user.id,
                Candidature.statut != "retiree",
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Vous avez déjà postulé pour ce bien")

    docs = [d.model_dump() for d in body.documents]

    # ── Scoring IA ────────────────────────────────────────────────────────────
    score_ia: int | None = None
    score_details: dict | None = None
    try:
        tenant_data = {
            "prenom": user.first_name,
            "listing_titre": listing.title or f"Bien à {prop.city}",
            "ville": prop.city,
            "loyer_demande": float(listing.price or prop.monthly_rent or 0),
            "documents_fournis": [d["type"] for d in docs],
            "nb_fiches_salaire": sum(1 for d in docs if d["type"] == "fiche_salaire"),
            "a_cni": any(d["type"] == "cni" for d in docs),
            "a_references": any(d["type"] == "reference" for d in docs),
            "message": body.message or "",
        }
        result = await score_tenant_application(tenant_data, db, str(user.id))
        score_ia = int(result.score)
        score_details = {
            "recommendation": result.recommendation,
            "risk_flags": result.risk_flags,
            "summary": result.summary,
        }
    except Exception:
        pass  # scoring non bloquant

    # Créer la candidature
    now = datetime.now(timezone.utc)
    candidature = Candidature(
        listing_id=body.listing_id,
        user_id=user.id,
        statut="en_attente",
        documents=docs,
        message=body.message,
        score_ia=score_ia,
        score_details=score_details,
        updated_at=now,
    )
    db.add(candidature)

    # Incrémenter contacts_count sur le listing
    listing.contacts_count = (listing.contacts_count or 0) + 1

    await db.commit()
    await db.refresh(candidature)

    return _serialize_candidature(candidature)


@router.get("/candidatures")
async def lister_candidatures(
    db: DbDep,
    user: AuthUserDep,
    listing_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, le=50),
):
    """
    Retourne les candidatures reçues sur les biens du proprio connecté.
    Filtrable par listing_id et statut.
    """
    if user.role not in ROLES_PROPERTY_MANAGERS:
        raise HTTPException(403, "Réservé aux propriétaires et agences")

    # Sous-requête : listings appartenant à l'utilisateur
    owned_listings = (
        select(Listing.id)
        .join(Property, Listing.property_id == Property.id)
        .where(
            (Property.owner_id == user.id) | (Property.agency_id == user.id),
            Listing.is_active == True,
        )
    )

    conds = [Candidature.listing_id.in_(owned_listings)]
    if listing_id:
        conds.append(Candidature.listing_id == listing_id)
    if statut:
        conds.append(Candidature.statut == statut)

    total = (
        await db.execute(select(func.count(Candidature.id)).where(*conds))
    ).scalar_one()

    rows = (
        await db.execute(
            select(Candidature)
            .where(*conds)
            .order_by(Candidature.score_ia.desc().nullslast(), Candidature.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()

    # Enrichir avec les infos des candidats
    items = []
    for c in rows:
        applicant = (
            await db.execute(select(User).where(User.id == c.user_id))
        ).scalar_one_or_none()
        items.append(_serialize_candidature(c, applicant))

    return {"items": items, "total": total, "page": page, "pages": max(1, -(-total // size))}


@router.patch("/candidature/{candidature_id}")
async def traiter_candidature(
    candidature_id: uuid.UUID,
    body: CandidatureStatutRequest,
    db: DbDep,
    user: AuthUserDep,
):
    """
    Accepte ou refuse une candidature.
    Réservé au propriétaire/agence du listing concerné.
    """
    if body.statut not in ("acceptee", "refusee"):
        raise HTTPException(422, "statut doit être 'acceptee' ou 'refusee'")

    candidature = (
        await db.execute(select(Candidature).where(Candidature.id == candidature_id))
    ).scalar_one_or_none()
    if not candidature:
        raise HTTPException(404, "Candidature introuvable")

    # Vérifier propriété du listing
    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(Listing.id == candidature.listing_id)
        )
    ).first()
    if not row:
        raise HTTPException(404, "Listing introuvable")

    _, prop = row
    if prop.owner_id != user.id and prop.agency_id != user.id and user.role != "super_admin":
        raise HTTPException(403, "Vous n'êtes pas propriétaire de ce bien")

    now = datetime.now(timezone.utc)
    candidature.statut = body.statut
    candidature.updated_at = now

    if body.visite_proposee_at:
        try:
            from datetime import datetime as dt
            candidature.visite_proposee_at = dt.fromisoformat(body.visite_proposee_at)
        except ValueError:
            pass

    if body.ouvreur_id:
        candidature.ouvreur_id = body.ouvreur_id

    await db.commit()
    await db.refresh(candidature)

    applicant = (
        await db.execute(select(User).where(User.id == candidature.user_id))
    ).scalar_one_or_none()
    return _serialize_candidature(candidature, applicant)


@router.post("/candidature", status_code=201)
@limiter.limit("5/minute")
async def deposer_candidature(
    request: Request,
    db: DbDep,
    user: AuthUserDep,
    listing_id: uuid.UUID = Form(...),
    interest_id: uuid.UUID | None = Form(None),
    documents: list[UploadFile] = File(default=[]),
):
    """
    Dépose une candidature avec upload de documents vers Supabase Storage.
    Max 5 fichiers, 10 MB chacun. Auth obligatoire.
    Déclenche le scoring IA et notifie le propriétaire.
    """
    if len(documents) > _MAX_FILES:
        raise HTTPException(422, f"Maximum {_MAX_FILES} fichiers autorisés")

    # Vérifier le listing
    row = (
        await db.execute(
            select(Listing, Property)
            .join(Property, Listing.property_id == Property.id)
            .where(
                Listing.id == listing_id,
                Listing.status == "active",
                Listing.is_active == True,
                Property.is_active == True,
            )
        )
    ).first()
    if not row:
        raise HTTPException(404, "Listing introuvable ou inactif")
    listing, prop = row

    if prop.owner_id == user.id or prop.agency_id == user.id:
        raise HTTPException(403, "Vous ne pouvez pas postuler à votre propre annonce")

    existing = (
        await db.execute(
            select(Candidature).where(
                Candidature.listing_id == listing_id,
                Candidature.user_id == user.id,
                Candidature.statut != "retiree",
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Vous avez déjà postulé pour ce bien")

    # ── Upload documents → Supabase Storage ───────────────────────────────────
    uploaded_docs: list[dict] = []
    for f in documents:
        content = await f.read()
        if len(content) > _MAX_FILE_BYTES:
            raise HTTPException(413, f"Le fichier {f.filename} dépasse 10 MB")
        ext = (f.filename or "").rsplit(".", 1)[-1].lower()
        path = f"{user.id}/{listing_id}/{uuid.uuid4()}.{ext}"
        ct = f.content_type or mimetypes.guess_type(f.filename or "")[0] or "application/octet-stream"
        try:
            public_url = await _upload_to_supabase(content, path, ct)
        except RuntimeError as exc:
            raise HTTPException(502, f"Erreur upload fichier : {exc}")
        doc_type = "autre"
        fname_lower = (f.filename or "").lower()
        if "cni" in fname_lower or "identite" in fname_lower or "passeport" in fname_lower:
            doc_type = "cni"
        elif "salaire" in fname_lower or "salary" in fname_lower:
            doc_type = "fiche_salaire"
        elif "reference" in fname_lower or "ref" in fname_lower:
            doc_type = "reference"
        uploaded_docs.append({"type": doc_type, "url": public_url, "nom": f.filename or path})

    # ── Scoring IA (non bloquant) ─────────────────────────────────────────────
    score_ia: int | None = None
    score_details: dict | None = None
    try:
        tenant_data = {
            "prenom": user.first_name,
            "listing_titre": listing.title or f"Bien à {prop.city}",
            "ville": prop.city,
            "loyer_demande": float(listing.price or prop.monthly_rent or 0),
            "documents_fournis": [d["type"] for d in uploaded_docs],
            "nb_fiches_salaire": sum(1 for d in uploaded_docs if d["type"] == "fiche_salaire"),
            "a_cni": any(d["type"] == "cni" for d in uploaded_docs),
            "a_references": any(d["type"] == "reference" for d in uploaded_docs),
        }
        result = await score_tenant_application(tenant_data, db, str(user.id))
        score_ia = int(result.score)
        score_details = {
            "recommendation": result.recommendation,
            "risk_flags": result.risk_flags,
            "summary": result.summary,
        }
    except Exception:
        pass

    # ── Créer la candidature ──────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    candidature = Candidature(
        listing_id=listing_id,
        interest_id=interest_id,
        user_id=user.id,
        statut="en_attente",
        documents=uploaded_docs,
        score_ia=score_ia,
        score_details=score_details,
        updated_at=now,
    )
    db.add(candidature)
    listing.contacts_count = (listing.contacts_count or 0) + 1

    # ── Notification proprio ──────────────────────────────────────────────────
    owner_id = prop.owner_id or prop.agency_id
    if owner_id:
        candidat_label = (
            f"{user.first_name} {user.last_name}".strip() if user.first_name
            else user.email
        )
        score_label = f" (score IA : {score_ia}/100)" if score_ia is not None else ""
        await db.execute(
            sa_text("""
                INSERT INTO notifications
                    (user_id, type, titre, message, lien, created_at, updated_at)
                VALUES
                    (:uid, 'nouvelle_candidature', 'Nouvelle candidature', :msg, :lien, now(), now())
            """),
            {
                "uid": str(owner_id),
                "msg": f"{candidat_label} a déposé un dossier pour « {listing.title or prop.city} »{score_label}.",
                "lien": f"/app/biens/{listing.property_id}/locataire",
            },
        )

    await db.commit()
    await db.refresh(candidature)

    return {
        "candidature_id": str(candidature.id),
        "score_ia": score_ia,
        "nb_documents": len(uploaded_docs),
        "message": "Votre dossier a bien été envoyé au propriétaire.",
    }


@router.get("/mes-candidatures")
async def mes_candidatures(db: DbDep, user: AuthUserDep):
    """Retourne les candidatures envoyées par l'utilisateur connecté."""
    rows = (
        await db.execute(
            select(Candidature, Listing, Property)
            .join(Listing, Listing.id == Candidature.listing_id)
            .join(Property, Property.id == Listing.property_id)
            .where(Candidature.user_id == user.id)
            .order_by(Candidature.created_at.desc())
        )
    ).all()

    items = []
    for candidature, listing, prop in rows:
        item = _serialize_candidature(candidature)
        item["bien"] = {
            "id": str(listing.id),
            "titre": listing.title or f"{_TYPE_LABEL.get(prop.type, prop.type)} à {prop.city}",
            "ville": prop.city,
            "prix": float(listing.price or prop.monthly_rent or 0),
            "cover": (listing.photos[0] if isinstance(listing.photos, list) and listing.photos else None),
        }
        items.append(item)

    return {"items": items, "total": len(items)}
