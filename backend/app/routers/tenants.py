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
import uuid as uuid_lib

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
    if current_user.role != "locataire":
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


class ReportCreate(BaseModel):
    category: str
    urgency: str
    description: str


class ReportResponse(BaseModel):
    id: str
    message: str


@router.post("/me/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportResponse:
    """Locataire signale un problème — crée un RFQ de type maintenance."""
    if current_user.role != "locataire":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux locataires")

    from app.models.rfq import RFQ  # local import
    report_id = uuid_lib.uuid4()
    rfq = RFQ(
        id=report_id,
        title=f"Signalement locataire — {payload.category}",
        description=payload.description,
        category=payload.category if payload.category in ("plumbing", "electricity", "cleaning", "painting", "locksmith", "roofing", "gardening", "masonry", "hvac", "renovation") else "other",
        urgency=payload.urgency if payload.urgency in ("low", "medium", "high", "emergency") else "medium",
        status="draft",
        owner_id=current_user.id,
    )
    db.add(rfq)
    await db.commit()
    return ReportResponse(id=str(report_id), message="Signalement enregistré")


@router.get("/me/documents")
async def tenant_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """Retourne les documents du bail actif du locataire."""
    if current_user.role != "locataire":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux locataires")

    result = await db.execute(
        select(Contract)
        .where(and_(Contract.tenant_id == current_user.id, Contract.status == "active"))
        .limit(1)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        return []

    from app.models.property import PropertyDocument
    docs_result = await db.execute(
        select(PropertyDocument).where(PropertyDocument.property_id == contract.property_id)
    )
    docs = docs_result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": d.filename,
            "type": d.doc_type or "other",
            "url": d.url,
            "created_at": d.created_at.isoformat() if d.created_at else "",
        }
        for d in docs
    ]


@router.get("/me/quittances")
async def tenant_quittances(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """Retourne les quittances de loyer générées pour le locataire connecté."""
    if current_user.role != "locataire":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux locataires")

    # Find active contract
    result = await db.execute(
        select(Contract)
        .where(and_(Contract.tenant_id == current_user.id))
        .order_by(Contract.start_date.desc())
        .limit(5)
    )
    contracts = result.scalars().all()
    if not contracts:
        return []

    contract_ids = [c.id for c in contracts]

    from app.models.document import GeneratedDocument
    from sqlalchemy import or_
    docs_result = await db.execute(
        select(GeneratedDocument)
        .where(
            and_(
                GeneratedDocument.template_type == "quittance_loyer",
                or_(*[GeneratedDocument.contract_id == cid for cid in contract_ids]),
            )
        )
        .order_by(GeneratedDocument.created_at.desc())
        .limit(24)
    )
    docs = docs_result.scalars().all()
    return [
        {
            "id": str(d.id),
            "created_at": d.created_at.isoformat() if d.created_at else "",
            "status": d.status,
        }
        for d in docs
    ]


@router.get("/me/history")
async def tenant_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """Historique de tous les logements (baux passés + actuel) du locataire."""
    if current_user.role != "locataire":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux locataires")

    result = await db.execute(
        select(Contract)
        .where(Contract.tenant_id == current_user.id)
        .order_by(Contract.start_date.desc())
    )
    contracts = result.scalars().all()

    out = []
    for c in contracts:
        prop_result = await db.execute(select(Property).where(Property.id == c.property_id))
        prop = prop_result.scalar_one_or_none()
        out.append({
            "id": str(c.id),
            "reference": c.reference,
            "status": c.status,
            "start_date": c.start_date.isoformat() if c.start_date else None,
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "monthly_rent": float(c.monthly_rent) if c.monthly_rent else None,
            "currency": "CHF",
            "property_address": f"{prop.address}, {prop.city}" if prop else None,
            "property_type": prop.type if prop else None,
            "rooms": float(prop.rooms) if prop and prop.rooms else None,
            "surface": float(prop.surface) if prop and prop.surface else None,
        })
    return out


@router.get("/me/deposit")
async def tenant_deposit(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Informations sur la caution (dépôt de garantie) du bail actif."""
    if current_user.role != "locataire":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux locataires")

    result = await db.execute(
        select(Contract)
        .where(and_(Contract.tenant_id == current_user.id, Contract.status == "active"))
        .order_by(Contract.start_date.desc())
        .limit(1)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        return {"status": "no_contract", "deposit_amount": None, "months": 3}

    monthly = float(contract.monthly_rent) if contract.monthly_rent else 0
    deposit = monthly * 3  # max légal CO: 3 mois

    # Cherche une transaction de type "deposit"
    tx_result = await db.execute(
        select(Transaction)
        .where(
            and_(
                Transaction.contract_id == contract.id,
                Transaction.type == "deposit",
            )
        )
        .limit(1)
    )
    tx = tx_result.scalar_one_or_none()

    return {
        "status": tx.status if tx else "pending",
        "deposit_amount_chf": deposit,
        "monthly_rent_chf": monthly,
        "months": 3,
        "paid_at": tx.paid_at.isoformat() if tx and tx.paid_at else None,
        "contract_id": str(contract.id),
        "reference": contract.reference,
    }
