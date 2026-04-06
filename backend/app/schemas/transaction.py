from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal["rent", "commission", "deposit", "service", "quote"]
TransactionStatus = Literal["pending", "paid", "late", "cancelled"]


class TransactionCreate(BaseModel):
    contract_id: str | None = None
    property_id: str | None = None
    tenant_id: str | None = None
    type: TransactionType
    amount: float = Field(..., gt=0)
    due_date: datetime | None = None
    notes: str | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference: str
    owner_id: str
    contract_id: str | None
    property_id: str | None
    tenant_id: str | None
    type: str
    status: str
    amount: float
    commission_front_pct: float | None
    commission_back_pct: float | None
    commission_amount: float | None
    due_date: datetime | None
    paid_at: datetime | None
    notes: str | None
    is_active: bool
    created_at: datetime


class PaginatedTransactions(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    size: int
    pages: int


class MonthlyRevenue(BaseModel):
    month: str     # "2025-01"
    amount: float
    count: int


class RevenueStats(BaseModel):
    total: float
    paid_count: int
    pending_count: int
    late_count: int
    by_month: list[MonthlyRevenue]


# ── Dashboard schemas ──────────────────────────────────────────────────────────

class OwnerDashboard(BaseModel):
    revenue_current_month: float
    revenue_prev_month: float
    occupancy_rate: float          # 0–100 %
    active_contracts: int
    pending_rents: int
    late_rents: int
    total_properties: int
    recent_transactions: list[TransactionRead]


class AgencyDashboard(BaseModel):
    portfolio_count: int
    active_contracts: int
    total_revenue_ytd: float
    commissions_ytd: float
    pending_rents: int
    occupancy_rate: float
    recent_transactions: list[TransactionRead]
