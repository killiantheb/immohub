"""Marketplace — /api/v1/marketplace

Routes publiques (sans auth) :  GET /biens  GET /stats  GET /carte  GET /{id}
Routes authentifiées :           POST /publier  PATCH /{id}  DELETE /{id}
                                 POST /interesse  GET /swipe-next  GET /mes-favoris
                                 POST /postuler  GET /candidatures  PATCH /candidature/{id}
                                 POST /candidature  GET /mes-candidatures
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

import stripe
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.database import get_db
from app.core.security import ROLES_PROPERTY_MANAGERS, get_current_user, get_optional_current_user
from app.models.candidature import Candidature
from app.models.interest import Interest
from app.models.listing import Listing
from app.models.property import Property
from app.models.user import User
from app.services.marketplace_service import (
    MAX_CANDIDATURE_FILES,
    TYPE_LABEL,
    PublierRequest,
    get_owned_listing,
    notify_candidature_accepted,
    notify_owner_new_candidature,
    publier_bien_service,
    score_candidature_ia,
    serialize_candidature,
    serialize_listing,
    upload_candidature_files,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY

router  = APIRouter()
DbDep       = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]
OptUserDep  = Annotated[User | None, Depends(get_optional_current_user)]


# ── Schémas ───────────────────────────────────────────────────────────────────

# PublierRequest est défini dans marketplace_service.py (importé ci-dessus)

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


class InteresseRequest(BaseModel):
    listing_id: uuid.UUID
    session_id: str | None = None
    message: str | None = None


class DocumentCandidat(BaseModel):
    type: str   # cni | fiche_salaire | reference | autre
    url: str
    nom: str


class PostulerRequest(BaseModel):
    listing_id: uuid.UUID
    documents: list[DocumentCandidat]
    message: str | None = None


class CandidatureStatutRequest(BaseModel):
    statut: str
    visite_proposee_at: str | None = None
    ouvreur_id: uuid.UUID | None = None


# ── Routes publiques ──────────────────────────────────────────────────────────

@router.get("/biens")
async def list_biens(
    db: DbDep,
    response: Response,
    type: str | None = Query(None),
    pieces_min: int | None = Query(None),
    limit: int | None = Query(None, ge=1, le=100),
    offset: int | None = Query(None, ge=0),
    transaction_type: str | None = Query(None),
    ville: str | None = Query(None),
    canton: str | None = Query(None),
    prix_min: float | None = Query(None),
    prix_max: float | None = Query(None),
    pieces: int | None = Query(None),
    surface_min: float | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, le=100),
):
    """Liste publique des biens actifs (SANS authentification)."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"

    conds = [Listing.status == "active", Listing.is_active == True, Property.is_active == True]
    if transaction_type:
        conds.append(Listing.transaction_type == transaction_type)
    if type:
        conds.append(Property.type == type)
    if ville:
        conds.append(Property.city.ilike(f"%{ville}%"))
    if canton:
        conds.append(Property.canton.ilike(f"%{canton}%"))
    if prix_min is not None:
        conds.append(Listing.price >= prix_min)
    if prix_max is not None:
        conds.append(Listing.price <= prix_max)
    pieces_filter = pieces_min if pieces_min is not None else pieces
    if pieces_filter is not None:
        conds.append(Property.rooms >= pieces_filter)
    if surface_min is not None:
        conds.append(Property.surface >= surface_min)

    join    = select(Listing, Property).join(Property, Listing.property_id == Property.id)
    total   = (await db.execute(
        select(func.count(Listing.id)).join(Property, Listing.property_id == Property.id).where(*conds)
    )).scalar_one()

    _limit  = limit  if limit  is not None else size
    _offset = offset if offset is not None else (page - 1) * size
    rows = (await db.execute(
        join.where(*conds)
        .order_by(Listing.is_premium.desc(), Listing.published_at.desc())
        .offset(_offset).limit(_limit)
    )).all()

    return {"items": [serialize_listing(l, p) for l, p in rows], "total": total, "page": page,
            "pages": max(1, -(-total // _limit))}


@router.get("/stats")
async def marketplace_stats(db: DbDep, response: Response):
    """Statistiques publiques de la marketplace."""
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=600"
    base_conds = [Listing.status == "active", Listing.is_active == True, Property.is_active == True]
    base_join  = select(func.count(Listing.id)).join(Property, Listing.property_id == Property.id)
    total_biens = (await db.execute(base_join.where(*base_conds))).scalar_one()
    ville_rows  = (await db.execute(
        select(Property.city, func.count(Listing.id).label("cnt"))
        .join(Listing, Listing.property_id == Property.id)
        .where(*base_conds).group_by(Property.city)
        .order_by(func.count(Listing.id).desc())
    )).all()
    villes = [{"nom": r.city, "count": r.cnt} for r in ville_rows]
    return {"total_biens": total_biens, "total_villes": len(villes), "villes": villes}


@router.get("/carte")
async def carte_geojson(
    db: DbDep,
    response: Response,
    transaction_type: str | None = Query(None),
):
    """GeoJSON des biens géolocalisés (pour Mapbox)."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    conds = [
        Listing.status == "active", Listing.is_active == True, Property.is_active == True,
        Listing.lat.isnot(None), Listing.lng.isnot(None),
    ]
    if transaction_type:
        conds.append(Listing.transaction_type == transaction_type)
    rows = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id).where(*conds)
    )).all()
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(float(l.lng), 3), round(float(l.lat), 3)]},
            "properties": {
                "id": str(l.id),
                "titre": l.title or f"{TYPE_LABEL.get(p.type, p.type)} à {p.city}",
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
    """Détail public d'un bien. Incrémente le compteur de vues."""
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    row = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(Listing.id == listing_id, Listing.status == "active",
               Listing.is_active == True, Property.is_active == True)
    )).first()
    if not row:
        raise HTTPException(404, "Bien introuvable")
    listing, prop = row
    listing.views = (listing.views or 0) + 1
    await db.commit()
    return serialize_listing(listing, prop)


# ── Routes authentifiées — gestion des listings ───────────────────────────────

@router.post("/publier", status_code=201)
@limiter.limit("20/minute")
async def publier_bien(request: Request, body: PublierRequest, db: DbDep, user: AuthUserDep):
    """Publie un bien (crée ou met à jour). Génère la description IA si absente."""
    if user.role not in ROLES_PROPERTY_MANAGERS:
        raise HTTPException(403, "Seuls les propriétaires et agences peuvent publier")
    listing = await publier_bien_service(body, user, db)
    return {"id": str(listing.id), "url": f"/biens/{listing.id}"}


@router.patch("/{listing_id}")
async def modifier_listing(listing_id: uuid.UUID, body: ModifierRequest, db: DbDep, user: AuthUserDep):
    """Modifie un listing appartenant à l'utilisateur connecté."""
    listing = await get_owned_listing(listing_id, user, db)
    if body.titre        is not None: listing.title          = body.titre
    if body.description  is not None: listing.description_ai = body.description
    if body.tags_ia      is not None: listing.tags_ia        = body.tags_ia
    if body.photos       is not None: listing.photos         = body.photos
    if body.prix         is not None: listing.price          = body.prix
    if body.status       is not None: listing.status         = body.status
    if body.adresse_affichee is not None: listing.adresse_affichee = body.adresse_affichee
    if body.is_premium   is not None: listing.is_premium     = body.is_premium
    await db.commit()
    await db.refresh(listing)
    row = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(Listing.id == listing.id)
    )).first()
    return serialize_listing(row[0], row[1]) if row else {"id": str(listing.id)}


