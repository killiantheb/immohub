"""Paramètres agence/propriétaire + export comptable fiduciaire."""

from __future__ import annotations

import csv
import io
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.agency_settings import AgencySettings
from app.models.bien import Bien
from app.models.contract import Contract
from app.models.transaction import Transaction
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]

ALLOWED_ROLES = {"agence", "proprio_solo", "super_admin"}


class AgencySettingsRead(BaseModel):
    user_id: str
    commission_location_pct: float
    commission_management_pct: float
    commission_sale_pct: float
    deposit_months: int
    default_contract_type: str
    default_notice_months: int
    default_included_charges: bool
    agency_name: str | None
    agency_address: str | None
    agency_phone: str | None
    agency_email: str | None
    agency_rc_number: str | None
    agency_da_number: str | None
    agency_website: str | None
    agency_logo_url: str | None
    agency_description: str | None
    notify_late_rent_days: int
    notify_expiry_days: int
    notify_via_email: bool
    notify_via_whatsapp: bool
    whatsapp_number: str | None
    ai_auto_actions: bool


class AgencySettingsUpdate(BaseModel):
    commission_location_pct: float | None = None
    commission_management_pct: float | None = None
    commission_sale_pct: float | None = None
    deposit_months: int | None = None
    default_contract_type: str | None = None
    default_notice_months: int | None = None
    default_included_charges: bool | None = None
    agency_name: str | None = None
    agency_address: str | None = None
    agency_phone: str | None = None
    agency_email: str | None = None
    agency_rc_number: str | None = None
    agency_da_number: str | None = None
    agency_website: str | None = None
    agency_logo_url: str | None = None
    agency_description: str | None = None
    notify_late_rent_days: int | None = None
    notify_expiry_days: int | None = None
    notify_via_email: bool | None = None
    notify_via_whatsapp: bool | None = None
    whatsapp_number: str | None = None
    ai_auto_actions: bool | None = None


def _to_read(s: AgencySettings) -> AgencySettingsRead:
    return AgencySettingsRead(
        user_id=str(s.user_id),
        commission_location_pct=float(s.commission_location_pct),
        commission_management_pct=float(s.commission_management_pct),
        commission_sale_pct=float(s.commission_sale_pct),
        deposit_months=s.deposit_months,
        default_contract_type=s.default_contract_type,
        default_notice_months=s.default_notice_months,
        default_included_charges=s.default_included_charges,
        agency_name=s.agency_name,
        agency_address=s.agency_address,
        agency_phone=s.agency_phone,
        agency_email=s.agency_email,
        agency_rc_number=s.agency_rc_number,
        agency_da_number=s.agency_da_number,
        agency_website=s.agency_website,
        agency_logo_url=s.agency_logo_url,
        agency_description=s.agency_description,
        notify_late_rent_days=s.notify_late_rent_days,
        notify_expiry_days=s.notify_expiry_days,
        notify_via_email=s.notify_via_email,
        notify_via_whatsapp=s.notify_via_whatsapp,
        whatsapp_number=s.whatsapp_number,
        ai_auto_actions=s.ai_auto_actions,
    )


async def _get_or_create(db: AsyncSession, user_id: uuid_lib.UUID) -> AgencySettings:
    result = await db.execute(select(AgencySettings).where(AgencySettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = AgencySettings(id=uuid_lib.uuid4(), user_id=user_id)
        db.add(settings)
        await db.flush()
    return settings


@router.get("/settings", response_model=AgencySettingsRead)
async def get_settings(db: DbDep, current_user: AuthUserDep) -> AgencySettingsRead:
    """Récupère les paramètres agence/propriétaire."""
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")
    s = await _get_or_create(db, current_user.id)
    await db.commit()
    return _to_read(s)


@router.put("/settings", response_model=AgencySettingsRead)
async def update_settings(
    payload: AgencySettingsUpdate,
    db: DbDep,
    current_user: AuthUserDep,
) -> AgencySettingsRead:
    """Met à jour les paramètres agence/propriétaire."""
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")
    s = await _get_or_create(db, current_user.id)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(s, field, val)
    await db.commit()
    await db.refresh(s)
    return _to_read(s)


@router.get("/accounting/export", response_model=None)
async def export_accounting(
    db: DbDep,
    current_user: AuthUserDep,
    month: str | None = Query(None, description="Format YYYY-MM, défaut = mois courant"),
    format: str = Query("csv", description="csv | json"),
):
    """Export comptable fiduciaire — loyers, commissions, charges par bien."""
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")

    now = datetime.now(timezone.utc)
    if month:
        year, m = int(month.split("-")[0]), int(month.split("-")[1])
    else:
        year, m = now.year, now.month

    period_start = datetime(year, m, 1, tzinfo=timezone.utc)
    next_m = m + 1 if m < 12 else 1
    next_y = year if m < 12 else year + 1
    period_end = datetime(next_y, next_m, 1, tzinfo=timezone.utc)

    # Récupère les transactions du mois pour cet owner/agence
    tx_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.owner_id == current_user.id,
            Transaction.due_date >= period_start,
            Transaction.due_date < period_end,
        )
        .order_by(Transaction.due_date.asc())
    )
    transactions = tx_result.scalars().all()

    # Récupère les paramètres agence pour les commissions
    s = await _get_or_create(db, current_user.id)
    await db.commit()
    commission_mgmt = float(s.commission_management_pct) / 100

    rows = []
    total_loyers = 0.0
    total_commissions = 0.0
    total_charges = 0.0

    for tx in transactions:
        prop_result = await db.execute(select(Bien).where(Bien.id == tx.bien_id))
        prop = prop_result.scalar_one_or_none()
        addr = f"{prop.adresse}, {prop.ville}" if prop else "N/A"

        amount = float(tx.amount)
        if tx.type == "rent":
            commission = round(amount * commission_mgmt, 2)
            total_loyers += amount
            total_commissions += commission
        else:
            commission = 0.0
        if tx.type in ("service",):
            total_charges += amount

        rows.append({
            "date": tx.due_date.strftime("%d.%m.%Y") if tx.due_date else "",
            "bien": addr,
            "type": tx.type,
            "statut": tx.status,
            "montant_CHF": f"{amount:.2f}",
            "commission_CHF": f"{commission:.2f}" if commission else "",
            "reference": tx.reference or "",
            "description": tx.notes or "",
        })

    if format == "json":
        return {
            "period": f"{year:04d}-{m:02d}",
            "total_loyers_CHF": round(total_loyers, 2),
            "total_commissions_CHF": round(total_commissions, 2),
            "total_charges_CHF": round(total_charges, 2),
            "net_owner_CHF": round(total_loyers - total_commissions, 2),
            "transactions": rows,
        }

    # CSV
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["date", "bien", "type", "statut", "montant_CHF", "commission_CHF", "reference", "description"],
    )
    writer.writeheader()

    # En-tête résumé
    output.write(f"# Export comptable fiduciaire — {year:04d}-{m:02d}\n")
    output.write(f"# Total loyers,{total_loyers:.2f} CHF\n")
    output.write(f"# Total commissions ({s.commission_management_pct}%),{total_commissions:.2f} CHF\n")
    output.write(f"# Net propriétaire,{total_loyers - total_commissions:.2f} CHF\n\n")

    writer.writerows(rows)
    output.seek(0)

    filename = f"immohub_compta_{year:04d}-{m:02d}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
