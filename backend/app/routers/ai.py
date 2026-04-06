"""AI router — all endpoints under /api/v1/ai"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.ai_service import (
    PaymentAlert,
    QuoteRecommendation,
    TenantScore,
    chat_stream,
    detect_payment_anomalies,
    generate_briefing,
    generate_listing_description,
    recommend_best_quote,
    score_tenant_application,
)

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class GenerateListingRequest(BaseModel):
    property_id: str


class GenerateListingResponse(BaseModel):
    description: str


class ScoreTenantRequest(BaseModel):
    tenant_data: dict


class ScoreTenantResponse(BaseModel):
    score: int
    recommendation: str
    risk_flags: list[str]
    summary: str


class QuoteItem(BaseModel):
    company_name: str
    price: float
    rating: float | None = None
    delay_days: int | None = None
    description: str | None = None


class RecommendQuoteRequest(BaseModel):
    quotes: list[QuoteItem]


class RecommendQuoteResponse(BaseModel):
    best_quote_index: int
    runner_up_index: int | None
    justification: str


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


class AnomalyResponse(BaseModel):
    type: str
    severity: str
    description: str
    property_id: str | None
    tenant_id: str | None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate-listing", response_model=GenerateListingResponse)
async def generate_listing(
    payload: GenerateListingRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> GenerateListingResponse:
    """Generate an SEO property description via Claude."""
    import uuid
    from sqlalchemy import select
    from app.models.property import Property

    try:
        pid = uuid.UUID(payload.property_id)
    except ValueError:
        raise HTTPException(422, "property_id invalide")

    result = await db.execute(select(Property).where(Property.id == pid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(404, "Bien introuvable")

    try:
        description = await generate_listing_description(prop, db, str(current_user.id))
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return GenerateListingResponse(description=description)


@router.post("/score-tenant", response_model=ScoreTenantResponse)
async def score_tenant(
    payload: ScoreTenantRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> ScoreTenantResponse:
    """Score a tenant application 0-100."""
    try:
        result: TenantScore = await score_tenant_application(
            payload.tenant_data, db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return ScoreTenantResponse(
        score=result.score,
        recommendation=result.recommendation,
        risk_flags=result.risk_flags,
        summary=result.summary,
    )


@router.post("/recommend-quote", response_model=RecommendQuoteResponse)
async def recommend_quote(
    payload: RecommendQuoteRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> RecommendQuoteResponse:
    """Return the best contractor quote with justification."""
    if len(payload.quotes) < 2:
        raise HTTPException(422, "Au moins 2 devis requis pour une comparaison")

    quotes_dicts = [q.model_dump() for q in payload.quotes]
    try:
        result: QuoteRecommendation = await recommend_best_quote(
            quotes_dicts, db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return RecommendQuoteResponse(
        best_quote_index=result.best_quote_index,
        runner_up_index=result.runner_up_index,
        justification=result.justification,
    )


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> StreamingResponse:
    """
    Conversational copilot — streams SSE events.
    Each event: data: {"text": "..."}\n\n
    Final event: data: [DONE]\n\n
    """
    context = {**payload.context, "role": current_user.role}

    async def _generate():
        async for chunk in chat_stream(
            message=payload.message,
            context=context,
            db=db,
            user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/briefing")
async def get_briefing(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Generate a personalised Cathy home screen briefing based on real data."""
    import uuid as uuid_lib
    from datetime import date, timedelta
    from sqlalchemy import select, and_
    from app.models.contract import Contract
    from app.models.property import Property as PropertyModel
    from app.models.opener import Mission
    from app.models.rfq import RFQ
    from app.models.transaction import Transaction as Txn

    role = current_user.role
    first_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context: dict = {}

    try:
        today = date.today()
        uid = current_user.id

        if role in ("owner", "agency", "super_admin"):
            # Late / pending rent
            res = await db.execute(
                select(Txn).where(
                    Txn.owner_id == uid,
                    Txn.status.in_(["pending", "late"]),
                    Txn.due_date <= today,
                    Txn.is_active.is_(True),
                ).limit(5)
            )
            late = res.scalars().all()
            context["late_transactions"] = [
                {
                    "id": str(t.id),
                    "amount": float(t.amount),
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "days_late": (today - t.due_date).days if t.due_date else 0,
                    "reference": t.reference,
                }
                for t in late
            ]
            # Expiring contracts (60 days)
            res = await db.execute(
                select(Contract).where(
                    Contract.owner_id == uid,
                    Contract.status == "active",
                    Contract.end_date.isnot(None),
                    Contract.end_date <= today + timedelta(days=60),
                    Contract.end_date >= today,
                ).limit(3)
            )
            expiring = res.scalars().all()
            context["expiring_contracts"] = [
                {
                    "id": str(c.id),
                    "end_date": c.end_date.isoformat() if c.end_date else None,
                    "days_left": (c.end_date - today).days if c.end_date else 0,
                    "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0,
                }
                for c in expiring
            ]
            # Vacant properties
            res = await db.execute(
                select(PropertyModel).where(
                    PropertyModel.owner_id == uid,
                    PropertyModel.status == "available",
                    PropertyModel.is_active.is_(True),
                ).limit(3)
            )
            vacant = res.scalars().all()
            context["vacant_properties"] = [
                {"id": str(p.id), "address": p.address, "city": p.city,
                 "monthly_rent": float(p.monthly_rent) if p.monthly_rent else 0}
                for p in vacant
            ]

        elif role == "opener":
            res = await db.execute(
                select(Mission).where(
                    Mission.status == "pending",
                    Mission.opener_id.is_(None),
                ).limit(5)
            )
            missions = res.scalars().all()
            context["available_missions"] = [
                {
                    "id": str(m.id),
                    "type": m.type,
                    "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
                    "price": float(m.price) if m.price else 0,
                }
                for m in missions
            ]

        elif role == "tenant":
            res = await db.execute(
                select(Contract).where(
                    Contract.tenant_id == uid,
                    Contract.status == "active",
                ).limit(2)
            )
            contracts = res.scalars().all()
            context["active_contracts"] = [
                {
                    "id": str(c.id),
                    "end_date": c.end_date.isoformat() if c.end_date else None,
                    "monthly_rent": float(c.monthly_rent) if c.monthly_rent else 0,
                }
                for c in contracts
            ]
            res = await db.execute(
                select(Txn).where(
                    Txn.tenant_id == uid,
                    Txn.status == "pending",
                    Txn.due_date >= today,
                ).order_by(Txn.due_date).limit(3)
            )
            upcoming = res.scalars().all()
            context["upcoming_payments"] = [
                {
                    "id": str(t.id),
                    "amount": float(t.amount),
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                }
                for t in upcoming
            ]

        elif role == "company":
            res = await db.execute(
                select(RFQ).where(RFQ.status == "published").limit(5)
            )
            rfqs = res.scalars().all()
            context["open_rfqs"] = [
                {
                    "id": str(r.id),
                    "title": r.title,
                    "category": r.category,
                    "city": r.city,
                    "budget_min": float(r.budget_min) if r.budget_min else 0,
                    "budget_max": float(r.budget_max) if r.budget_max else 0,
                    "urgency": r.urgency,
                }
                for r in rfqs
            ]

    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Briefing context fetch failed: %s", exc)

    try:
        return await generate_briefing(
            first_name=first_name,
            role=role,
            context=context,
            db=db,
            user_id=str(current_user.id),
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))


@router.get("/anomalies", response_model=list[AnomalyResponse])
async def anomalies(
    current_user: AuthUserDep,
    db: DbDep,
) -> list[AnomalyResponse]:
    """Detect payment anomalies for the current owner."""
    try:
        alerts: list[PaymentAlert] = await detect_payment_anomalies(
            str(current_user.id), db, str(current_user.id)
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc))

    return [
        AnomalyResponse(
            type=a.type,
            severity=a.severity,
            description=a.description,
            property_id=a.property_id,
            tenant_id=a.tenant_id,
        )
        for a in alerts
    ]
