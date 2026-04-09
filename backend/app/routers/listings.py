"""Listings router — /api/v1/listings"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.listing import Listing
from app.models.property import Property
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
    property_id: str | None = None
    on_homegate: bool = False
    on_immoscout: bool = False
    on_booking: bool = False
    on_airbnb: bool = False


class ListingUpdate(BaseModel):
    status: str | None = None
    on_homegate: bool | None = None
    on_immoscout: bool | None = None
    on_booking: bool | None = None
    on_airbnb: bool | None = None


class ListingRead(BaseModel):
    id: str
    title: str
    listing_type: str
    status: str
    monthly_rent: float | None
    sale_price: float | None
    views_count: int
    inquiries_count: int
    on_homegate: bool
    on_immoscout: bool
    on_booking: bool
    on_airbnb: bool
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
        on_homegate=bool(p.get("on_homegate", False)),
        on_immoscout=bool(p.get("on_immoscout", False)),
        on_booking=bool(p.get("on_booking", False)),
        on_airbnb=bool(p.get("on_airbnb", False)),
        published_at=listing.published_at,
        created_at=listing.created_at,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_property_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(Property.id).where(Property.owner_id == user_id, Property.is_active == True)
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
    prop_ids = await _get_user_property_ids(db, user.id)

    # Also include listings without a property_id that belong to this user
    # We track ownership via property_id → owner, OR via portals.owner_id stored
    # For now: filter by user's property_ids, plus listings where portals.owner_id == user.id
    if not prop_ids:
        return {"items": [], "total": 0}

    q = select(Listing).where(
        Listing.property_id.in_(prop_ids),
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
    prop_ids = await _get_user_property_ids(db, user.id)

    # Determine property_id
    pid: uuid.UUID | None = None
    if body.property_id:
        try:
            pid = uuid.UUID(body.property_id)
        except ValueError:
            raise HTTPException(400, "Invalid property_id")
        if pid not in prop_ids:
            raise HTTPException(403, "Property not found or not owned by you")
    elif prop_ids:
        pid = prop_ids[0]  # default to first property if none specified
    else:
        raise HTTPException(400, "You need at least one property to create a listing")

    portals = {
        "listing_type": body.listing_type,
        "monthly_rent": body.monthly_rent,
        "sale_price": body.sale_price,
        "on_homegate": body.on_homegate,
        "on_immoscout": body.on_immoscout,
        "on_booking": body.on_booking,
        "on_airbnb": body.on_airbnb,
    }

    listing = Listing(
        property_id=pid,
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
    prop_ids = await _get_user_property_ids(db, user.id)
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.is_active == True)
    )
    listing = result.scalar_one_or_none()
    if not listing or listing.property_id not in prop_ids:
        raise HTTPException(404, "Listing not found")

    if body.status is not None:
        listing.status = body.status

    # Update portal flags inside portals JSONB
    portals = dict(listing.portals or {})
    for flag in ("on_homegate", "on_immoscout", "on_booking", "on_airbnb"):
        val = getattr(body, flag, None)
        if val is not None:
            portals[flag] = val
    listing.portals = portals

    await db.commit()
    await db.refresh(listing)
    return _to_read(listing)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: uuid.UUID,
    db: DbDep,
    user: AuthUserDep,
):
    prop_ids = await _get_user_property_ids(db, user.id)
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.is_active == True)
    )
    listing = result.scalar_one_or_none()
    if not listing or listing.property_id not in prop_ids:
        raise HTTPException(404, "Listing not found")

    listing.is_active = False
    await db.commit()
