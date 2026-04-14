"""Admin router — /api/v1/admin, super_admin role only."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import require_roles
from app.models.audit_log import AuditLog
from app.models.contract import Contract
from app.models.property import Property
from app.models.transaction import Transaction
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

SuperAdmin = require_roles("super_admin")
DbDep = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ───────────────────────────────────────────────────────────────────


class PlatformStats(BaseModel):
    total_users: int
    users_by_role: dict[str, int]
    new_users_this_month: int
    total_properties: int
    active_properties: int
    active_contracts: int
    revenue_total: float
    revenue_this_month: float
    commissions_total: float
    commissions_this_month: float
    pending_transactions: int
    late_transactions: int


class AdminUser(BaseModel):
    id: str
    email: str
    role: str
    first_name: str | None
    last_name: str | None
    phone: str | None
    is_verified: bool
    is_active: bool
    created_at: str


class PaginatedUsers(BaseModel):
    items: list[AdminUser]
    total: int
    page: int
    size: int
    pages: int


class UpdateUserPayload(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class AdminTransaction(BaseModel):
    id: str
    reference: str
    type: str
    status: str
    amount: float
    commission_amount: float | None
    owner_id: str
    property_id: str | None
    due_date: str | None
    paid_at: str | None
    created_at: str


class PaginatedTransactions(BaseModel):
    items: list[AdminTransaction]
    total: int
    page: int
    size: int
    pages: int


class MonthlyRevenue(BaseModel):
    month: str
    revenue: float
    commissions: float
    transaction_count: int


class AdminAuditLog(BaseModel):
    id: str
    user_id: str | None
    action: str
    resource_type: str
    resource_id: str | None
    ip_address: str | None
    created_at: str


class PaginatedAuditLogs(BaseModel):
    items: list[AdminAuditLog]
    total: int
    page: int
    size: int
    pages: int


# ── 1. Platform KPIs ─────────────────────────────────────────────────────────


@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    _: Annotated[User, SuperAdmin],
    db: DbDep,
) -> PlatformStats:
    """Global platform KPIs — counts, revenue, commissions."""

    # User stats
    total_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active.is_(True)))
    ).scalar_one()

    role_rows = (
        await db.execute(
            select(User.role, func.count()).where(User.is_active.is_(True)).group_by(User.role)
        )
    ).all()
    users_by_role = {row[0]: row[1] for row in role_rows}

    new_users_this_month = (
        await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.is_active.is_(True),
                func.date_trunc("month", User.created_at) == func.date_trunc("month", func.now()),
            )
        )
    ).scalar_one()

    # Property stats
    total_properties = (
        await db.execute(
            select(func.count()).select_from(Property).where(Property.is_active.is_(True))
        )
    ).scalar_one()

    active_properties = (
        await db.execute(
            select(func.count())
            .select_from(Property)
            .where(
                Property.is_active.is_(True),
                Property.status.in_(["rented", "available"]),
            )
        )
    ).scalar_one()

    # Contract stats
    active_contracts = (
        await db.execute(
            select(func.count())
            .select_from(Contract)
            .where(
                Contract.is_active.is_(True),
                Contract.status == "active",
            )
        )
    ).scalar_one()

    # Revenue (paid transactions)
    rev_total_row = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.is_active.is_(True),
                Transaction.status == "paid",
            )
        )
    ).scalar_one()

    rev_month_row = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.is_active.is_(True),
                Transaction.status == "paid",
                func.date_trunc("month", Transaction.paid_at)
                == func.date_trunc("month", func.now()),
            )
        )
    ).scalar_one()

    # Commissions
    comm_total_row = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.commission_amount), 0)).where(
                Transaction.is_active.is_(True),
                Transaction.status == "paid",
                Transaction.commission_amount.isnot(None),
            )
        )
    ).scalar_one()

    comm_month_row = (
        await db.execute(
            select(func.coalesce(func.sum(Transaction.commission_amount), 0)).where(
                Transaction.is_active.is_(True),
                Transaction.status == "paid",
                Transaction.commission_amount.isnot(None),
                func.date_trunc("month", Transaction.paid_at)
                == func.date_trunc("month", func.now()),
            )
        )
    ).scalar_one()

    pending = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.is_active.is_(True),
                Transaction.status == "pending",
            )
        )
    ).scalar_one()

    late = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.is_active.is_(True),
                Transaction.status == "late",
            )
        )
    ).scalar_one()

    return PlatformStats(
        total_users=total_users,
        users_by_role=users_by_role,
        new_users_this_month=new_users_this_month,
        total_properties=total_properties,
        active_properties=active_properties,
        active_contracts=active_contracts,
        revenue_total=float(rev_total_row),
        revenue_this_month=float(rev_month_row),
        commissions_total=float(comm_total_row),
        commissions_this_month=float(comm_month_row),
        pending_transactions=pending,
        late_transactions=late,
    )


# ── 2. Users list ─────────────────────────────────────────────────────────────


@router.get("/users", response_model=PaginatedUsers)
async def list_users(
    _: Annotated[User, SuperAdmin],
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: str | None = Query(None),
    is_verified: bool | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
) -> PaginatedUsers:
    """List all platform users with optional filters."""
    stmt = select(User)

    if role:
        stmt = stmt.where(User.role == role)
    if is_verified is not None:
        stmt = stmt.where(User.is_verified == is_verified)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            User.email.ilike(like) | User.first_name.ilike(like) | User.last_name.ilike(like)
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * size).limit(size)
    rows = (await db.execute(stmt)).scalars().all()

    return PaginatedUsers(
        items=[
            AdminUser(
                id=str(u.id),
                email=u.email,
                role=u.role,
                first_name=u.first_name,
                last_name=u.last_name,
                phone=u.phone,
                is_verified=u.is_verified,
                is_active=u.is_active,
                created_at=u.created_at.isoformat(),
            )
            for u in rows
        ],
        total=total,
        page=page,
        size=size,
        pages=max(1, -(-total // size)),
    )


# ── 3. Verify user ────────────────────────────────────────────────────────────


@router.put("/users/{user_id}/verify", response_model=AdminUser)
async def verify_user(
    user_id: uuid.UUID,
    _: Annotated[User, SuperAdmin],
    db: DbDep,
) -> AdminUser:
    """Mark a user account as verified."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")

    user.is_verified = True
    await db.flush()
    await db.refresh(user)

    return AdminUser(
        id=str(user.id),
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.patch("/users/{user_id}", response_model=AdminUser)
async def update_user(
    user_id: uuid.UUID,
    payload: UpdateUserPayload,
    _: Annotated[User, SuperAdmin],
    db: DbDep,
) -> AdminUser:
    """Update role or active status (suspend/unsuspend)."""
    valid_roles = {"super_admin", "agency", "owner", "tenant", "opener", "company"}
    if payload.role and payload.role not in valid_roles:
        raise HTTPException(422, f"Rôle invalide. Valeurs acceptées : {', '.join(valid_roles)}")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.flush()
    await db.refresh(user)

    return AdminUser(
        id=str(user.id),
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


# ── 4. All transactions ───────────────────────────────────────────────────────


@router.get("/transactions", response_model=PaginatedTransactions)
async def list_transactions(
    _: Annotated[User, SuperAdmin],
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> PaginatedTransactions:
    """All platform transactions with optional type/status filters."""
    stmt = select(Transaction).where(Transaction.is_active.is_(True))

    if type:
        stmt = stmt.where(Transaction.type == type)
    if status_filter:
        stmt = stmt.where(Transaction.status == status_filter)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Transaction.created_at.desc()).offset((page - 1) * size).limit(size)
    rows = (await db.execute(stmt)).scalars().all()

    return PaginatedTransactions(
        items=[
            AdminTransaction(
                id=str(t.id),
                reference=t.reference,
                type=t.type,
                status=t.status,
                amount=float(t.amount),
                commission_amount=float(t.commission_amount) if t.commission_amount else None,
                owner_id=str(t.owner_id),
                property_id=str(t.property_id) if t.property_id else None,
                due_date=t.due_date.isoformat() if t.due_date else None,
                paid_at=t.paid_at.isoformat() if t.paid_at else None,
                created_at=t.created_at.isoformat(),
            )
            for t in rows
        ],
        total=total,
        page=page,
        size=size,
        pages=max(1, -(-total // size)),
    )


# ── 5. Revenue by month ───────────────────────────────────────────────────────


@router.get("/revenue", response_model=list[MonthlyRevenue])
async def get_revenue(
    _: Annotated[User, SuperAdmin],
    db: DbDep,
    months: int = Query(12, ge=1, le=36),
) -> list[MonthlyRevenue]:
    """Platform revenue grouped by month (last N months)."""
    stmt = (
        select(
            func.to_char(func.date_trunc("month", Transaction.paid_at), "YYYY-MM").label("month"),
            func.coalesce(func.sum(Transaction.amount), 0).label("revenue"),
            func.coalesce(func.sum(Transaction.commission_amount), 0).label("commissions"),
            func.count().label("transaction_count"),
        )
        .where(
            Transaction.is_active.is_(True),
            Transaction.status == "paid",
            Transaction.paid_at
            >= func.date_trunc("month", func.now() - text(f"interval '{months - 1} months'")),
        )
        .group_by(func.date_trunc("month", Transaction.paid_at))
        .order_by(func.date_trunc("month", Transaction.paid_at))
    )

    try:
        rows = (await db.execute(stmt)).all()
        return [
            MonthlyRevenue(
                month=row.month,
                revenue=float(row.revenue),
                commissions=float(row.commissions),
                transaction_count=row.transaction_count,
            )
            for row in rows
        ]
    except Exception:
        # Table transactions peut ne pas exister encore en DB
        await db.rollback()
        return []


# ── 6. Audit logs ─────────────────────────────────────────────────────────────


@router.get("/audit-logs", response_model=PaginatedAuditLogs)
async def list_audit_logs(
    _: Annotated[User, SuperAdmin],
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    user_id: str | None = Query(None),
) -> PaginatedAuditLogs:
    """Full platform audit trail with optional filters."""
    stmt = select(AuditLog)

    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if user_id:
        try:
            stmt = stmt.where(AuditLog.user_id == uuid.UUID(user_id))
        except ValueError:
            pass

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size)
    rows = (await db.execute(stmt)).scalars().all()

    return PaginatedAuditLogs(
        items=[
            AdminAuditLog(
                id=str(log.id),
                user_id=str(log.user_id) if log.user_id else None,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                ip_address=log.ip_address,
                created_at=log.created_at.isoformat(),
            )
            for log in rows
        ],
        total=total,
        page=page,
        size=size,
        pages=max(1, -(-total // size)),
    )
