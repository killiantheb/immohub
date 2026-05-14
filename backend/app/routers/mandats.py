"""Router Mandats de gestion — CRUD + send-to-skribble (Sprint 10 Lot 2).

RBAC strict §B.7 + §2.4.16 :
  - Create : `agence` ou `super_admin` uniquement (proprio ne peut PAS créer
    son propre mandat).
  - Read   : mandant (proprio) OR agence OR super_admin.
  - Update : agence ou super_admin (proprio peut PAS modifier son mandat actif).
  - Delete : super_admin uniquement (soft delete).

§2.4.16 doctrine : commission_pct_* sont DATA pure (apparaissent dans le PDF
mandat). PAS de tracking transactionnel — aucun endpoint ne déclenche un
prélèvement ou un calcul auto basé sur ces colonnes.
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mandat_gestion import MandatGestion
from app.models.user import User
from app.schemas.mandat import (
    MandatGestionCreate,
    MandatGestionRead,
    MandatGestionUpdate,
    PaginatedMandats,
)
from app.services.signature_orchestrator import send_mandat_to_skribble
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


def _ref() -> str:
    ts = datetime.now(UTC).strftime("%Y%m")
    uid = uuid.uuid4().hex[:8].upper()
    return f"MDT-{ts}-{uid}"


def _can_create(user: User) -> bool:
    return user.role in ("agence", "super_admin")


def _can_write(mandat: MandatGestion, user: User) -> bool:
    if user.role == "super_admin":
        return True
    if user.role == "agence" and mandat.agence_id == user.id:
        return True
    return False


def _can_read(mandat: MandatGestion, user: User) -> bool:
    if _can_write(mandat, user):
        return True
    return mandat.mandant_id == user.id


@router.get("", response_model=PaginatedMandats)
async def list_mandats(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    mandant_id: uuid.UUID | None = Query(None),
    agence_id: uuid.UUID | None = Query(None),
    bien_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> PaginatedMandats:
    q = select(MandatGestion).where(MandatGestion.is_active.is_(True))

    # RBAC : limiter aux mandats du current_user
    if current_user.role != "super_admin":
        q = q.where(
            (MandatGestion.mandant_id == current_user.id)
            | (MandatGestion.agence_id == current_user.id)
        )

    if mandant_id is not None:
        q = q.where(MandatGestion.mandant_id == mandant_id)
    if agence_id is not None:
        q = q.where(MandatGestion.agence_id == agence_id)
    if bien_id is not None:
        q = q.where(MandatGestion.bien_id == bien_id)
    if status_filter:
        q = q.where(MandatGestion.status == status_filter)

    total: int = (
        await db.execute(select(func.count()).select_from(q.subquery()))
    ).scalar_one()

    rows = (
        (
            await db.execute(
                q.order_by(MandatGestion.created_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        .scalars()
        .all()
    )

    return PaginatedMandats(
        items=[MandatGestionRead.model_validate(r) for r in rows],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 1,
    )


@router.post("", response_model=MandatGestionRead, status_code=status.HTTP_201_CREATED)
async def create_mandat(
    payload: MandatGestionCreate,
    current_user: AuthDep,
    db: DbDep,
) -> MandatGestionRead:
    if not _can_create(current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seuls les rôles 'agence' et 'super_admin' peuvent créer un mandat",
        )

    # Validation mandant_id pointe un proprio_solo
    mandant = await db.get(User, payload.mandant_id)
    if mandant is None or not mandant.is_active:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "mandant_id introuvable ou inactif",
        )
    if mandant.role not in ("proprio_solo", "super_admin"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"mandant_id doit avoir role='proprio_solo' (reçu: '{mandant.role}')",
        )

    # Validation agence_id pointe une agence (ou super_admin pour bootstrap)
    agence = await db.get(User, payload.agence_id)
    if agence is None or not agence.is_active:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "agence_id introuvable ou inactif",
        )
    if agence.role not in ("agence", "super_admin"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"agence_id doit avoir role='agence' (reçu: '{agence.role}')",
        )

    # Si current_user est agence, il ne peut pas créer un mandat pour une AUTRE agence
    if current_user.role == "agence" and payload.agence_id != current_user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous ne pouvez créer qu'un mandat où vous êtes l'agence_id",
        )

    mandat = MandatGestion(
        mandant_id=payload.mandant_id,
        agence_id=payload.agence_id,
        bien_id=payload.bien_id,
        reference=_ref(),
        status="draft",
        commission_pct_annee=payload.commission_pct_annee,
        commission_pct_saison=payload.commission_pct_saison,
        commission_pct_semaine=payload.commission_pct_semaine,
        notes=payload.notes,
        for_juridique=payload.for_juridique,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notice_period_months=payload.notice_period_months,
        notice_deadline_month_day=payload.notice_deadline_month_day,
    )
    db.add(mandat)
    await db.flush()
    await db.refresh(mandat)
    return MandatGestionRead.model_validate(mandat)


@router.get("/{mandat_id}", response_model=MandatGestionRead)
async def get_mandat(
    mandat_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MandatGestionRead:
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None or not mandat.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")
    if not _can_read(mandat, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    return MandatGestionRead.model_validate(mandat)


@router.put("/{mandat_id}", response_model=MandatGestionRead)
async def update_mandat(
    mandat_id: uuid.UUID,
    payload: MandatGestionUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> MandatGestionRead:
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None or not mandat.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")
    if not _can_write(mandat, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if mandat.status not in ("draft",):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Mandat non éditable en status='{mandat.status}'",
        )

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(mandat, field, value)

    await db.flush()
    await db.refresh(mandat)
    return MandatGestionRead.model_validate(mandat)


@router.delete(
    "/{mandat_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def delete_mandat(
    mandat_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    """Soft delete — réservé super_admin pour ne pas casser un mandat actif."""
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None or not mandat.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")
    if current_user.role != "super_admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Suppression mandat réservée super_admin",
        )
    if mandat.status not in ("draft", "terminated", "expired"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Mandat en status='{mandat.status}' ne peut pas être supprimé",
        )
    mandat.is_active = False
    await db.flush()


@router.post("/{mandat_id}/send-to-skribble", response_model=MandatGestionRead)
async def send_mandat_to_skribble_endpoint(
    mandat_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MandatGestionRead:
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None or not mandat.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")
    if not _can_write(mandat, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if mandat.status not in ("draft",):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Mandat déjà envoyé (status={mandat.status})",
        )

    await send_mandat_to_skribble(db, mandat_id)
    await db.refresh(mandat)
    return MandatGestionRead.model_validate(mandat)


@router.post("/{mandat_id}/terminer", response_model=MandatGestionRead)
async def terminer_mandat(
    mandat_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> MandatGestionRead:
    """Résilie un mandat actif. RBAC : mandant (avec préavis) ou super_admin."""
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None or not mandat.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")
    if current_user.role != "super_admin" and current_user.id != mandat.mandant_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le mandant (propriétaire) ou super_admin peut résilier",
        )
    if mandat.status != "active":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Mandat status='{mandat.status}' — doit être 'active' pour résilier",
        )
    mandat.status = "terminated"
    mandat.terminated_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(mandat)
    return MandatGestionRead.model_validate(mandat)


@router.get("/{mandat_id}/pdf")
async def get_mandat_pdf(
    mandat_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> Response:
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None or not mandat.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")
    if not _can_read(mandat, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    from app.services.pdf_mandat_service import generate_mandat_pdf

    pdf_bytes = await generate_mandat_pdf(mandat_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="mandat-{mandat.reference}.pdf"'
        },
    )
