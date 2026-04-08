"""
CRM propriétaire — contacts, notes, stats.
Agrège locataires (actifs + passés) et prospects en une vue unifiée.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.company import Company
from app.models.contract import Contract
from app.models.crm import CRMContact, CRMNote
from app.models.listing import Listing
from app.models.opener import Mission, Opener
from app.models.property import Property
from app.models.rfq import RFQ, RFQQuote
from app.models.transaction import Transaction
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class NoteOut(PydanticModel):
    id: str
    content: str
    property_id: str | None
    created_at: str

    class Config:
        from_attributes = True


class ContactOut(PydanticModel):
    id: str
    type: str               # "tenant" | "prospect"
    first_name: str | None
    last_name: str | None
    email: str | None
    phone: str | None
    status: str             # active_tenant | past_tenant | prospect
    source: str | None
    property_id: str | None
    property_address: str | None
    contract_id: str | None
    contract_start: str | None
    contract_end: str | None
    monthly_rent: float | None
    total_paid: float
    notes: list[NoteOut]
    created_at: str


class ProspectCreate(PydanticModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    property_id: str | None = None
    source: str = "manual"


class ProspectUpdate(PydanticModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    property_id: str | None = None
    source: str | None = None


class NoteCreate(PydanticModel):
    content: str
    target_type: str        # "tenant" | "prospect"
    target_id: str          # user_id ou crm_contact_id
    property_id: str | None = None


class CRMStats(PydanticModel):
    total_contacts: int
    active_tenants: int
    past_tenants: int
    prospects: int
    properties_count: int
    total_views: int
    total_leads: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_owner(user: User) -> None:
    if user.role not in ("owner", "agency", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux propriétaires")


def _fmt(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=CRMStats)
async def crm_stats(current_user: AuthUserDep, db: DbDep) -> CRMStats:
    """Stats globales CRM du propriétaire."""
    _require_owner(current_user)

    # Locataires actifs (contrats actifs)
    active_res = await db.execute(
        select(func.count(func.distinct(Contract.tenant_id))).where(
            and_(Contract.owner_id == current_user.id, Contract.status == "active",
                 Contract.tenant_id.isnot(None))
        )
    )
    active_tenants = active_res.scalar_one() or 0

    # Locataires passés (contrats terminés/expirés) — pas dans un contrat actif
    past_res = await db.execute(
        select(func.count(func.distinct(Contract.tenant_id))).where(
            and_(
                Contract.owner_id == current_user.id,
                Contract.status.in_(["terminated", "expired"]),
                Contract.tenant_id.isnot(None),
                Contract.tenant_id.notin_(
                    select(Contract.tenant_id).where(
                        and_(Contract.owner_id == current_user.id,
                             Contract.status == "active",
                             Contract.tenant_id.isnot(None))
                    )
                ),
            )
        )
    )
    past_tenants = past_res.scalar_one() or 0

    # Prospects (crm_contacts)
    prospect_res = await db.execute(
        select(func.count()).where(
            and_(CRMContact.owner_id == current_user.id, CRMContact.is_active == True)
        )
    )
    prospects = prospect_res.scalar_one() or 0

    # Propriétés
    prop_res = await db.execute(
        select(func.count()).where(
            and_(Property.owner_id == current_user.id, Property.is_active == True)
        )
    )
    properties_count = prop_res.scalar_one() or 0

    # Vues et leads depuis les listings
    views_res = await db.execute(
        select(func.coalesce(func.sum(Listing.views), 0),
               func.coalesce(func.sum(Listing.leads_count), 0))
        .join(Property, Property.id == Listing.property_id)
        .where(Property.owner_id == current_user.id)
    )
    row = views_res.one()
    total_views = int(row[0])
    total_leads = int(row[1])

    return CRMStats(
        total_contacts=active_tenants + past_tenants + prospects,
        active_tenants=active_tenants,
        past_tenants=past_tenants,
        prospects=prospects,
        properties_count=properties_count,
        total_views=total_views,
        total_leads=total_leads,
    )


@router.get("/contacts", response_model=list[ContactOut])
async def list_contacts(
    current_user: AuthUserDep,
    db: DbDep,
    contact_status: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
) -> list[ContactOut]:
    """Tous les contacts du propriétaire : locataires actifs/passés + prospects."""
    _require_owner(current_user)

    contacts: list[ContactOut] = []

    # ── 1. Locataires depuis les contrats ──────────────────────────────────────
    contracts_res = await db.execute(
        select(Contract, User, Property)
        .join(User, User.id == Contract.tenant_id)
        .join(Property, Property.id == Contract.property_id)
        .where(
            and_(Contract.owner_id == current_user.id, Contract.tenant_id.isnot(None))
        )
        .order_by(Contract.start_date.desc())
    )
    rows = contracts_res.all()

    # Grouper par tenant pour garder le contrat le plus récent et toutes les notes
    seen_tenants: dict[str, ContactOut] = {}

    for contract, tenant, prop in rows:
        tenant_key = str(tenant.id)
        tenant_status = "active_tenant" if contract.status == "active" else "past_tenant"

        if contact_status and tenant_status != contact_status:
            continue

        if search:
            s = search.lower()
            full = f"{tenant.first_name or ''} {tenant.last_name or ''} {tenant.email or ''} {tenant.phone or ''}".lower()
            if s not in full:
                continue

        if tenant_key not in seen_tenants:
            # Montant total payé par ce locataire pour ce propriétaire
            paid_res = await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0))
                .where(
                    and_(
                        Transaction.tenant_id == tenant.id,
                        Transaction.owner_id == current_user.id,
                        Transaction.status == "paid",
                    )
                )
            )
            total_paid = float(paid_res.scalar_one() or 0)

            # Notes sur ce locataire
            notes_res = await db.execute(
                select(CRMNote).where(
                    and_(
                        CRMNote.owner_id == current_user.id,
                        CRMNote.target_user_id == tenant.id,
                        CRMNote.is_active == True,
                    )
                ).order_by(CRMNote.created_at.desc())
            )
            notes = [
                NoteOut(
                    id=str(n.id),
                    content=n.content,
                    property_id=str(n.property_id) if n.property_id else None,
                    created_at=_fmt(n.created_at) or "",
                )
                for n in notes_res.scalars()
            ]

            seen_tenants[tenant_key] = ContactOut(
                id=tenant_key,
                type="tenant",
                first_name=tenant.first_name,
                last_name=tenant.last_name,
                email=tenant.email,
                phone=tenant.phone,
                status=tenant_status,
                source=None,
                property_id=str(prop.id),
                property_address=prop.address,
                contract_id=str(contract.id),
                contract_start=_fmt(contract.start_date),
                contract_end=_fmt(contract.end_date),
                monthly_rent=float(contract.monthly_rent) if contract.monthly_rent else None,
                total_paid=total_paid,
                notes=notes,
                created_at=_fmt(contract.start_date) or "",
            )
        else:
            # Mettre à jour le statut si un contrat actif est trouvé plus tard
            if contract.status == "active":
                seen_tenants[tenant_key].status = "active_tenant"

    contacts.extend(seen_tenants.values())

    # ── 2. Prospects (CRMContact) ──────────────────────────────────────────────
    if not contact_status or contact_status == "prospect":
        prospects_res = await db.execute(
            select(CRMContact, Property)
            .outerjoin(Property, Property.id == CRMContact.property_id)
            .where(
                and_(CRMContact.owner_id == current_user.id, CRMContact.is_active == True)
            )
            .order_by(CRMContact.created_at.desc())
        )

        for prospect, prop in prospects_res.all():
            if search:
                s = search.lower()
                full = f"{prospect.first_name or ''} {prospect.last_name or ''} {prospect.email or ''} {prospect.phone or ''}".lower()
                if s not in full:
                    continue

            notes_res = await db.execute(
                select(CRMNote).where(
                    and_(
                        CRMNote.owner_id == current_user.id,
                        CRMNote.target_contact_id == prospect.id,
                        CRMNote.is_active == True,
                    )
                ).order_by(CRMNote.created_at.desc())
            )
            notes = [
                NoteOut(
                    id=str(n.id),
                    content=n.content,
                    property_id=str(n.property_id) if n.property_id else None,
                    created_at=_fmt(n.created_at) or "",
                )
                for n in notes_res.scalars()
            ]

            contacts.append(ContactOut(
                id=str(prospect.id),
                type="prospect",
                first_name=prospect.first_name,
                last_name=prospect.last_name,
                email=prospect.email,
                phone=prospect.phone,
                status="prospect",
                source=prospect.source,
                property_id=str(prop.id) if prop else None,
                property_address=prop.address if prop else None,
                contract_id=None,
                contract_start=None,
                contract_end=None,
                monthly_rent=None,
                total_paid=0,
                notes=notes,
                created_at=_fmt(prospect.created_at) or "",
            ))

    return contacts


@router.post("/contacts", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_prospect(
    payload: ProspectCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContactOut:
    """Ajouter un prospect manuellement."""
    _require_owner(current_user)

    prop_id = uuid.UUID(payload.property_id) if payload.property_id else None
    contact = CRMContact(
        owner_id=current_user.id,
        property_id=prop_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        status="prospect",
        source=payload.source,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    prop_address = None
    if prop_id:
        prop_res = await db.execute(select(Property).where(Property.id == prop_id))
        prop = prop_res.scalar_one_or_none()
        prop_address = prop.address if prop else None

    return ContactOut(
        id=str(contact.id),
        type="prospect",
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        status="prospect",
        source=contact.source,
        property_id=str(contact.property_id) if contact.property_id else None,
        property_address=prop_address,
        contract_id=None,
        contract_start=None,
        contract_end=None,
        monthly_rent=None,
        total_paid=0,
        notes=[],
        created_at=_fmt(contact.created_at) or "",
    )


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
async def update_prospect(
    contact_id: str,
    payload: ProspectUpdate,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContactOut:
    """Modifier un prospect."""
    _require_owner(current_user)

    res = await db.execute(
        select(CRMContact).where(
            and_(CRMContact.id == uuid.UUID(contact_id),
                 CRMContact.owner_id == current_user.id,
                 CRMContact.is_active == True)
        )
    )
    contact = res.scalar_one_or_none()
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact introuvable")

    for field, val in payload.model_dump(exclude_none=True).items():
        if field == "property_id":
            setattr(contact, field, uuid.UUID(val) if val else None)
        else:
            setattr(contact, field, val)

    await db.commit()
    await db.refresh(contact)

    prop_address = None
    if contact.property_id:
        prop_res = await db.execute(select(Property).where(Property.id == contact.property_id))
        prop = prop_res.scalar_one_or_none()
        prop_address = prop.address if prop else None

    notes_res = await db.execute(
        select(CRMNote).where(
            and_(CRMNote.owner_id == current_user.id,
                 CRMNote.target_contact_id == contact.id,
                 CRMNote.is_active == True)
        ).order_by(CRMNote.created_at.desc())
    )
    notes = [
        NoteOut(id=str(n.id), content=n.content,
                property_id=str(n.property_id) if n.property_id else None,
                created_at=_fmt(n.created_at) or "")
        for n in notes_res.scalars()
    ]

    return ContactOut(
        id=str(contact.id), type="prospect",
        first_name=contact.first_name, last_name=contact.last_name,
        email=contact.email, phone=contact.phone,
        status="prospect", source=contact.source,
        property_id=str(contact.property_id) if contact.property_id else None,
        property_address=prop_address,
        contract_id=None, contract_start=None, contract_end=None,
        monthly_rent=None, total_paid=0, notes=notes,
        created_at=_fmt(contact.created_at) or "",
    )


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_prospect(
    contact_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> None:
    """Supprimer un prospect."""
    _require_owner(current_user)
    res = await db.execute(
        select(CRMContact).where(
            and_(CRMContact.id == uuid.UUID(contact_id),
                 CRMContact.owner_id == current_user.id)
        )
    )
    contact = res.scalar_one_or_none()
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact introuvable")
    contact.is_active = False
    await db.commit()


@router.post("/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def add_note(
    payload: NoteCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> NoteOut:
    """Ajouter une note sur un locataire ou un prospect."""
    _require_owner(current_user)

    if not payload.content.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Contenu vide")

    prop_id = uuid.UUID(payload.property_id) if payload.property_id else None

    if payload.target_type == "tenant":
        note = CRMNote(
            owner_id=current_user.id,
            target_user_id=uuid.UUID(payload.target_id),
            property_id=prop_id,
            content=payload.content.strip(),
        )
    elif payload.target_type == "prospect":
        note = CRMNote(
            owner_id=current_user.id,
            target_contact_id=uuid.UUID(payload.target_id),
            property_id=prop_id,
            content=payload.content.strip(),
        )
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "target_type invalide")

    db.add(note)
    await db.commit()
    await db.refresh(note)

    return NoteOut(
        id=str(note.id),
        content=note.content,
        property_id=str(note.property_id) if note.property_id else None,
        created_at=_fmt(note.created_at) or "",
    )


@router.get("/property/{property_id}/overview")
async def property_overview(
    property_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    """
    Vue 360° d'un bien pour l'agence / propriétaire :
    locataires, contrats, travaux, missions, stats listing, CRM.
    """
    _require_owner(current_user)
    pid = uuid.UUID(property_id)

    # ── Contrats + locataires ──────────────────────────────────────────────────
    contracts_res = await db.execute(
        select(Contract, User)
        .outerjoin(User, User.id == Contract.tenant_id)
        .where(and_(Contract.property_id == pid,
                    or_(Contract.owner_id == current_user.id,
                        Contract.agency_id == current_user.id)))
        .order_by(Contract.start_date.desc())
    )
    contracts_data = []
    for contract, tenant in contracts_res.all():
        paid_res = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(and_(Transaction.contract_id == contract.id,
                        Transaction.status == "paid"))
        )
        total_paid = float(paid_res.scalar_one() or 0)
        contracts_data.append({
            "id": str(contract.id),
            "reference": contract.reference,
            "status": contract.status,
            "type": contract.type,
            "start_date": _fmt(contract.start_date),
            "end_date": _fmt(contract.end_date),
            "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else None,
            "charges": float(contract.charges) if contract.charges else None,
            "deposit": float(contract.deposit) if contract.deposit else None,
            "total_paid": total_paid,
            "tenant": {
                "id": str(tenant.id),
                "first_name": tenant.first_name,
                "last_name": tenant.last_name,
                "email": tenant.email,
                "phone": tenant.phone,
            } if tenant else None,
        })

    # ── RFQs (appels d'offre) ──────────────────────────────────────────────────
    rfqs_res = await db.execute(
        select(RFQ).where(RFQ.property_id == pid).order_by(RFQ.created_at.desc())
    )
    rfqs_data = []
    for rfq in rfqs_res.scalars():
        # Quotes de ce RFQ
        quotes_res = await db.execute(
            select(RFQQuote, Company)
            .join(Company, Company.id == RFQQuote.company_id)
            .where(RFQQuote.rfq_id == rfq.id)
            .order_by(RFQQuote.amount.asc())
        )
        quotes = []
        for quote, company in quotes_res.all():
            quotes.append({
                "id": str(quote.id),
                "company_id": str(company.id),
                "company_name": company.name,
                "company_type": company.type,
                "company_rating": float(company.rating) if company.rating else None,
                "amount": float(quote.amount),
                "status": quote.status,
                "delay_days": quote.delay_days,
                "submitted_at": _fmt(quote.submitted_at),
            })
        rfqs_data.append({
            "id": str(rfq.id),
            "title": rfq.title,
            "category": rfq.category,
            "status": rfq.status,
            "urgency": rfq.urgency,
            "budget_min": float(rfq.budget_min) if rfq.budget_min else None,
            "budget_max": float(rfq.budget_max) if rfq.budget_max else None,
            "scheduled_date": _fmt(rfq.scheduled_date),
            "published_at": _fmt(rfq.published_at),
            "completed_at": _fmt(rfq.completed_at),
            "rating_given": float(rfq.rating_given) if rfq.rating_given else None,
            "quotes_count": len(quotes),
            "quotes": quotes,
        })

    # ── Missions (ouvreurs) ────────────────────────────────────────────────────
    missions_res = await db.execute(
        select(Mission, User)
        .outerjoin(
            Opener, Opener.id == Mission.opener_id
        )
        .outerjoin(User, User.id == Opener.user_id)
        .where(Mission.property_id == pid)
        .order_by(Mission.scheduled_at.desc())
    )
    missions_data = []
    for mission, opener_user in missions_res.all():
        missions_data.append({
            "id": str(mission.id),
            "type": mission.type,
            "status": mission.status,
            "scheduled_at": _fmt(mission.scheduled_at),
            "completed_at": _fmt(mission.completed_at),
            "price": float(mission.price) if mission.price else None,
            "rating_given": float(mission.rating_given) if mission.rating_given else None,
            "opener": {
                "first_name": opener_user.first_name,
                "last_name": opener_user.last_name,
                "email": opener_user.email,
            } if opener_user else None,
        })

    # ── Listing stats ──────────────────────────────────────────────────────────
    listing_res = await db.execute(
        select(Listing).where(Listing.property_id == pid)
    )
    listing = listing_res.scalar_one_or_none()
    listing_stats = {
        "views": listing.views if listing else 0,
        "leads_count": listing.leads_count if listing else 0,
        "status": listing.status if listing else None,
        "published_at": _fmt(listing.published_at) if listing else None,
    }

    # ── CRM contacts pour ce bien ──────────────────────────────────────────────
    crm_contacts_res = await db.execute(
        select(CRMContact).where(
            and_(CRMContact.property_id == pid,
                 CRMContact.owner_id == current_user.id,
                 CRMContact.is_active == True)
        ).order_by(CRMContact.created_at.desc())
    )
    crm_contacts = [
        {
            "id": str(c.id),
            "first_name": c.first_name,
            "last_name": c.last_name,
            "email": c.email,
            "phone": c.phone,
            "status": c.status,
            "source": c.source,
            "created_at": _fmt(c.created_at),
        }
        for c in crm_contacts_res.scalars()
    ]

    # ── Notes sur ce bien (locataires) ─────────────────────────────────────────
    notes_res = await db.execute(
        select(CRMNote).where(
            and_(CRMNote.property_id == pid,
                 CRMNote.owner_id == current_user.id,
                 CRMNote.is_active == True)
        ).order_by(CRMNote.created_at.desc())
    )
    notes = [
        {
            "id": str(n.id),
            "content": n.content,
            "target_user_id": str(n.target_user_id) if n.target_user_id else None,
            "target_contact_id": str(n.target_contact_id) if n.target_contact_id else None,
            "created_at": _fmt(n.created_at),
        }
        for n in notes_res.scalars()
    ]

    # ── Transactions (revenus) ─────────────────────────────────────────────────
    revenue_res = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(and_(Transaction.property_id == pid,
                    Transaction.status == "paid",
                    Transaction.type == "rent"))
    )
    total_revenue = float(revenue_res.scalar_one() or 0)

    return {
        "contracts": contracts_data,
        "rfqs": rfqs_data,
        "missions": missions_data,
        "listing_stats": listing_stats,
        "crm_contacts": crm_contacts,
        "notes": notes,
        "total_revenue": total_revenue,
    }


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_note(
    note_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> None:
    """Supprimer une note."""
    _require_owner(current_user)
    res = await db.execute(
        select(CRMNote).where(
            and_(CRMNote.id == uuid.UUID(note_id),
                 CRMNote.owner_id == current_user.id)
        )
    )
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note introuvable")
    note.is_active = False
    await db.commit()
