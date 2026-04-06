from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.transaction import (
    PaginatedTransactions,
    RevenueStats,
    TransactionCreate,
    TransactionRead,
)
from app.services.transaction_service import TransactionService

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/", response_model=PaginatedTransactions)
async def list_transactions(
    current_user: AuthUserDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    property_id: Optional[str] = Query(None),
    contract_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    month: Optional[str] = Query(None, description="Format YYYY-MM"),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
) -> PaginatedTransactions:
    return await TransactionService(db).list(
        current_user=current_user,
        page=page,
        size=size,
        property_id=property_id,
        contract_id=contract_id,
        owner_id=owner_id,
        month=month,
        tx_status=status,
        tx_type=type,
    )


@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> TransactionRead:
    tx = await TransactionService(db).create(payload, current_user=current_user)
    return TransactionRead.model_validate(tx)


@router.get("/stats", response_model=RevenueStats)
async def revenue_stats(
    current_user: AuthUserDep,
    db: DbDep,
    months: int = Query(12, ge=1, le=60),
) -> RevenueStats:
    """Revenue stats aggregated by month for the last N months."""
    return await TransactionService(db).get_stats(current_user=current_user, months=months)


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(
    transaction_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> TransactionRead:
    tx = await TransactionService(db).get(transaction_id, current_user=current_user)
    if tx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction introuvable")
    return TransactionRead.model_validate(tx)


@router.post("/{transaction_id}/mark-paid", response_model=TransactionRead)
async def mark_paid(
    transaction_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> TransactionRead:
    tx = await TransactionService(db).mark_paid(transaction_id, current_user=current_user)
    return TransactionRead.model_validate(tx)


@router.post("/generate-monthly")
async def generate_monthly_rents(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Trigger the monthly rent generation Celery task."""
    if current_user.role not in ("owner", "agency", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    from app.tasks.rent_tasks import generate_monthly_rents as celery_task
    task = celery_task.delay()
    return {"task_id": task.id, "status": "queued"}
