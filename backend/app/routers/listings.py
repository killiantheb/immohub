"""Listings router — /api/v1/listings"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.listing import Listing
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ListingCreate(BaseModel):
    title: str
    listing_type: str = "rental"  # rental | sale
    description: str | None = None
    monthly_rent: float | None = None
    sale_price: float | None = None
    bien_id: str | None = None
    on_flatfox: bool = False
    on_homegate: bool = False
    on_immoscout: bool = False
    on_immobilier: bool = False


class ListingUpdate(BaseModel):
    status: str | None = None
    on_flatfox: bool | None = None
    on_homegate: bool | None = None
    on_immoscout: bool | None = None
    on_immobilier: bool | None = None


class ListingRead(BaseModel):
    id: str
    title: str
    listing_type: str
    status: str
    monthly_rent: float | None
    sale_price: float | None
    views_count: int
    inquiries_count: int
    on_flatfox: bool
    on_homegate: bool
    on_immoscout: bool
    on_immobilier: bool
    published_at: Any | None
    created_at: Any


def _to_read(listing: Listing) -> ListingRead:
    p = listing.portals or {}
    return ListingRead(
        id=str(listing.id),
        title=listing.title or "",
        listing_type=p.get("listing_type", "rental"),
        status=listing.status,
        monthly_rent=p.get("monthly_rent"),
        sale_price=p.get("sale_price") or (float(listing.price) if listing.price else None),
        views_count=listing.views,
        inquiries_count=listing.leads_count,
        on_flatfox=bool(p.get("on_flatfox", False)),
        on_homegate=bool(p.get("on_homegate", False)),
        on_immoscout=bool(p.get("on_immoscout", False)),
        on_immobilier=bool(p.get("on_immobilier", False)),
        published_at=listing.published_at,
        created_at=listing.created_at,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_bien_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(Bien.id).where(Bien.owner_id == user_id, Bien.is_active == True)
    )
    return list(result.scalars().all())


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_listings(
    db: DbDep,
    user: AuthUserDep,
    status_filter: str | None = Query(None, alias="status"),
    size: int = Query(50, le=200),
):
    bien_ids = await _get_user_bien_ids(db, user.id)

    # Filter by the biens owned by the current user.
    if not bien_ids:
        return {"items": [], "total": 0}

    q = select(Listing).where(
        Listing.bien_id.in_(bien_ids),
        Listing.is_active == True,
    )
    if status_filter and status_filter != "all":
        q = q.where(Listing.status == status_filter)
    q = q.order_by(Listing.created_at.desc()).limit(size)

    result = await db.execute(q)
    items = result.scalars().all()
    return {"items": [_to_read(i) for i in items], "total": len(items)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_listing(
    body: ListingCreate,
    db: DbDep,
    user: AuthUserDep,
):
    bien_ids = await _get_user_bien_ids(db, user.id)

    # Determine bien_id
    pid: uuid.UUID | None = None
    if body.bien_id:
        try:
            pid = uuid.UUID(body.bien_id)
        except ValueError:
            raise HTTPException(400, "bien_id invalide")
        if pid not in bien_ids:
            raise HTTPException(403, "Bien introuvable ou non rattaché à votre compte")
    elif bien_ids:
        pid = bien_ids[0]  # default au premier bien si non précisé
    else:
        raise HTTPException(400, "Vous devez posséder au moins un bien pour créer un listing")

    portals = {
        "listing_type": body.listing_type,
        "monthly_rent": body.monthly_rent,
        "sale_price": body.sale_price,
        "on_flatfox": body.on_flatfox,
        "on_homegate": body.on_homegate,
        "on_immoscout": body.on_immoscout,
        "on_immobilier": body.on_immobilier,
    }

    listing = Listing(
        bien_id=pid,
        title=body.title,
        description_ai=body.description,
        price=body.sale_price or body.monthly_rent,
        portals=portals,
        status="draft",
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return _to_read(listing)


@router.patch("/{listing_id}")
async def update_listing(
    listing_id: uuid.UUID,
    body: ListingUpdate,
    db: DbDep,
    user: AuthUserDep,
):
    bien_ids = await _get_user_bien_ids(db, user.id)
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.is_active == True)
    )
    listing = result.scalar_one_or_none()
    if not listing or listing.bien_id not in bien_ids:
        raise HTTPException(404, "Listing not found")

    if body.status is not None:
        listing.status = body.status

    # Update portal flags inside portals JSONB
    portals = dict(listing.portals or {})
    for flag in ("on_flatfox", "on_homegate", "on_immoscout", "on_immobilier"):
        val = getattr(body, flag, None)
        if val is not None:
            portals[flag] = val
    listing.portals = portals

    await db.commit()
    await db.refresh(listing)
    return _to_read(listing)


# ── Publish (diffusion portails) ─────────────────────────────────────────────

CHANNEL_TO_FLAG = {
    "flatfox": "on_flatfox",
    "homegate": "on_homegate",
    "immoscout24": "on_immoscout",
    "immobilier_ch": "on_immobilier",
}


class PublishRequest(BaseModel):
    channel: str  # flatfox | homegate | immoscout24 | immobilier_ch


@router.post("/{listing_id}/publish")
async def publish_listing(
    listing_id: uuid.UUID,
    body: PublishRequest,
    db: DbDep,
    user: AuthUserDep,
):
    """Diffuser une annonce sur un portail.

    Pour l'instant, met à jour le flag portail dans la DB.
    L'intégration SMG / Flatfox / immobilier.ch viendra en Phase 2.
    """
    flag = CHANNEL_TO_FLAG.get(body.channel)
    if not flag:
        raise HTTPException(400, f"Canal inconnu : {body.channel}")

    bien_ids = await _get_user_bien_ids(db, user.id)
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.is_active == True)
    )
    listing = result.scalar_one_or_none()
    if not listing or listing.bien_id not in bien_ids:
        raise HTTPException(404, "Listing not found")

    portals = dict(listing.portals or {})
    portals[flag] = True
    listing.portals = portals

    if not listing.published_at:
        from datetime import datetime, timezone
        listing.published_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(listing)
    return {"status": "published", "channel": body.channel, "listing_id": str(listing.id)}


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: uuid.UUID,
    db: DbDep,
    user: AuthUserDep,
):
    bien_ids = await _get_user_bien_ids(db, user.id)
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.is_active == True)
    )
    listing = result.scalar_one_or_none()
    if not listing or listing.bien_id not in bien_ids:
        raise HTTPException(404, "Listing not found")

    listing.is_active = False
    await db.commit()
