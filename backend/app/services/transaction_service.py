"""Transaction service — CRUD, mark-paid, revenue stats, monthly generation."""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.models.transaction import Transaction
from app.schemas.transaction import (
    AgencyDashboard,
    MonthlyRevenue,
    OwnerDashboard,
    PaginatedTransactions,
    RevenueStats,
    TransactionCreate,
    TransactionRead,
)
from fastapi import HTTPException, status
from sqlalchemy import and_, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.user import User


def _ref() -> str:
    ts = datetime.now(UTC).strftime("%Y%m%d")
    uid = str(uuid.uuid4())[:6].upper()
    return f"TXN-{ts}-{uid}"


def _can_write(tx: Transaction, user: User) -> bool:
    if user.role == "super_admin":
        return True
    return tx.owner_id == user.id


class TransactionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── List ──────────────────────────────────────────────────────────────────

    async def list(
        self,
        current_user: User,
        page: int = 1,
        size: int = 20,
        property_id: str | None = None,
        contract_id: str | None = None,
        owner_id: str | None = None,
        month: str | None = None,  # "2025-01"
        tx_status: str | None = None,
        tx_type: str | None = None,
    ) -> PaginatedTransactions:
        q = select(Transaction).where(Transaction.is_active.is_(True))

        if current_user.role not in ("super_admin",):
            q = q.where(
                (Transaction.owner_id == current_user.id)
                | (Transaction.tenant_id == current_user.id)
            )
        elif owner_id:
            try:
                q = q.where(Transaction.owner_id == uuid.UUID(owner_id))
            except ValueError:
                pass

        if property_id:
            try:
                q = q.where(Transaction.property_id == uuid.UUID(property_id))
            except ValueError:
                pass
        if contract_id:
            try:
                q = q.where(Transaction.contract_id == uuid.UUID(contract_id))
            except ValueError:
                pass
        if tx_status:
            q = q.where(Transaction.status == tx_status)
        if tx_type:
            q = q.where(Transaction.type == tx_type)
        if month:
            try:
                year, mo = int(month[:4]), int(month[5:7])
                q = q.where(
                    and_(
                        extract("year", Transaction.due_date) == year,
                        extract("month", Transaction.due_date) == mo,
                    )
                )
            except (ValueError, IndexError):
                pass

        total: int = (
            await self.db.execute(select(func.count()).select_from(q.subquery()))
        ).scalar_one()

        rows = (
            (
                await self.db.execute(
                    q.order_by(
                        Transaction.due_date.desc().nulls_last(), Transaction.created_at.desc()
                    )
                    .offset((page - 1) * size)
                    .limit(size)
                )
            )
            .scalars()
            .all()
        )

        return PaginatedTransactions(
            items=[TransactionRead.model_validate(r) for r in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    # ── Get ───────────────────────────────────────────────────────────────────

    async def get(self, tx_id: str, current_user: User) -> Transaction | None:
        try:
            tid = uuid.UUID(tx_id)
        except ValueError:
            return None
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == tid, Transaction.is_active.is_(True))
        )
        tx = result.scalar_one_or_none()
        if tx is None:
            return None
        if not _can_write(tx, current_user) and tx.tenant_id != current_user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        return tx

    # ── Create ────────────────────────────────────────────────────────────────

    async def create(self, payload: TransactionCreate, current_user: User) -> Transaction:
        tx = Transaction(
            reference=_ref(),
            owner_id=current_user.id,
            contract_id=uuid.UUID(payload.contract_id) if payload.contract_id else None,
            property_id=uuid.UUID(payload.property_id) if payload.property_id else None,
            tenant_id=uuid.UUID(payload.tenant_id) if payload.tenant_id else None,
            type=payload.type,
            amount=payload.amount,
            due_date=payload.due_date,
            notes=payload.notes,
        )
        self.db.add(tx)
        await self.db.flush()
        await self.db.refresh(tx)
        return tx

    # ── Mark paid ─────────────────────────────────────────────────────────────

    async def mark_paid(self, tx_id: str, current_user: User) -> Transaction:
        tx = await self.get(tx_id, current_user)
        if tx is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction introuvable")
        if not _can_write(tx, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        if tx.status == "paid":
            raise HTTPException(status.HTTP_409_CONFLICT, "Transaction déjà marquée comme payée")

        tx.status = "paid"
        tx.paid_at = datetime.now(UTC)

        # Auto-calculate 3% commission if not set
        if tx.type == "rent" and tx.commission_amount is None:
            tx.commission_front_pct = 3.0
            tx.commission_amount = float(tx.amount) * 0.03

        await self.db.flush()
        await self.db.refresh(tx)
        return tx

    # ── Revenue stats ─────────────────────────────────────────────────────────

    async def get_stats(self, current_user: User, months: int = 12) -> RevenueStats:
        base_q = select(Transaction).where(
            Transaction.is_active.is_(True),
            Transaction.type == "rent",
        )
        if current_user.role != "super_admin":
            base_q = base_q.where(Transaction.owner_id == current_user.id)

        rows = (await self.db.execute(base_q)).scalars().all()

        paid = [r for r in rows if r.status == "paid"]
        pending = [r for r in rows if r.status == "pending"]
        late = [r for r in rows if r.status == "late"]

        # Group paid by month
        monthly: dict[str, dict] = {}
        for r in paid:
            key = r.due_date.strftime("%Y-%m") if r.due_date else r.created_at.strftime("%Y-%m")
            if key not in monthly:
                monthly[key] = {"amount": 0.0, "count": 0}
            monthly[key]["amount"] += float(r.amount)
            monthly[key]["count"] += 1

        by_month = [
            MonthlyRevenue(month=k, amount=v["amount"], count=v["count"])
            for k, v in sorted(monthly.items())
        ][-months:]

        return RevenueStats(
            total=sum(float(r.amount) for r in paid),
            paid_count=len(paid),
            pending_count=len(pending),
            late_count=len(late),
            by_month=by_month,
        )

    # ── Dashboard KPIs ────────────────────────────────────────────────────────

    async def owner_dashboard(self, current_user: User) -> OwnerDashboard:
        from app.models.contract import Contract
        from app.models.property import Property

        now = datetime.now(UTC)
        cur_year, cur_month = now.year, now.month
        prev_month = cur_month - 1 if cur_month > 1 else 12
        prev_year = cur_year if cur_month > 1 else cur_year - 1

        # Revenue current month
        rev_cur = await self._sum_paid(current_user.id, cur_year, cur_month)
        rev_prev = await self._sum_paid(current_user.id, prev_year, prev_month)

        # Active contracts
        active_q = select(func.count()).where(
            Contract.owner_id == current_user.id,
            Contract.status == "active",
            Contract.is_active.is_(True),
        )
        active_contracts: int = (await self.db.execute(active_q)).scalar_one()

        # Total properties
        prop_q = select(func.count()).where(
            Property.owner_id == current_user.id,
            Property.is_active.is_(True),
        )
        total_props: int = (await self.db.execute(prop_q)).scalar_one()

        # Pending / late rents
        pending_q = select(func.count()).where(
            Transaction.owner_id == current_user.id,
            Transaction.type == "rent",
            Transaction.status == "pending",
            Transaction.is_active.is_(True),
        )
        late_q = select(func.count()).where(
            Transaction.owner_id == current_user.id,
            Transaction.type == "rent",
            Transaction.status == "late",
            Transaction.is_active.is_(True),
        )
        pending_rents: int = (await self.db.execute(pending_q)).scalar_one()
        late_rents: int = (await self.db.execute(late_q)).scalar_one()

        # Occupancy rate = active contracts / total properties
        occupancy = (active_contracts / total_props * 100) if total_props > 0 else 0.0

        # Recent transactions (last 5)
        recent_rows = (
            (
                await self.db.execute(
                    select(Transaction)
                    .where(Transaction.owner_id == current_user.id, Transaction.is_active.is_(True))
                    .order_by(Transaction.created_at.desc())
                    .limit(5)
                )
            )
            .scalars()
            .all()
        )

        return OwnerDashboard(
            revenue_current_month=rev_cur,
            revenue_prev_month=rev_prev,
            occupancy_rate=round(occupancy, 1),
            active_contracts=active_contracts,
            pending_rents=pending_rents,
            late_rents=late_rents,
            total_properties=total_props,
            recent_transactions=[TransactionRead.model_validate(r) for r in recent_rows],
        )

    async def agency_dashboard(self, current_user: User) -> AgencyDashboard:
        from app.models.contract import Contract
        from app.models.property import Property

        now = datetime.now(UTC)

        # Portfolio = properties managed by this agency
        prop_q = select(func.count()).where(
            Property.agency_id == current_user.id,
            Property.is_active.is_(True),
        )
        portfolio_count: int = (await self.db.execute(prop_q)).scalar_one()

        # Active contracts
        active_q = select(func.count()).where(
            Contract.agency_id == current_user.id,
            Contract.status == "active",
            Contract.is_active.is_(True),
        )
        active_contracts: int = (await self.db.execute(active_q)).scalar_one()

        # Revenue YTD (all rents managed by this agency)
        ytd_q = select(func.sum(Transaction.amount)).where(
            Transaction.owner_id == current_user.id,
            Transaction.type == "rent",
            Transaction.status == "paid",
            extract("year", Transaction.paid_at) == now.year,
            Transaction.is_active.is_(True),
        )
        total_ytd: float = float((await self.db.execute(ytd_q)).scalar_one() or 0)

        # Commissions YTD
        comm_q = select(func.sum(Transaction.commission_amount)).where(
            Transaction.owner_id == current_user.id,
            Transaction.commission_amount.isnot(None),
            Transaction.status == "paid",
            extract("year", Transaction.paid_at) == now.year,
            Transaction.is_active.is_(True),
        )
        commissions_ytd: float = float((await self.db.execute(comm_q)).scalar_one() or 0)

        # Pending rents
        pending_q = select(func.count()).where(
            Transaction.owner_id == current_user.id,
            Transaction.type == "rent",
            Transaction.status == "pending",
            Transaction.is_active.is_(True),
        )
        pending_rents: int = (await self.db.execute(pending_q)).scalar_one()

        occupancy = (active_contracts / portfolio_count * 100) if portfolio_count > 0 else 0.0

        recent_rows = (
            (
                await self.db.execute(
                    select(Transaction)
                    .where(Transaction.owner_id == current_user.id, Transaction.is_active.is_(True))
                    .order_by(Transaction.created_at.desc())
                    .limit(5)
                )
            )
            .scalars()
            .all()
        )

        return AgencyDashboard(
            portfolio_count=portfolio_count,
            active_contracts=active_contracts,
            total_revenue_ytd=total_ytd,
            commissions_ytd=commissions_ytd,
            pending_rents=pending_rents,
            occupancy_rate=round(occupancy, 1),
            recent_transactions=[TransactionRead.model_validate(r) for r in recent_rows],
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _sum_paid(self, owner_id: uuid.UUID, year: int, month: int) -> float:
        q = select(func.sum(Transaction.amount)).where(
            Transaction.owner_id == owner_id,
            Transaction.type == "rent",
            Transaction.status == "paid",
            extract("year", Transaction.paid_at) == year,
            extract("month", Transaction.paid_at) == month,
            Transaction.is_active.is_(True),
        )
        result = (await self.db.execute(q)).scalar_one()
        return float(result or 0)
