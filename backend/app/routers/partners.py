"""Partners — router admin (super_admin uniquement).

Endpoints :
  CRUD partners              GET/POST/PATCH/DELETE /api/v1/partners
  CRUD deals                 GET/POST/PATCH        /api/v1/partners/{id}/deals
  Leads (lecture + création) GET/POST              /api/v1/partners/{id}/leads
  Leads tous partenaires     GET                   /api/v1/partners/leads
  Stats temps réel           GET                   /api/v1/partners/{id}/stats
  Commissions                GET/POST              /api/v1/partners/{id}/commissions

Sécurité : require_roles("super_admin"). RLS Postgres refuse tout accès direct.
Clé API chiffrée : encrypt/decrypt via SECRET_KEY (partner_service.encrypt_api_key).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from sqlalchemy import text
from app.models.partner import (
    DEAL_TYPES,
    LEAD_STATUSES,
    VERTICALS,
    Partner,
    PartnerCommission,
    PartnerDeal,
    PartnerLead,
)
from app.services.partner_service import (
    NoPartnerAvailable,
    PartnerConsentRequired,
    encrypt_api_key,
    send_lead_to_partner,
    upsert_monthly_commission,
)


router = APIRouter()
DbDep = Annotated[AsyncSession, Depends(get_db)]
SuperAdmin = require_roles("super_admin")


# ── Schemas ──────────────────────────────────────────────────────────────────

Vertical = Literal["insurance", "caution", "mortgage", "moving", "energy", "telecom", "other"]
DealType = Literal["affiliation", "exclusive_with_minimum", "strategic", "revenue_share"]
LeadStatus = Literal["sent", "qualified", "signed", "rejected", "expired"]
PartnerStatus = Literal["active", "paused", "terminated"]


class PartnerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    vertical: Vertical
    country: str = "CH"
    region: str | None = None
    website: str | None = None
    api_base_url: str | None = None
    api_key: str | None = Field(default=None, description="Clé API brute — sera chiffrée")
    status: PartnerStatus = "active"
    contact_person: str | None = None
    contact_email: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    exclusivity_region: str | None = None


class PartnerUpdate(BaseModel):
    name: str | None = None
    vertical: Vertical | None = None
    region: str | None = None
    website: str | None = None
    api_base_url: str | None = None
    api_key: str | None = None
    status: PartnerStatus | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    exclusivity_region: str | None = None


class PartnerRead(BaseModel):
    id: str
    name: str
    vertical: str
    country: str
    region: str | None
    website: str | None
    api_base_url: str | None
    has_api_key: bool
    status: str
    contact_person: str | None
    contact_email: str | None
    contract_start_date: date | None
    contract_end_date: date | None
    exclusivity_region: str | None
    created_at: datetime


class DealCreate(BaseModel):
    deal_type: DealType
    min_monthly_guarantee: Decimal = Decimal(0)
    per_contract_commission: Decimal | None = None
    per_lead_commission: Decimal | None = None
    revenue_share_percentage: Decimal | None = None
    start_date: date
    end_date: date | None = None
    status: Literal["active", "paused", "terminated"] = "active"
    notes: str | None = None


class DealUpdate(BaseModel):
    deal_type: DealType | None = None
    min_monthly_guarantee: Decimal | None = None
    per_contract_commission: Decimal | None = None
    per_lead_commission: Decimal | None = None
    revenue_share_percentage: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: Literal["active", "paused", "terminated"] | None = None
    notes: str | None = None


class DealRead(BaseModel):
    id: str
    partner_id: str
    deal_type: str
    min_monthly_guarantee: Decimal
    per_contract_commission: Decimal | None
    per_lead_commission: Decimal | None
    revenue_share_percentage: Decimal | None
    start_date: date
    end_date: date | None
    status: str
    notes: str | None


class LeadManualCreate(BaseModel):
    user_id: uuid.UUID
    vertical: Vertical
    lead_data: dict = Field(default_factory=dict)
    region: str | None = None


class LeadRead(BaseModel):
    id: str
    partner_id: str
    user_id: str | None
    vertical: str
    lead_data: dict
    status: str
    sent_at: datetime | None
    qualified_at: datetime | None
    signed_at: datetime | None
    commission_amount: Decimal | None
    commission_paid_at: datetime | None
    external_reference: str | None
    consent_id: str | None
    notes: str | None


class LeadStatusUpdate(BaseModel):
    status: LeadStatus
    commission_amount: Decimal | None = None
    notes: str | None = None
    external_reference: str | None = None


class PartnerStats(BaseModel):
    partner_id: str
    leads_this_month: int
    qualified_this_month: int
    signed_this_month: int
    conversion_rate: float
    pending_commission: Decimal
    volume_6m: list[dict]  # [{period: "2026-04", leads: 12}, ...]


class CommissionRead(BaseModel):
    id: str
    partner_id: str
    period_start: date
    period_end: date
    total_leads: int
    total_signed: int
    minimum_guarantee_amount: Decimal | None
    variable_commission_amount: Decimal | None
    total_amount: Decimal | None
    invoice_sent_at: datetime | None
    paid_at: datetime | None


class CommissionCompute(BaseModel):
    year: int = Field(ge=2024, le=2100)
    month: int = Field(ge=1, le=12)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _partner_to_read(p: Partner) -> PartnerRead:
    return PartnerRead(
        id=str(p.id),
        name=p.name,
        vertical=p.vertical,
        country=p.country,
        region=p.region,
        website=p.website,
        api_base_url=p.api_base_url,
        has_api_key=bool(p.api_key_encrypted),
        status=p.status,
        contact_person=p.contact_person,
        contact_email=p.contact_email,
        contract_start_date=p.contract_start_date,
        contract_end_date=p.contract_end_date,
        exclusivity_region=p.exclusivity_region,
        created_at=p.created_at,
    )


def _deal_to_read(d: PartnerDeal) -> DealRead:
    return DealRead(
        id=str(d.id),
        partner_id=str(d.partner_id),
        deal_type=d.deal_type,
        min_monthly_guarantee=d.min_monthly_guarantee or Decimal(0),
        per_contract_commission=d.per_contract_commission,
        per_lead_commission=d.per_lead_commission,
        revenue_share_percentage=d.revenue_share_percentage,
        start_date=d.start_date,
        end_date=d.end_date,
        status=d.status,
        notes=d.notes,
    )


def _lead_to_read(lead: PartnerLead) -> LeadRead:
    return LeadRead(
        id=str(lead.id),
        partner_id=str(lead.partner_id),
        user_id=str(lead.user_id) if lead.user_id else None,
        vertical=lead.vertical,
        lead_data=lead.lead_data or {},
        status=lead.status,
        sent_at=lead.sent_at,
        qualified_at=lead.qualified_at,
        signed_at=lead.signed_at,
        commission_amount=lead.commission_amount,
        commission_paid_at=lead.commission_paid_at,
        external_reference=lead.external_reference,
        consent_id=str(lead.consent_id) if lead.consent_id else None,
        notes=lead.notes,
    )


def _commission_to_read(c: PartnerCommission) -> CommissionRead:
    return CommissionRead(
        id=str(c.id),
        partner_id=str(c.partner_id),
        period_start=c.period_start,
        period_end=c.period_end,
        total_leads=c.total_leads,
        total_signed=c.total_signed,
        minimum_guarantee_amount=c.minimum_guarantee_amount,
        variable_commission_amount=c.variable_commission_amount,
        total_amount=c.total_amount,
        invoice_sent_at=c.invoice_sent_at,
        paid_at=c.paid_at,
    )


async def _get_partner_or_404(db: AsyncSession, partner_id: uuid.UUID) -> Partner:
    p = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Partenaire introuvable")
    return p


# ── CRUD partners ────────────────────────────────────────────────────────────


@router.get("/partners", response_model=list[PartnerRead])
async def list_partners(
    db: DbDep,
    _user=Depends(SuperAdmin),
    vertical: Vertical | None = Query(default=None),
    status: PartnerStatus | None = Query(default=None),
):
    q = select(Partner)
    if vertical:
        q = q.where(Partner.vertical == vertical)
    if status:
        q = q.where(Partner.status == status)
    q = q.order_by(Partner.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [_partner_to_read(p) for p in rows]


@router.post("/partners", response_model=PartnerRead, status_code=201)
async def create_partner(body: PartnerCreate, db: DbDep, _user=Depends(SuperAdmin)):
    p = Partner(
        id=uuid.uuid4(),
        name=body.name,
        vertical=body.vertical,
        country=body.country,
        region=body.region,
        website=body.website,
        api_base_url=body.api_base_url,
        api_key_encrypted=encrypt_api_key(body.api_key),
        status=body.status,
        contact_person=body.contact_person,
        contact_email=body.contact_email,
        contract_start_date=body.contract_start_date,
        contract_end_date=body.contract_end_date,
        exclusivity_region=body.exclusivity_region,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _partner_to_read(p)


@router.get("/partners/{partner_id}", response_model=PartnerRead)
async def get_partner(partner_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)):
    p = await _get_partner_or_404(db, partner_id)
    return _partner_to_read(p)


@router.patch("/partners/{partner_id}", response_model=PartnerRead)
async def update_partner(
    partner_id: uuid.UUID, body: PartnerUpdate, db: DbDep, _user=Depends(SuperAdmin)
):
    p = await _get_partner_or_404(db, partner_id)
    data = body.model_dump(exclude_unset=True)
    if "api_key" in data:
        p.api_key_encrypted = encrypt_api_key(data.pop("api_key"))
    for field, value in data.items():
        setattr(p, field, value)
    await db.commit()
    await db.refresh(p)
    return _partner_to_read(p)


@router.delete("/partners/{partner_id}", status_code=204)
async def delete_partner(partner_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)):
    """Supprime un partenaire — attention : cascade sur partner_deals uniquement.
    Les leads/commissions sont conservés (ON DELETE RESTRICT) ; passer status=terminated
    plutôt que delete si le partenaire a déjà des leads."""
    p = await _get_partner_or_404(db, partner_id)
    await db.delete(p)
    try:
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            409,
            f"Impossible de supprimer : leads ou commissions existants. "
            f"Utiliser PATCH status=terminated. ({exc})",
        )
    return None


# ── CRUD deals ───────────────────────────────────────────────────────────────


@router.get("/partners/{partner_id}/deals", response_model=list[DealRead])
async def list_deals(partner_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)):
    await _get_partner_or_404(db, partner_id)
    rows = (await db.execute(
        select(PartnerDeal)
        .where(PartnerDeal.partner_id == partner_id)
        .order_by(PartnerDeal.start_date.desc())
    )).scalars().all()
    return [_deal_to_read(d) for d in rows]


@router.post("/partners/{partner_id}/deals", response_model=DealRead, status_code=201)
async def create_deal(
    partner_id: uuid.UUID, body: DealCreate, db: DbDep, _user=Depends(SuperAdmin)
):
    await _get_partner_or_404(db, partner_id)
    d = PartnerDeal(
        id=uuid.uuid4(),
        partner_id=partner_id,
        deal_type=body.deal_type,
        min_monthly_guarantee=body.min_monthly_guarantee,
        per_contract_commission=body.per_contract_commission,
        per_lead_commission=body.per_lead_commission,
        revenue_share_percentage=body.revenue_share_percentage,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        notes=body.notes,
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return _deal_to_read(d)


@router.patch("/partners/{partner_id}/deals/{deal_id}", response_model=DealRead)
async def update_deal(
    partner_id: uuid.UUID,
    deal_id: uuid.UUID,
    body: DealUpdate,
    db: DbDep,
    _user=Depends(SuperAdmin),
):
    d = (await db.execute(
        select(PartnerDeal).where(
            PartnerDeal.id == deal_id, PartnerDeal.partner_id == partner_id
        )
    )).scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Deal introuvable")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(d, field, value)
    await db.commit()
    await db.refresh(d)
    return _deal_to_read(d)


# ── Leads ────────────────────────────────────────────────────────────────────


@router.get("/partners/leads", response_model=list[LeadRead])
async def list_all_leads(
    db: DbDep,
    _user=Depends(SuperAdmin),
    partner_id: uuid.UUID | None = Query(default=None),
    status: LeadStatus | None = Query(default=None),
    vertical: Vertical | None = Query(default=None),
    since: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    q = select(PartnerLead)
    if partner_id:
        q = q.where(PartnerLead.partner_id == partner_id)
    if status:
        q = q.where(PartnerLead.status == status)
    if vertical:
        q = q.where(PartnerLead.vertical == vertical)
    if since:
        q = q.where(PartnerLead.sent_at >= since)
    q = q.order_by(PartnerLead.sent_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return [_lead_to_read(lead) for lead in rows]


@router.get("/partners/{partner_id}/leads", response_model=list[LeadRead])
async def list_partner_leads(
    partner_id: uuid.UUID,
    db: DbDep,
    _user=Depends(SuperAdmin),
    status: LeadStatus | None = Query(default=None),
    since: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    await _get_partner_or_404(db, partner_id)
    q = select(PartnerLead).where(PartnerLead.partner_id == partner_id)
    if status:
        q = q.where(PartnerLead.status == status)
    if since:
        q = q.where(PartnerLead.sent_at >= since)
    q = q.order_by(PartnerLead.sent_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return [_lead_to_read(lead) for lead in rows]


@router.post("/partners/{partner_id}/leads", response_model=LeadRead, status_code=201)
async def create_lead_manual(
    partner_id: uuid.UUID,
    body: LeadManualCreate,
    db: DbDep,
    _user=Depends(SuperAdmin),
):
    """Admin crée un lead manuellement (test, simulation, injection manuelle).

    Respecte la contrainte RGPD : refuse si pas de consentement
    `partner_<vertical>` pour l'user cible.
    """
    await _get_partner_or_404(db, partner_id)
    try:
        lead = await send_lead_to_partner(
            db,
            user_id=body.user_id,
            vertical=body.vertical,
            lead_data=body.lead_data,
            region=body.region,
        )
    except PartnerConsentRequired as exc:
        raise HTTPException(403, str(exc))
    except NoPartnerAvailable as exc:
        raise HTTPException(404, str(exc))

    return _lead_to_read(lead)


@router.patch("/partners/leads/{lead_id}", response_model=LeadRead)
async def update_lead_status(
    lead_id: uuid.UUID,
    body: LeadStatusUpdate,
    db: DbDep,
    _user=Depends(SuperAdmin),
):
    lead = (await db.execute(
        select(PartnerLead).where(PartnerLead.id == lead_id)
    )).scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead introuvable")

    now = datetime.now(timezone.utc)
    lead.status = body.status
    if body.status == "qualified" and not lead.qualified_at:
        lead.qualified_at = now
    if body.status == "signed" and not lead.signed_at:
        lead.signed_at = now
    if body.commission_amount is not None:
        lead.commission_amount = body.commission_amount
    if body.notes is not None:
        lead.notes = body.notes
    if body.external_reference is not None:
        lead.external_reference = body.external_reference

    await db.commit()
    await db.refresh(lead)
    return _lead_to_read(lead)


# ── Stats ────────────────────────────────────────────────────────────────────


@router.get("/partners/{partner_id}/stats", response_model=PartnerStats)
async def partner_stats(
    partner_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)
):
    await _get_partner_or_404(db, partner_id)

    today = date.today()
    month_start = today.replace(day=1)

    # 6 mois en arrière (premier du mois il y a 5 mois — 6 buckets au total)
    six_months_ago_year = today.year
    six_months_ago_month = today.month - 5
    while six_months_ago_month < 1:
        six_months_ago_month += 12
        six_months_ago_year -= 1
    since_6m = date(six_months_ago_year, six_months_ago_month, 1)

    total_leads = (await db.execute(
        select(func.count(PartnerLead.id)).where(
            PartnerLead.partner_id == partner_id,
            PartnerLead.sent_at >= month_start,
        )
    )).scalar_one() or 0

    qualified = (await db.execute(
        select(func.count(PartnerLead.id)).where(
            PartnerLead.partner_id == partner_id,
            PartnerLead.status.in_(["qualified", "signed"]),
            PartnerLead.sent_at >= month_start,
        )
    )).scalar_one() or 0

    signed = (await db.execute(
        select(func.count(PartnerLead.id)).where(
            PartnerLead.partner_id == partner_id,
            PartnerLead.status == "signed",
            PartnerLead.sent_at >= month_start,
        )
    )).scalar_one() or 0

    pending = (await db.execute(
        select(func.coalesce(func.sum(PartnerCommission.total_amount), 0)).where(
            PartnerCommission.partner_id == partner_id,
            PartnerCommission.paid_at.is_(None),
        )
    )).scalar_one() or Decimal(0)

    bucket = func.date_trunc("month", PartnerLead.sent_at).label("m")
    rows = (await db.execute(
        select(bucket, func.count(PartnerLead.id))
        .where(
            PartnerLead.partner_id == partner_id,
            PartnerLead.sent_at >= since_6m,
        )
        .group_by(bucket)
        .order_by(bucket)
    )).all()
    volume = [
        {"period": r.m.strftime("%Y-%m"), "leads": int(r[1])}
        for r in rows if r.m
    ]

    conv = (signed / total_leads) if total_leads else 0.0
    return PartnerStats(
        partner_id=str(partner_id),
        leads_this_month=int(total_leads),
        qualified_this_month=int(qualified),
        signed_this_month=int(signed),
        conversion_rate=round(conv, 3),
        pending_commission=Decimal(pending),
        volume_6m=volume,
    )


# ── Commissions ──────────────────────────────────────────────────────────────


@router.get("/partners/{partner_id}/commissions", response_model=list[CommissionRead])
async def list_commissions(
    partner_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)
):
    await _get_partner_or_404(db, partner_id)
    rows = (await db.execute(
        select(PartnerCommission)
        .where(PartnerCommission.partner_id == partner_id)
        .order_by(PartnerCommission.period_start.desc())
    )).scalars().all()
    return [_commission_to_read(c) for c in rows]


@router.post("/partners/{partner_id}/commissions", response_model=CommissionRead)
async def compute_commission(
    partner_id: uuid.UUID,
    body: CommissionCompute,
    db: DbDep,
    _user=Depends(SuperAdmin),
):
    """Calcule + persiste la commission mensuelle pour ce partenaire."""
    await _get_partner_or_404(db, partner_id)
    c = await upsert_monthly_commission(db, partner_id, body.year, body.month)
    return _commission_to_read(c)


@router.post("/partners/commissions/{commission_id}/mark-invoiced", response_model=CommissionRead)
async def mark_invoiced(
    commission_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)
):
    c = (await db.execute(
        select(PartnerCommission).where(PartnerCommission.id == commission_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Commission introuvable")
    c.invoice_sent_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    return _commission_to_read(c)


@router.post("/partners/commissions/{commission_id}/mark-paid", response_model=CommissionRead)
async def mark_paid(
    commission_id: uuid.UUID, db: DbDep, _user=Depends(SuperAdmin)
):
    c = (await db.execute(
        select(PartnerCommission).where(PartnerCommission.id == commission_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Commission introuvable")
    c.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    return _commission_to_read(c)


# ── Consent (utilisateur authentifié) ────────────────────────────────────────
# Le user coche "Je souhaite être contacté pour <vertical>" → on enregistre
# un consentement `partner_<vertical>` dans la table consents. C'est la preuve
# RGPD nécessaire avant tout envoi de lead.


class PartnerConsentBody(BaseModel):
    vertical: Vertical
    accepted: bool = True
    version: str | None = None


@router.post("/partners/consent", status_code=201)
async def record_partner_consent(
    body: PartnerConsentBody,
    db: DbDep,
    user=Depends(get_current_user),
):
    """Enregistre un consentement partner_<vertical> pour l'utilisateur connecté."""
    consent_type = f"partner_{body.vertical}"
    row = (await db.execute(
        text("""
            select public.record_consent(
              p_user_id := :uid,
              p_type    := :ctype,
              p_accepted:= :accepted,
              p_version := :version,
              p_source  := 'settings_page'
            ) as id
        """),
        {
            "uid": str(user.id),
            "ctype": consent_type,
            "accepted": body.accepted,
            "version": body.version,
        },
    )).one()
    await db.commit()
    return {"ok": True, "consent_id": str(row.id), "consent_type": consent_type}


@router.get("/partners/consent")
async def list_partner_consents(
    db: DbDep,
    user=Depends(get_current_user),
):
    """Retourne l'état actuel des consentements partenaires de l'utilisateur."""
    rows = (await db.execute(
        text("""
            select consent_type, accepted, consented_at
            from consents_latest
            where user_id = :uid
              and consent_type like 'partner_%'
        """),
        {"uid": str(user.id)},
    )).all()
    return {
        r.consent_type.removeprefix("partner_"): {
            "accepted": r.accepted,
            "at": r.consented_at.isoformat() if r.consented_at else None,
        }
        for r in rows
    }


# Éviter les warnings — imports utilisés pour validation côté pydantic / enums
_ = VERTICALS, DEAL_TYPES, LEAD_STATUSES, User
