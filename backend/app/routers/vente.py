"""Vente router — module vente + mandats + offres — /api/v1/vente"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.base import Base
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, Text, VARCHAR, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import select

router = APIRouter()

DbDep   = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

DISCLAIMER = (
    "⚠️ Estimation générée automatiquement à titre indicatif uniquement. "
    "Althy décline toute responsabilité. Faire valider par un expert immobilier agréé."
)


# ── Models ────────────────────────────────────────────────────────────────────

class SaleMandate(Base):
    __tablename__ = "sale_mandates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL"), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    asking_price: Mapped[float | None] = mapped_column(Numeric(14, 2))
    ia_estimate: Mapped[float | None] = mapped_column(Numeric(14, 2))
    ia_estimate_at: Mapped[Any] = mapped_column(DateTime(timezone=True), nullable=True)
    ia_estimate_report: Mapped[str | None] = mapped_column(Text)
    mandate_type: Mapped[str] = mapped_column(VARCHAR(20), nullable=False, default="solo")
    agent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(VARCHAR(20), nullable=False, default="actif")
    notary_referral_fee: Mapped[float | None] = mapped_column(Numeric(8, 2))
    notary_referral_at: Mapped[Any] = mapped_column(DateTime(timezone=True), nullable=True)
    sale_price_final: Mapped[float | None] = mapped_column(Numeric(14, 2))
    sold_at: Mapped[Any] = mapped_column(DateTime(timezone=True), nullable=True)
    address: Mapped[str | None] = mapped_column(VARCHAR(300))
    city: Mapped[str | None] = mapped_column(VARCHAR(100))
    surface_m2: Mapped[float | None] = mapped_column(Numeric(8, 1))
    nb_rooms: Mapped[float | None] = mapped_column(Numeric(4, 1))
    year_built: Mapped[int | None] = mapped_column()
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        Index("idx_sale_mandates_owner", "owner_id"),
        {"extend_existing": True},
    )


class SaleOffer(Base):
    __tablename__ = "sale_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mandate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sale_mandates.id", ondelete="CASCADE"), nullable=False)
    buyer_name: Mapped[str | None] = mapped_column(VARCHAR(200))
    buyer_email: Mapped[str | None] = mapped_column(VARCHAR(300))
    buyer_phone: Mapped[str | None] = mapped_column(VARCHAR(30))
    offer_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    counter_offer_price: Mapped[float | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(VARCHAR(20), nullable=False, default="recu")
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_sale_offers_mandate", "mandate_id"),
        {"extend_existing": True},
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class EstimateRequest(BaseModel):
    address: str
    city: str
    surface_m2: float
    nb_rooms: float
    year_built: int | None = None
    description: str | None = None
    mandate_type: str = "solo"   # solo | agency


class EstimateResponse(BaseModel):
    estimate_low: float
    estimate_high: float
    estimate_mid: float
    rapport: str
    disclaimer: str
    mandate_type: str


class MandateCreate(BaseModel):
    address: str
    city: str
    surface_m2: float
    nb_rooms: float
    year_built: int | None = None
    description: str | None = None
    asking_price: float | None = None
    ia_estimate: float | None = None
    ia_estimate_report: str | None = None
    mandate_type: str = "solo"
    property_id: str | None = None


class MandateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    address: str | None
    city: str | None
    surface_m2: float | None
    nb_rooms: float | None
    year_built: int | None
    description: str | None
    asking_price: float | None
    ia_estimate: float | None
    ia_estimate_report: str | None
    mandate_type: str
    status: str
    notary_referral_fee: float | None
    sale_price_final: float | None
    sold_at: Any
    created_at: Any


class OfferCreate(BaseModel):
    buyer_name: str | None = None
    buyer_email: str | None = None
    buyer_phone: str | None = None
    offer_price: float
    message: str | None = None


class OfferAction(BaseModel):
    action: str           # accept | refuse | counter
    counter_price: float | None = None


class OfferRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    buyer_name: str | None
    buyer_email: str | None
    buyer_phone: str | None
    offer_price: float
    counter_offer_price: float | None
    status: str
    message: str | None
    created_at: Any


class SoldRequest(BaseModel):
    sale_price_final: float
    notary_referral_fee: float | None = None   # CHF 200–400


# ── AI Estimate ───────────────────────────────────────────────────────────────

@router.post("/estimate", response_model=EstimateResponse)
async def estimate_property(body: EstimateRequest, user: AuthDep):
    """IA estimation avec disclaimer obligatoire — gratuit, pas de mandat requis."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI service unavailable")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt = f"""Tu es un expert immobilier suisse. Estime la valeur marchande de ce bien.

Bien :
- Adresse : {body.address}, {body.city}
- Surface : {body.surface_m2} m²
- Pièces : {body.nb_rooms}
- Année de construction : {body.year_built or "non précisée"}
- Description : {body.description or "aucune"}
- Type de mandat souhaité : {body.mandate_type}

Fournis :
1. Fourchette de prix (bas / milieu / haut) en CHF
2. Analyse des facteurs positifs et négatifs
3. Comparaison avec le marché local
4. Conseils pour optimiser la vente (solo ou via agence selon le type demandé)
{"5. Avantages du mandat via agence (commission 3-5%, visibilité, réseau notaires)" if body.mandate_type == "agency" else "5. Avantages de la vente solo (économie commission, contrôle total) + services Althy"}

Format de réponse :
FOURCHETTE: CHF [bas] – CHF [haut] (milieu CHF [mid])
ANALYSE: [2-3 paragraphes]"""

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    rapport = msg.content[0].text if msg.content else ""

    # Parse estimate from response
    import re
    fourchette_match = re.search(r"CHF\s*([\d\s']+)\s*[–-]\s*CHF\s*([\d\s']+).*?CHF\s*([\d\s']+)", rapport)
    def parse_chf(s: str) -> float:
        return float(s.replace("'", "").replace(" ", "")) if s else 0.0

    if fourchette_match:
        low  = parse_chf(fourchette_match.group(1))
        high = parse_chf(fourchette_match.group(2))
        mid  = parse_chf(fourchette_match.group(3))
    else:
        # Fallback: estimate from surface × market price/m²
        price_m2 = 8000 if body.city.lower() in ("genève","lausanne","zurich","zürich") else 5000
        mid  = body.surface_m2 * price_m2
        low  = mid * 0.90
        high = mid * 1.15

    return EstimateResponse(
        estimate_low=round(low, -3),
        estimate_high=round(high, -3),
        estimate_mid=round(mid, -3),
        rapport=rapport,
        disclaimer=DISCLAIMER,
        mandate_type=body.mandate_type,
    )