@router.delete("/{listing_id}", status_code=204)
async def archiver_listing(listing_id: uuid.UUID, db: DbDep, user: AuthUserDep):
    """Archive (soft-delete) un listing de l'utilisateur."""
    listing = await get_owned_listing(listing_id, user, db)
    listing.status    = "archived"
    listing.is_active = False
    await db.commit()


# ── Swipe / Intérêts ──────────────────────────────────────────────────────────

@router.post("/interesse", status_code=201)
@limiter.limit("30/minute")
async def enregistrer_interet(request: Request, body: InteresseRequest, db: DbDep, user: OptUserDep):
    """Swipe droit — enregistre un intérêt. Notifie le propriétaire."""
    if not user and not body.session_id:
        raise HTTPException(400, "session_id requis pour les utilisateurs non connectés")

    row = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(Listing.id == body.listing_id, Listing.status == "active",
               Listing.is_active == True, Property.is_active == True)
    )).first()
    if not row:
        raise HTTPException(404, "Listing introuvable")
    listing, prop = row

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

    owner_id = prop.owner_id or prop.agency_id
    if owner_id:
        candidat_label = (
            f"{user.first_name} {user.last_name}".strip() if user and user.first_name else "Un visiteur"
        )
        notif_msg = f"{candidat_label} est intéressé par « {listing.title or f'Bien à {prop.city}'} »."
        if body.message:
            notif_msg += f" Message : {body.message[:120]}"
        await db.execute(
            sa_text("""
                INSERT INTO notifications (user_id, type, titre, message, lien, created_at, updated_at)
                VALUES (:uid, 'nouvel_interet', 'Nouvel intérêt', :msg, :lien, now(), now())
            """),
            {"uid": str(owner_id), "msg": notif_msg, "lien": f"/app/biens/{listing.property_id}/locataire"},
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
    """Prochains biens à swiper (hors déjà vus)."""
    conds = [Listing.status == "active", Listing.is_active == True, Property.is_active == True]
    if transaction_type:
        conds.append(Listing.transaction_type == transaction_type)
    seen_filter = []
    if user:
        seen_filter.append(Interest.user_id == user.id)
    if session_id:
        seen_filter.append(Interest.session_id == session_id)
    if seen_filter:
        from sqlalchemy import or_
        conds.append(Listing.id.not_in(select(Interest.listing_id).where(or_(*seen_filter))))
    rows = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(*conds).order_by(Listing.is_premium.desc(), Listing.published_at.desc()).limit(size)
    )).all()
    return {"items": [serialize_listing(l, p) for l, p in rows], "count": len(rows)}


