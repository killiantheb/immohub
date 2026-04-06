from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.rfq import (
    AIQualifyRequest,
    AIQualifyResponse,
    CompanyMarketplaceRead,
    PaginatedRFQs,
    RFQCreate,
    RFQQuoteCreate,
    RFQQuoteRead,
    RFQRating,
    RFQRead,
)
from app.services.rfq_service import RFQService, qualify_need

router = APIRouter()


# ── Marketplace companies ──────────────────────────────────────────────────────

@router.get("/marketplace/companies", response_model=list[CompanyMarketplaceRead])
async def list_marketplace_companies(
    company_type: str | None = Query(None),
    city: str | None = Query(None),
    min_rating: float | None = Query(None, ge=0, le=5),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    return await svc.list_marketplace_companies(
        company_type=company_type, city=city, min_rating=min_rating, page=page, size=size
    )


# ── AI qualification ───────────────────────────────────────────────────────────

@router.post("/qualify", response_model=AIQualifyResponse)
async def qualify_rfq(
    payload: AIQualifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await qualify_need(payload.description, str(current_user.id), db)


# ── RFQ CRUD ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=RFQRead, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    payload: RFQCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.create_rfq(payload, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(str(rfq.id))
    return result


@router.get("/", response_model=PaginatedRFQs)
async def list_rfqs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    rfq_status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    return await svc.list_rfqs(current_user, page=page, size=size, rfq_status=rfq_status)


@router.get("/company/dashboard", response_model=PaginatedRFQs)
async def company_dashboard(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """RFQs where the authenticated company has submitted a quote."""
    svc = RFQService(db)
    return await svc.list_company_rfqs(current_user, page=page, size=size)


@router.get("/{rfq_id}", response_model=RFQRead)
async def get_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.get_rfq(rfq_id, current_user)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


# ── Quote lifecycle ────────────────────────────────────────────────────────────

@router.post("/{rfq_id}/quotes", response_model=RFQQuoteRead, status_code=status.HTTP_201_CREATED)
async def submit_quote(
    rfq_id: str,
    payload: RFQQuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    quote = await svc.submit_quote(rfq_id, payload, current_user)
    await db.commit()
    await db.refresh(quote)
    return RFQQuoteRead.model_validate(quote)


@router.put("/{rfq_id}/accept/{quote_id}", response_model=RFQRead)
async def accept_quote(
    rfq_id: str,
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.accept_quote(rfq_id, quote_id, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


@router.put("/{rfq_id}/complete", response_model=RFQRead)
async def complete_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.complete_rfq(rfq_id, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result


@router.post("/{rfq_id}/rate", response_model=RFQRead)
async def rate_rfq(
    rfq_id: str,
    payload: RFQRating,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    svc = RFQService(db)
    rfq = await svc.rate_rfq(rfq_id, payload, current_user)
    await db.commit()
    await db.refresh(rfq)
    result = RFQRead.model_validate(rfq)
    result.quotes = await svc._load_quotes(rfq_id)
    return result
