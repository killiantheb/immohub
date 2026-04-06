from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.transaction import AgencyDashboard, OwnerDashboard
from app.services.transaction_service import TransactionService

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/owner", response_model=OwnerDashboard, summary="KPIs propriétaire")
async def owner_dashboard(current_user: AuthUserDep, db: DbDep) -> OwnerDashboard:
    """Revenue, occupancy rate, pending/late rents for the current owner."""
    return await TransactionService(db).owner_dashboard(current_user=current_user)


@router.get("/agency", response_model=AgencyDashboard, summary="KPIs agence")
async def agency_dashboard(current_user: AuthUserDep, db: DbDep) -> AgencyDashboard:
    """Portfolio stats, YTD revenue and commissions for an agency user."""
    return await TransactionService(db).agency_dashboard(current_user=current_user)
