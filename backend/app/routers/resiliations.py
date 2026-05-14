"""Router Resiliations — CRUD + send-to-skribble (Sprint 10 Lot 2).

RBAC :
  - Create/Update/Delete : proprio_solo (owner), agence (mandataire), super_admin,
    OU locataire (s'il initie sa propre résiliation).
  - Read : owner OR agency OR locataire OR super_admin.

Warning CO 266l : si initiateur=bailleur ET bail d'habitation (`is_furnished=False`),
on retourne `warning_co_266l=True` dans la réponse de création (l'UI Lot 6
affiche un avertissement clair que la formule officielle cantonale reste
obligatoire en parallèle).
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.contract import Contract
from app.models.resiliation import Resiliation
from app.models.user import User
from app.schemas.resiliation import (
    PaginatedResiliations,
    ResiliationCreate,
    ResiliationCreateResponse,
    ResiliationRead,
    ResiliationUpdate,
)
from app.services.signature_orchestrator import send_resiliation_to_skribble
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
    return f"RES-{ts}-{uid}"


async def _load_contract_or_404(db: AsyncSession, contract_id: uuid.UUID) -> Contract:
    contract = await db.get(Contract, contract_id)
    if contract is None or not contract.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract introuvable")
    return contract


def _can_write(contract: Contract, user: User, initiateur: str | None = None) -> bool:
    if user.role == "super_admin":
        return True
    # Owner ou agence
    if user.role in WRITE_ROLES and (
        contract.owner_id == user.id or contract.agency_id == user.id
    ):
        return True
    # Locataire peut initier sa propre résiliation
    if initiateur == "locataire" and contract.tenant_id == user.id:
        return True
    return False


def _can_read(contract: Contract, user: User) -> bool:
    if user.role == "super_admin":
        return True
    return (
        contract.owner_id == user.id
        or contract.agency_id == user.id
        or contract.tenant_id == user.id
    )


def _warning_co_266l(contract: Contract, initiateur: str) -> tuple[bool, str | None]:
    """Détermine si la formule officielle CO 266l reste requise.

    Heuristique Phase 1.0 : bailleur initiateur + bail non meublé (= habitation
    en général). Cas commercial / meublé court terme : pas de formule officielle
    obligatoire au sens CO 266l.
    """
    if initiateur != "bailleur":
        return (False, None)
    is_habitation = not contract.is_furnished
    if not is_habitation:
        return (False, None)
    return (
        True,
        "Pour les baux d'habitation, l'usage de la formule officielle "
        "cantonale (CO 266l) reste obligatoire pour le bailleur. Ce document "
        "ne remplace pas la formule officielle — il documente la décision et "
        "la communication mais pas la notification légale.",
    )


@router.get("", response_model=PaginatedResiliations)
async def list_resiliations(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    contract_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> PaginatedResiliations:
    q = select(Resiliation).where(Resiliation.is_active.is_(True))

    if current_user.role != "super_admin":
        q = q.join(Contract, Contract.id == Resiliation.contract_id).where(
            (Contract.owner_id == current_user.id)
            | (Contract.agency_id == current_user.id)
            | (Contract.tenant_id == current_user.id)
        )

    if contract_id is not None:
        q = q.where(Resiliation.contract_id == contract_id)
    if status_filter:
        q = q.where(Resiliation.status == status_filter)

    total: int = (
        await db.execute(select(func.count()).select_from(q.subquery()))
    ).scalar_one()

    rows = (
        (
            await db.execute(
                q.order_by(Resiliation.created_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        .scalars()
        .all()
    )

    return PaginatedResiliations(
        items=[ResiliationRead.model_validate(r) for r in rows],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 1,
    )


@router.post(
    "", response_model=ResiliationCreateResponse, status_code=status.HTTP_201_CREATED
)
async def create_resiliation(
    payload: ResiliationCreate,
    current_user: AuthDep,
    db: DbDep,
) -> ResiliationCreateResponse:
    contract = await _load_contract_or_404(db, payload.contract_id)
    if not _can_write(contract, current_user, payload.initiateur):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    resiliation = Resiliation(
        contract_id=payload.contract_id,
        agency_id=contract.agency_id,
        reference=_ref(),
        initiateur=payload.initiateur,
        motif=payload.motif,
        date_resiliation=payload.date_resiliation,
        date_envoi=payload.date_envoi,
        respect_preavis=payload.respect_preavis,
        preavis_months=payload.preavis_months,
        status="draft",
    )
    db.add(resiliation)
    await db.flush()
    await db.refresh(resiliation)

    warn, msg = _warning_co_266l(contract, payload.initiateur)
    read = ResiliationRead.model_validate(resiliation)
    return ResiliationCreateResponse(
        **read.model_dump(), warning_co_266l=warn, warning_message=msg
    )


@router.get("/{resiliation_id}", response_model=ResiliationRead)
async def get_resiliation(
    resiliation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ResiliationRead:
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_read(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    return ResiliationRead.model_validate(resiliation)


@router.put("/{resiliation_id}", response_model=ResiliationRead)
async def update_resiliation(
    resiliation_id: uuid.UUID,
    payload: ResiliationUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> ResiliationRead:
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_write(contract, current_user, resiliation.initiateur):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if resiliation.status not in ("draft",):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Résiliation non éditable en status='{resiliation.status}'",
        )

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(resiliation, field, value)

    await db.flush()
    await db.refresh(resiliation)
    return ResiliationRead.model_validate(resiliation)


@router.delete(
    "/{resiliation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_resiliation(
    resiliation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_write(contract, current_user, resiliation.initiateur):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if resiliation.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Résiliation en status='{resiliation.status}' ne peut pas être supprimée",
        )
    resiliation.is_active = False
    await db.flush()


@router.post("/{resiliation_id}/send-to-skribble", response_model=ResiliationRead)
async def send_resiliation_to_skribble_endpoint(
    resiliation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ResiliationRead:
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_write(contract, current_user, resiliation.initiateur):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if resiliation.status not in ("draft",):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Résiliation déjà envoyée (status={resiliation.status})",
        )

    await send_resiliation_to_skribble(db, resiliation_id)
    await db.refresh(resiliation)
    return ResiliationRead.model_validate(resiliation)


@router.post("/{resiliation_id}/marquer-envoyee", response_model=ResiliationRead)
async def marquer_envoyee(
    resiliation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ResiliationRead:
    """Marque que le courrier recommandé a été envoyé physiquement."""
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_write(contract, current_user, resiliation.initiateur):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if resiliation.status != "signed":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Résiliation status='{resiliation.status}' — doit être 'signed' avant envoi",
        )
    resiliation.status = "envoyee"
    resiliation.notification_envoyee_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(resiliation)
    return ResiliationRead.model_validate(resiliation)


@router.post("/{resiliation_id}/marquer-appliquee", response_model=ResiliationRead)
async def marquer_appliquee(
    resiliation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> ResiliationRead:
    """Marque la résiliation comme appliquée → bascule Contract.status='terminated'."""
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_write(contract, current_user, resiliation.initiateur):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if resiliation.status not in ("signed", "envoyee"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Résiliation status='{resiliation.status}' — doit être signed/envoyee",
        )
    resiliation.status = "appliquee"
    # Bascule Contract terminated
    contract.status = "terminated"
    contract.terminated_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(resiliation)
    return ResiliationRead.model_validate(resiliation)


@router.get("/{resiliation_id}/pdf")
async def get_resiliation_pdf(
    resiliation_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> Response:
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None or not resiliation.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")
    contract = await _load_contract_or_404(db, resiliation.contract_id)
    if not _can_read(contract, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    from app.services.pdf_resiliation_service import generate_resiliation_pdf

    pdf_bytes = await generate_resiliation_pdf(resiliation_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="resiliation-{resiliation.reference}.pdf"'
        },
    )