@router.get("/mes-favoris")
async def mes_favoris(db: DbDep, user: AuthUserDep):
    """Biens aimés (swipe droit) par l'utilisateur connecté."""
    rows = (await db.execute(
        select(Listing, Property, Interest)
        .join(Property, Listing.property_id == Property.id)
        .join(Interest, Interest.listing_id == Listing.id)
        .where(Interest.user_id == user.id, Listing.is_active == True, Property.is_active == True)
        .order_by(Interest.created_at.desc())
    )).all()
    items = []
    for listing, prop, interest in rows:
        bien = serialize_listing(listing, prop)
        bien["interest_status"] = interest.status
        bien["interest_id"]     = str(interest.id)
        bien["interest_at"]     = interest.created_at.isoformat()
        items.append(bien)
    return {"items": items, "total": len(items)}


# ── Candidatures ──────────────────────────────────────────────────────────────

@router.post("/postuler", status_code=201)
@limiter.limit("10/minute")
async def postuler(request: Request, body: PostulerRequest, db: DbDep, user: AuthUserDep):
    """Soumet une candidature JSON (sans upload). Déclenche le scoring IA."""
    row = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(Listing.id == body.listing_id, Listing.status == "active",
               Listing.is_active == True, Property.is_active == True)
    )).first()
    if not row:
        raise HTTPException(404, "Listing introuvable ou inactif")
    listing, prop = row
    if prop.owner_id == user.id or prop.agency_id == user.id:
        raise HTTPException(403, "Vous ne pouvez pas postuler à votre propre annonce")
    if (await db.execute(select(Candidature).where(
        Candidature.listing_id == body.listing_id,
        Candidature.user_id == user.id,
        Candidature.statut != "retiree",
    ))).scalar_one_or_none():
        raise HTTPException(409, "Vous avez déjà postulé pour ce bien")

    docs = [d.model_dump() for d in body.documents]
    score_ia, score_details = await score_candidature_ia(user, listing, prop, docs, db, body.message or "")

    candidature = Candidature(
        listing_id=body.listing_id, user_id=user.id,
        statut="en_attente", documents=docs, message=body.message,
        score_ia=score_ia, score_details=score_details,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(candidature)
    listing.contacts_count = (listing.contacts_count or 0) + 1
    await db.commit()
    await db.refresh(candidature)
    return serialize_candidature(candidature)


@router.get("/candidatures")
async def lister_candidatures(
    db: DbDep, user: AuthUserDep,
    listing_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, le=50),
):
    """Candidatures reçues sur les biens du proprio connecté."""
    if user.role not in ROLES_PROPERTY_MANAGERS:
        raise HTTPException(403, "Réservé aux propriétaires et agences")
    owned = (
        select(Listing.id).join(Property, Listing.property_id == Property.id)
        .where((Property.owner_id == user.id) | (Property.agency_id == user.id), Listing.is_active == True)
    )
    conds = [Candidature.listing_id.in_(owned)]
    if listing_id:
        conds.append(Candidature.listing_id == listing_id)
    if statut:
        conds.append(Candidature.statut == statut)
    total = (await db.execute(select(func.count(Candidature.id)).where(*conds))).scalar_one()
    rows  = (await db.execute(
        select(Candidature).where(*conds)
        .order_by(Candidature.score_ia.desc().nullslast(), Candidature.created_at.desc())
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    items = []
    for c in rows:
        applicant = (await db.execute(select(User).where(User.id == c.user_id))).scalar_one_or_none()
        items.append(serialize_candidature(c, applicant))
    return {"items": items, "total": total, "page": page, "pages": max(1, -(-total // size))}


@router.patch("/candidature/{candidature_id}")
async def traiter_candidature(
    candidature_id: uuid.UUID, body: CandidatureStatutRequest,
    db: DbDep, user: AuthUserDep,
):
    """
    Accepte ou refuse une candidature. Réservé au propriétaire/agence.

    Lors d'une acceptation : le propriétaire est facturé CHF 45 (off_session) sur sa
    carte enregistrée — les frais de dossier sont supportés par le propriétaire,
    jamais par le locataire. Un échec de prélèvement NE BLOQUE PAS l'acceptation :
    la candidature passe à 'acceptee' et `owner_fee_failure_reason` est consigné.
    """
    if body.statut not in ("acceptee", "refusee"):
        raise HTTPException(422, "statut doit être 'acceptee' ou 'refusee'")
    candidature = (await db.execute(
        select(Candidature).where(Candidature.id == candidature_id)
    )).scalar_one_or_none()
    if not candidature:
        raise HTTPException(404, "Candidature introuvable")
    row = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(Listing.id == candidature.listing_id)
    )).first()
    if not row:
        raise HTTPException(404, "Listing introuvable")
    _, prop = row
    if prop.owner_id != user.id and prop.agency_id != user.id and user.role != "super_admin":
        raise HTTPException(403, "Vous n'êtes pas propriétaire de ce bien")

    now = datetime.now(timezone.utc)
    previous_statut = candidature.statut
    candidature.statut     = body.statut
    candidature.updated_at = now
    if body.visite_proposee_at:
        try:
            candidature.visite_proposee_at = datetime.fromisoformat(body.visite_proposee_at)
        except ValueError:
            pass
    if body.ouvreur_id:
        candidature.ouvreur_id = body.ouvreur_id

    # ── Prélèvement CHF 45 propriétaire (idempotent) ─────────────────────────
    fee_result: dict = {}
    newly_accepted = body.statut == "acceptee" and previous_statut != "acceptee"
    if newly_accepted and candidature.owner_fee_paid_at is None:
        fee_result = await _charge_owner_dossier_fee(db, candidature, prop.owner_id or user.id)

    # ── Notifications in-app (tenant + owner) ────────────────────────────────
    if newly_accepted:
        listing_title = (await db.execute(
            sa_text("SELECT titre FROM listings WHERE id = :lid"),
            {"lid": str(candidature.listing_id)},
        )).scalar() or "votre bien"
        await notify_candidature_accepted(
            db,
            tenant_id=candidature.user_id,
            owner_id=prop.owner_id or user.id,
            listing_title=str(listing_title),
            owner_fee_chf=float(settings.OWNER_DOSSIER_FEE_CHF),
            owner_fee_charged=bool(fee_result.get("charged")),
        )

    await db.commit()
    await db.refresh(candidature)
    applicant = (await db.execute(select(User).where(User.id == candidature.user_id))).scalar_one_or_none()
    payload = serialize_candidature(candidature, applicant)
    if fee_result:
        payload["owner_fee"] = fee_result
    return payload


async def _charge_owner_dossier_fee(
    db: AsyncSession,
    candidature: Candidature,
    owner_id: uuid.UUID,
) -> dict:
    """
    Prélève CHF 45 off_session sur la carte enregistrée du propriétaire.
    Ne lève JAMAIS — un échec ne bloque pas l'acceptation ; la raison est consignée
    sur la candidature pour relance manuelle par le proprio depuis /app/settings/paiement.
    """
    fee_chf = Decimal(str(settings.OWNER_DOSSIER_FEE_CHF))
    pm_row = (await db.execute(
        sa_text(
            "SELECT stripe_customer_id, stripe_card_pm_id "
            "FROM profiles WHERE user_id = :uid"
        ),
        {"uid": str(owner_id)},
    )).fetchone()

    customer_id = pm_row[0] if pm_row else None
    pm_id = pm_row[1] if pm_row else None

    if not customer_id or not pm_id:
        reason = "Aucune carte enregistrée — le propriétaire doit en ajouter une dans /app/settings/paiement."
        candidature.owner_fee_failed_at = datetime.now(timezone.utc)
        candidature.owner_fee_failure_reason = reason
        logger.warning(
            "owner_fee_skipped candidature=%s owner=%s reason=no_payment_method",
            candidature.id, owner_id,
        )
        return {"charged": False, "reason": reason, "amount_chf": float(fee_chf)}

    try:
        pi = stripe.PaymentIntent.create(
            amount=int(fee_chf * 100),
            currency="chf",
            customer=customer_id,
            payment_method=pm_id,
            confirm=True,
            off_session=True,
            description=f"Althy — frais dossier locataire ({candidature.id})",
            metadata={
                "type": "owner_dossier_fee",
                "candidature_id": str(candidature.id),
                "owner_id": str(owner_id),
            },
            idempotency_key=f"owner-fee-{candidature.id}",
        )
        candidature.owner_fee_amount = fee_chf
        candidature.owner_fee_stripe_intent_id = pi.id
        if pi.status == "succeeded":
            candidature.owner_fee_paid_at = datetime.now(timezone.utc)
            candidature.owner_fee_failed_at = None
            candidature.owner_fee_failure_reason = None
            return {
                "charged": True,
                "payment_intent_id": pi.id,
                "amount_chf": float(fee_chf),
            }
        return {
            "charged": False,
            "pending": True,
            "payment_intent_id": pi.id,
            "amount_chf": float(fee_chf),
        }
    except stripe.error.CardError as e:
        reason = e.user_message or str(e)
        candidature.owner_fee_failed_at = datetime.now(timezone.utc)
        candidature.owner_fee_failure_reason = reason
        logger.warning(
            "owner_fee_declined candidature=%s owner=%s reason=%s",
            candidature.id, owner_id, reason,
        )
        return {"charged": False, "reason": reason, "amount_chf": float(fee_chf)}
    except stripe.error.StripeError as e:
        reason = getattr(e, "user_message", None) or str(e)
        candidature.owner_fee_failed_at = datetime.now(timezone.utc)
        candidature.owner_fee_failure_reason = reason
        logger.exception(
            "owner_fee_stripe_error candidature=%s owner=%s",
            candidature.id, owner_id,
        )
        return {"charged": False, "reason": reason, "amount_chf": float(fee_chf)}


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
    """Dépose une candidature avec upload de documents (max 5 × 10 MB)."""
    if len(documents) > MAX_CANDIDATURE_FILES:
        raise HTTPException(422, f"Maximum {MAX_CANDIDATURE_FILES} fichiers autorisés")

    row = (await db.execute(
        select(Listing, Property).join(Property, Listing.property_id == Property.id)
        .where(Listing.id == listing_id, Listing.status == "active",
               Listing.is_active == True, Property.is_active == True)
    )).first()
    if not row:
        raise HTTPException(404, "Listing introuvable ou inactif")
    listing, prop = row
    if prop.owner_id == user.id or prop.agency_id == user.id:
        raise HTTPException(403, "Vous ne pouvez pas postuler à votre propre annonce")
    if (await db.execute(select(Candidature).where(
        Candidature.listing_id == listing_id,
        Candidature.user_id == user.id,
        Candidature.statut != "retiree",
    ))).scalar_one_or_none():
        raise HTTPException(409, "Vous avez déjà postulé pour ce bien")

    uploaded_docs = await upload_candidature_files(documents, user.id, listing_id)
    score_ia, score_details = await score_candidature_ia(user, listing, prop, uploaded_docs, db)

    now = datetime.now(timezone.utc)
    candidature = Candidature(
        listing_id=listing_id, interest_id=interest_id, user_id=user.id,
        statut="en_attente", documents=uploaded_docs,
        score_ia=score_ia, score_details=score_details, updated_at=now,
    )
    db.add(candidature)
    listing.contacts_count = (listing.contacts_count or 0) + 1

    owner_id = prop.owner_id or prop.agency_id
    if owner_id:
        candidat_label = (
            f"{user.first_name} {user.last_name}".strip() if user.first_name else user.email
        )
        await notify_owner_new_candidature(
            owner_id, candidat_label,
            listing.title or prop.city, listing.property_id, score_ia, db,
        )

    await db.commit()
    await db.refresh(candidature)
    return {
        "candidature_id": str(candidature.id),
        "score_ia":       score_ia,
        "nb_documents":   len(uploaded_docs),
        "message":        "Votre dossier a bien été envoyé au propriétaire.",
    }


@router.get("/mes-candidatures")
async def mes_candidatures(db: DbDep, user: AuthUserDep):
    """Candidatures envoyées par l'utilisateur connecté."""
    rows = (await db.execute(
        select(Candidature, Listing, Property)
        .join(Listing, Listing.id == Candidature.listing_id)
        .join(Property, Property.id == Listing.property_id)
        .where(Candidature.user_id == user.id)
        .order_by(Candidature.created_at.desc())
    )).all()
    items = []
    for candidature, listing, prop in rows:
        item = serialize_candidature(candidature)
        item["bien"] = {
            "id":     str(listing.id),
            "titre":  listing.title or f"{TYPE_LABEL.get(prop.type, prop.type)} à {prop.city}",
            "ville":  prop.city,
            "prix":   float(listing.price or prop.monthly_rent or 0),
            "cover":  (listing.photos[0] if isinstance(listing.photos, list) and listing.photos else None),
        }
        items.append(item)
    return {"items": items, "total": len(items)}
