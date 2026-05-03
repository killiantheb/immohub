"""Router FastAPI — /api/v1/interventions-althy + /devis.

Thin layer : délègue la logique métier à app.services.intervention_service.
La fonction _notify_owner_new_intervention reste ici car c'est de la
notification annexe (Resend), pas du métier intervention pur.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.intervention import (
    DevisCreate,
    DevisRead,
    DevisUpdate,
    InterventionCreate,
    InterventionPhotoRead,
    InterventionRead,
    InterventionUpdate,
)
from app.services.intervention_service import InterventionService
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import text
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
    rows = await InterventionService(db).list_interventions(
        current_user,
        bien_id=bien_id,
        statut=statut,
        urgence=urgence,
        page=page,
        size=size,
    )
    return [InterventionRead.model_validate(r) for r in rows]


@router.post("", response_model=InterventionRead, status_code=status.HTTP_201_CREATED)
async def create_intervention(
    payload: InterventionCreate,
    current_user: AuthDep,
    db: DbDep,
    bg: BackgroundTasks,
) -> InterventionRead:
    inter = await InterventionService(db).create_intervention(current_user, payload)

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
    inter = await InterventionService(db).get_intervention(
        current_user, intervention_id
    )
    return InterventionRead.model_validate(inter)


@router.patch("/{intervention_id}", response_model=InterventionRead)
async def update_intervention(
    intervention_id: uuid.UUID,
    payload: InterventionUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> InterventionRead:
    inter = await InterventionService(db).update_intervention(
        current_user, intervention_id, payload
    )
    return InterventionRead.model_validate(inter)


@router.delete("/{intervention_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_intervention(
    intervention_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    await InterventionService(db).delete_intervention(current_user, intervention_id)


# ══════════════════════════════════════════════════════════════════════════════
# Photos (sous-ressource d'intervention — table intervention_photos)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{intervention_id}/photos",
    response_model=InterventionPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_intervention_photo(
    intervention_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
) -> InterventionPhotoRead:
    photo = await InterventionService(db).add_photo(
        current_user, intervention_id, file
    )
    return InterventionPhotoRead.model_validate(photo)


@router.delete(
    "/{intervention_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_intervention_photo(
    intervention_id: uuid.UUID,
    photo_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await InterventionService(db).delete_photo(
        current_user, intervention_id, photo_id
    )
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo introuvable")


# ══════════════════════════════════════════════════════════════════════════════
# Devis (sous-ressource d'intervention)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{intervention_id}/devis", response_model=list[DevisRead])
async def list_devis(
    intervention_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[DevisRead]:
    rows = await InterventionService(db).list_devis(current_user, intervention_id)
    return [DevisRead.model_validate(r) for r in rows]


@router.post("/{intervention_id}/devis", response_model=DevisRead, status_code=status.HTTP_201_CREATED)
async def create_devis(
    intervention_id: uuid.UUID,
    payload: DevisCreate,
    current_user: AuthDep,
    db: DbDep,
) -> DevisRead:
    d = await InterventionService(db).create_devis(
        current_user, intervention_id, payload
    )
    return DevisRead.model_validate(d)


@router.patch("/{intervention_id}/devis/{devis_id}", response_model=DevisRead)
async def update_devis(
    intervention_id: uuid.UUID,
    devis_id: uuid.UUID,
    payload: DevisUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> DevisRead:
    d = await InterventionService(db).update_devis(
        current_user, intervention_id, devis_id, payload
    )
    return DevisRead.model_validate(d)


@router.delete("/{intervention_id}/devis/{devis_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_devis(
    intervention_id: uuid.UUID,
    devis_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    await InterventionService(db).delete_devis(
        current_user, intervention_id, devis_id
    )
