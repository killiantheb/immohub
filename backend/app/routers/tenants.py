"""
Tenant router — dashboard personnel du locataire.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.contract import Contract
from app.models.property import Property
from app.models.transaction import Transaction
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class TenantDashboard(BaseModel):
    next_rent_due: str | None
    next_rent_amount: float | None
    currency: str
    property_address: str | None
    lease_end_date: str | None
    status: str  # 'ok' | 'late' | 'pending'
    pending_transaction_id: str | None


@router.get("/me", response_model=TenantDashboard)
async def tenant_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TenantDashboard:
    """Renvoie le prochain loyer, le statut et les infos du bail du locataire connecté."""
    if current_user.role != "tenant":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux locataires")

    # Bail actif le plus récent
    result = await db.execute(
        select(Contract)
        .where(and_(Contract.tenant_id == current_user.id, Contract.status == "active"))
        .order_by(Contract.start_date.desc())
        .limit(1)
    )
    contract = result.scalar_one_or_none()

    if not contract:
        return TenantDashboard(
            next_rent_due=None,
            next_rent_amount=None,
            currency="CHF",
            property_address=None,
            lease_end_date=None,
            status="pending",
            pending_transaction_id=None,
        )

    # Adresse du bien
    prop_result = await db.execute(select(Property).where(Property.id == contract.property_id))
    prop = prop_result.scalar_one_or_none()
    address = f"{prop.address}, {prop.city}" if prop else None

    # Prochain loyer non payé
    now = datetime.now(timezone.utc)
    tx_result = await db.execute(
        select(Transaction)
        .where(
            and_(
                Transaction.contract_id == contract.id,
                Transaction.type == "rent",
                Transaction.status.in_(["pending", "late"]),
            )
        )
        .order_by(Transaction.due_date.asc())
        .limit(1)
    )
    tx = tx_result.scalar_one_or_none()

    if tx:
        due = tx.due_date
        is_late = due is not None and due.replace(tzinfo=timezone.utc) < now
        return TenantDashboard(
            next_rent_due=due.isoformat() if due else None,
            next_rent_amount=float(tx.amount),
            currency="CHF",
            property_address=address,
            lease_end_date=contract.end_date.isoformat() if contract.end_date else None,
            status="late" if is_late else "pending",
            pending_transaction_id=str(tx.id),
        )

    # Bail actif, tout est à jour
    return TenantDashboard(
        next_rent_due=None,
        next_rent_amount=float(contract.monthly_rent) if contract.monthly_rent else None,
        currency="CHF",
        property_address=address,
        lease_end_date=contract.end_date.isoformat() if contract.end_date else None,
        status="ok",
        pending_transaction_id=None,
    )
