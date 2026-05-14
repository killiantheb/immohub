"""Router Avenants — CRUD + send-to-skribble (Sprint 10 Lot 2).

RBAC :
  - Create/Update/Delete : proprio_solo (owner du contract), agence (agency_id
    du contract), super_admin.
  - Read : owner OR agency OR locataire OR super_admin.
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.avenant import Avenant
from app.models.contract import Contract
from app.models.user import User
from app.schemas.avenant import (
    AvenantCreate,
    AvenantRead,
    AvenantUpdate,
    PaginatedAvenants,
)
from app.services.signature_orchestrator import send_avenant_to_skribble
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]

WRITE_ROLES = {"proprio_solo", "agence", "super_admin"}


def _ref() -> str:
    ts = datetime.now(UTC).strftime("%Y%m")
    uid = uuid.uuid4().hex[:8].upper()
    return f"AVT-{ts}-{uid}"


async def _load_contract_or_404(db: AsyncSession, contract_id: uuid.UUID) -> Contract:
    contract = await db.get(Contract, contract_id)
    if contract is None or not contract.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract introuvable")
    return contract


def _can_write(contract: Contract, user: User) -> bool:
    if user.role == "super_admin":
        return True
    if user.role not in WRITE_ROLES:
        return False
    return contract.owner_id == user.id or contract.agency_id == user.id


def _can_read(contract: Contract, user: User) -> bool:
    if _can_write(contract, user):
        return True
    return contract.tenant_id == user.id


@router.get("", response_model=PaginatedAvenants)
async def list_avenants(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    contract_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> PaginatedAvenants:
    q = select(Avenant).where(Avenant.is_active.is_(True))

    # RBAC : restreindre selon rôle
    if current_user.role != "super_admin":
        # Filter on join with Contract for owner/agency/tenant
        q = q.join(Contract, Contract.id == Avenant.contract_id).where(
            (Contract.owner_id == current_user.id)
            | (Contract.agency_id == current_user.id)
            | (Contract.tenant_id == current_user.id)
        )

    if contract_id is not None:
        q = q.where(Avenant.contract_id == contract_id)
    if status_filter:
        q = q.where(Avenant.status == status_filter)

    total: int = (
        await db.execute(select(func.count()).select_from(q.subquery()))
    ).scalar_one()

    rows = (
        (
            await db.execute(
                q.order_by(Avenant.created_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        .scalars()
        .all()
    )

    return PaginatedAvenants(
        items=[AvenantRead.model_validate(r) for r in rows],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 1,
    )


@router.post("", response_model=AvenantRead, status_code=status.HTTP_201_CREATED)
async def create_avenant(
    payload: AvenantCreate,
    current_user: AuthDep,
    db: DbDep,
) -> AvenantRead:
    contract = await _load_contract_or_404(db, payload.contract_id)
    if not _can_write(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    avenant = Avenant(
        contract_id=payload.contract_id,
        agency_id=contract.agency_id,
        reference=_ref(),
        avenant_type=payload.avenant_type,
        objet=payload.objet,
        body_text=payload.body_text,
        effective_date=payload.effective_date,
        data=payload.data,
        status="draft",
    )
    db.add(avenant)
    await db.flush()
    await db.refresh(avenant)
    return AvenantRead.model_validate(avenant)


@router.get("/{avenant_id}", response_model=AvenantRead)
async def get_avenant(
    avenant_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> AvenantRead:
    avenant = await db.get(Avenant, avenant_id)
    if avenant is None or not avenant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avenant introuvable")
    contract = await _load_contract_or_404(db, avenant.contract_id)
    if not _can_read(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    return AvenantRead.model_validate(avenant)


@router.put("/{avenant_id}", response_model=AvenantRead)
async def update_avenant(
    avenant_id: uuid.UUID,
    payload: AvenantUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> AvenantRead:
    avenant = await db.get(Avenant, avenant_id)
    if avenant is None or not avenant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avenant introuvable")
    contract = await _load_contract_or_404(db, avenant.contract_id)
    if not _can_write(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if avenant.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Avenant non éditable en status='{avenant.status}'",
        )

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(avenant, field, value)

    await db.flush()
    await db.refresh(avenant)
    return AvenantRead.model_validate(avenant)


@router.delete(
    "/{avenant_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def delete_avenant(
    avenant_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    avenant = await db.get(Avenant, avenant_id)
    if avenant is None or not avenant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avenant introuvable")
    contract = await _load_contract_or_404(db, avenant.contract_id)
    if not _can_write(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if avenant.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Avenant en status='{avenant.status}' ne peut pas être supprimé",
        )
    avenant.is_active = False
    await db.flush()


@router.post("/{avenant_id}/send-to-skribble", response_model=AvenantRead)
async def send_avenant_to_skribble_endpoint(
    avenant_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> AvenantRead:
    avenant = await db.get(Avenant, avenant_id)
    if avenant is None or not avenant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avenant introuvable")
    contract = await _load_contract_or_404(db, avenant.contract_id)
    if not _can_write(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if avenant.status not in ("draft",):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Avenant déjà envoyé (status={avenant.status})",
        )

    await send_avenant_to_skribble(db, avenant_id)
    await db.refresh(avenant)
    return AvenantRead.model_validate(avenant)


@router.get("/{avenant_id}/pdf")
async def get_avenant_pdf(
    avenant_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> Response:
    avenant = await db.get(Avenant, avenant_id)
    if avenant is None or not avenant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avenant introuvable")
    contract = await _load_contract_or_404(db, avenant.contract_id)
    if not _can_read(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    from app.services.pdf_avenant_service import generate_avenant_pdf

    pdf_bytes = await generate_avenant_pdf(avenant_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="avenant-{avenant.reference}.pdf"'
        },
    )