# ── Mandates ──────────────────────────────────────────────────────────────────

@router.post("/mandates", status_code=status.HTTP_201_CREATED, response_model=MandateRead)
async def create_mandate(body: MandateCreate, db: DbDep, user: AuthDep):
    m = SaleMandate(
        owner_id=user.id,
        property_id=uuid.UUID(body.property_id) if body.property_id else None,
        address=body.address,
        city=body.city,
        surface_m2=body.surface_m2,
        nb_rooms=body.nb_rooms,
        year_built=body.year_built,
        description=body.description,
        asking_price=body.asking_price,
        ia_estimate=body.ia_estimate,
        ia_estimate_report=body.ia_estimate_report,
        ia_estimate_at=datetime.now(timezone.utc) if body.ia_estimate else None,
        mandate_type=body.mandate_type,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return MandateRead.model_validate(m)


@router.get("/mandates", response_model=dict)
async def list_mandates(db: DbDep, user: AuthDep):
    result = await db.execute(
        select(SaleMandate)
        .where(SaleMandate.owner_id == user.id, SaleMandate.is_active == True)
        .order_by(SaleMandate.created_at.desc())
    )
    mandates = result.scalars().all()
    return {"items": [MandateRead.model_validate(m) for m in mandates]}


@router.get("/mandates/{mandate_id}", response_model=dict)
async def get_mandate(mandate_id: uuid.UUID, db: DbDep, user: AuthDep):
    result = await db.execute(
        select(SaleMandate).where(SaleMandate.id == mandate_id, SaleMandate.owner_id == user.id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Mandat non trouvé")

    offers_result = await db.execute(
        select(SaleOffer).where(SaleOffer.mandate_id == mandate_id).order_by(SaleOffer.created_at.desc())
    )
    offers = offers_result.scalars().all()

    return {
        "mandate": MandateRead.model_validate(m),
        "offers": [OfferRead.model_validate(o) for o in offers],
        "disclaimer": DISCLAIMER,
    }


@router.patch("/mandates/{mandate_id}", response_model=MandateRead)
async def update_mandate(mandate_id: uuid.UUID, body: dict, db: DbDep, user: AuthDep):
    result = await db.execute(
        select(SaleMandate).where(SaleMandate.id == mandate_id, SaleMandate.owner_id == user.id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Mandat non trouvé")
    allowed = {"asking_price", "mandate_type", "description", "status"}
    for k, v in body.items():
        if k in allowed:
            setattr(m, k, v)
    m.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(m)
    return MandateRead.model_validate(m)


# ── Offers ────────────────────────────────────────────────────────────────────

@router.post("/mandates/{mandate_id}/offers", status_code=status.HTTP_201_CREATED, response_model=OfferRead)
async def add_offer(mandate_id: uuid.UUID, body: OfferCreate, db: DbDep, user: AuthDep):
    result = await db.execute(
        select(SaleMandate).where(SaleMandate.id == mandate_id, SaleMandate.owner_id == user.id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Mandat non trouvé")

    offer = SaleOffer(
        mandate_id=mandate_id,
        buyer_name=body.buyer_name,
        buyer_email=body.buyer_email,
        buyer_phone=body.buyer_phone,
        offer_price=body.offer_price,
        message=body.message,
    )
    db.add(offer)
    # Update mandate status to "offre"
    if m.status == "actif":
        m.status = "offre"
    await db.commit()
    await db.refresh(offer)
    return OfferRead.model_validate(offer)


@router.post("/mandates/{mandate_id}/offers/{offer_id}/action", response_model=OfferRead)
async def offer_action(
    mandate_id: uuid.UUID,
    offer_id: uuid.UUID,
    body: OfferAction,
    db: DbDep,
    user: AuthDep,
):
    result = await db.execute(
        select(SaleOffer)
        .join(SaleMandate, SaleOffer.mandate_id == SaleMandate.id)
        .where(SaleOffer.id == offer_id, SaleMandate.owner_id == user.id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(404, "Offre non trouvée")

    if body.action == "accept":
        offer.status = "accepte"
    elif body.action == "refuse":
        offer.status = "refuse"
    elif body.action == "counter":
        if not body.counter_price:
            raise HTTPException(400, "counter_price requis")
        offer.status = "contre_offre"
        offer.counter_offer_price = body.counter_price
    else:
        raise HTTPException(400, "action invalide: accept | refuse | counter")

    offer.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(offer)
    return OfferRead.model_validate(offer)


@router.post("/mandates/{mandate_id}/sold", response_model=MandateRead)
async def mark_sold(mandate_id: uuid.UUID, body: SoldRequest, db: DbDep, user: AuthDep):
    """Marque le bien comme vendu + enregistre le referral notaire optionnel."""
    result = await db.execute(
        select(SaleMandate).where(SaleMandate.id == mandate_id, SaleMandate.owner_id == user.id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Mandat non trouvé")

    m.status = "vendu"
    m.sale_price_final = body.sale_price_final
    m.sold_at = datetime.now(timezone.utc)
    if body.notary_referral_fee:
        if not 200 <= body.notary_referral_fee <= 400:
            raise HTTPException(400, "Referral notaire: CHF 200–400 uniquement")
        m.notary_referral_fee = body.notary_referral_fee
        m.notary_referral_at = datetime.now(timezone.utc)
    m.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(m)
    return MandateRead.model_validate(m)


# ── Agency mandates view (agences voient les mandats "agency" du marché) ─────

@router.get("/agency-mandates")
async def list_agency_mandates(db: DbDep, user: AuthDep):
    """Liste les mandats en mode 'agency' — visibles par les agences premium."""
    result = await db.execute(
        select(SaleMandate)
        .where(
            SaleMandate.mandate_type == "agency",
            SaleMandate.status.in_(["actif", "offre"]),
            SaleMandate.is_active == True,
        )
        .order_by(SaleMandate.created_at.desc())
        .limit(100)
    )
    mandates = result.scalars().all()
    return {"items": [MandateRead.model_validate(m) for m in mandates]}
