from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.services.company_service import CompanyService
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/", response_model=list[CompanyRead])
async def list_companies(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = CompanyService(db)
    return await service.list(owner_id=user_id, page=page, size=size)


@router.post("/", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = CompanyService(db)
    return await service.create(payload, owner_id=user_id)


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = CompanyService(db)
    company = await service.get(company_id, owner_id=user_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company


@router.patch("/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: str,
    payload: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = CompanyService(db)
    company = await service.update(company_id, payload, owner_id=user_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company
