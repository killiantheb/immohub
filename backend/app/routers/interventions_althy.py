"""Router FastAPI — /api/v1/interventions-althy + /devis."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.intervention import Devis, Intervention
from app.models.user import User
from app.schemas.intervention import (
    DevisCreate,
    DevisRead,
    DevisUpdate,
    InterventionCreate,
    InterventionRead,
    InterventionUpdate,
)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ══════════════════════════════════════════════════════════════════════════════
# Interventions
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=list[InterventionRead])
async def list_interventions(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    statut: str | None = Query(None),
    urgence: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> list[InterventionRead]:
    q = select(Intervention)
    if bien_id:
        q = q.where(Intervention.bien_id == bien_id)
    if statut:
        q = q.where(Intervention.statut == statut)
    if urgence:
        q = q.where(Intervention.urgence == urgence)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [InterventionRead.model_validate(r) for r in rows.scalars()]


@router.post("", response_model=InterventionRead, status_code=status.HTTP_201_CREATED)
async def create_intervention(
    payload: InterventionCreate,
    current_user: AuthDep,
    db: DbDep,
    bg: BackgroundTasks,
) -> InterventionRead:
    data = payload.model_dump()
    data["signale_par_id"] = current_user.id
    inter = Intervention(**data)
    db.add(inter)
    await db.flush()
    await db.refresh(inter)

    # Notify property owner in background
    bg.add_task(
        _notify_owner_new_intervention,
        bien_id=str(payload.bien_id),
        titre=payload.titre,
        description=payload.description or "",
        categorie=payload.categorie,
        urgence=payload.urgence,
    )

    return InterventionRead.model_validate(inter)


async def _notify_owner_new_intervention(
    bien_id: str,
    titre: str,
    description: str,
    categorie: str,
    urgence: str,
) -> None:
    """Send email notification to property owner about a new intervention."""
    import logging

    from app.core.config import settings
    from app.core.database import AsyncSessionLocal

    logger = logging.getLogger("althy.interventions")

    try:
        async with AsyncSessionLocal() as db:
            row = (await db.execute(
                text("""
                    SELECT u.email, b.adresse
                    FROM biens b
                    JOIN auth.users u ON u.id = b.owner_id
                    WHERE b.id = :bid
                """),
                {"bid": bien_id},
            )).one_or_none()
            if not row:
                logger.warning("Notify intervention: bien %s not found", bien_id)
                return

            owner_email, address = row.email, row.adresse

        if not settings.RESEND_API_KEY:
            logger.info("[intervention] DEV — email ignoré: %s → %s", titre, owner_email)
            return

        import httpx
        html = f"""
        <div style="font-family:DM Sans,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#E8602C">Nouveau signalement — {categorie}</h2>
            <p><strong>Bien :</strong> {address}</p>
            <p><strong>Urgence :</strong> {urgence}</p>
            <p><strong>Titre :</strong> {titre}</p>
            <p>{description}</p>
            <hr style="border:none;border-top:1px solid #E8E4DC;margin:20px 0" />
            <p style="font-size:13px;color:#7A7469">
                Connectez-vous à <a href="https://althy.ch/app/interventions" style="color:#E8602C">Althy</a>
                pour traiter ce signalement.
            </p>
        </div>
        """
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"Althy <{settings.EMAILS_FROM}>",
                    "to": [owner_email],
                    "subject": f"Signalement locataire — {titre}",
                    "html": html,
                },
            )
            if resp.status_code not in (200, 201):
                logger.warning("[intervention] Resend %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.error("[intervention] Notification error: %s", exc)


@router.get("/{intervention_id}", response_model=InterventionRead)
async def get_intervention(
    intervention_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> InterventionRead:
    result = await db.execute(select(Intervention).where(Intervention.id == intervention_id))
    inter = result.scalar_one_or_none()
    if not inter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Intervention introuvable")
    return InterventionRead.model_validate(inter)


@router.patch("/{intervention_id}", response_model=InterventionRead)
async def update_intervention(
    intervention_id: uuid.UUID,
    payload: InterventionUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> InterventionRead:
    result = await db.execute(select(Intervention).where(Intervention.id == intervention_id))
    inter = result.scalar_one_or_none()
    if not inter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Intervention introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inter, field, value)
    await db.flush()
    await db.refresh(inter)
    return InterventionRead.model_validate(inter)


@router.delete("/{intervention_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_intervention(
    intervention_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(Intervention).where(Intervention.id == intervention_id))
    inter = result.scalar_one_or_none()
    if not inter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Intervention introuvable")
    await db.delete(inter)


# ══════════════════════════════════════════════════════════════════════════════
# Devis (sous-ressource d'intervention)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{intervention_id}/devis", response_model=list[DevisRead])
async def list_devis(
    intervention_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[DevisRead]:
    rows = await db.execute(select(Devis).where(Devis.intervention_id == intervention_id))
    return [DevisRead.model_validate(r) for r in rows.scalars()]


@router.post("/{intervention_id}/devis", response_model=DevisRead, status_code=status.HTTP_201_CREATED)
async def create_devis(
    intervention_id: uuid.UUID,
    payload: DevisCreate,
    current_user: AuthDep,
    db: DbDep,
) -> DevisRead:
    data = payload.model_dump()
    data["intervention_id"] = intervention_id
    d = Devis(**data)
    db.add(d)
    await db.flush()
    await db.refresh(d)
    return DevisRead.model_validate(d)


@router.patch("/{intervention_id}/devis/{devis_id}", response_model=DevisRead)
async def update_devis(
    intervention_id: uuid.UUID,
    devis_id: uuid.UUID,
    payload: DevisUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> DevisRead:
    result = await db.execute(
        select(Devis).where(Devis.id == devis_id, Devis.intervention_id == intervention_id)
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Devis introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(d, field, value)
    await db.flush()
    await db.refresh(d)
    return DevisRead.model_validate(d)


@router.delete("/{intervention_id}/devis/{devis_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_devis(
    intervention_id: uuid.UUID,
    devis_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(
        select(Devis).where(Devis.id == devis_id, Devis.intervention_id == intervention_id)
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Devis introuvable")
    await db.delete(d)
