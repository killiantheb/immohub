"""Router FastAPI — /api/v1/biens (refonte fusion 2026-04-23).

Inclut :
    - CRUD biens (list paginée, create, read detail, update, soft delete)
    - Images (add, delete)
    - Documents (add)
    - Équipements (get, set liste, remove)
    - Historique audit
    - Génération description IA
    - Potentiel IA (7 blocs d'analyse)

Convention : tous les path params UUID sont typés strict `uuid.UUID` (FastAPI
génère automatiquement un 422 si malformé, plutôt qu'un 500). Les query params
d'identifiant (owner_id, agency_id) suivent la même règle.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.bien import (
    AuditLogResponse,
    BienCreate,
    BienDetail,
    BienDocumentRead,
    BienImageRead,
    BienRead,
    BienUpdate,
    CatalogueEquipementRead,
    GenerateDescriptionResponse,
    PaginatedBiens,
    PotentielIAResponse,
    SetEquipementsRequest,
)
from app.services.bien_service import BienService
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


# ═════════════════════════════════════════════════════════════════════════════
# CRUD biens
# ═════════════════════════════════════════════════════════════════════════════


@router.get("", response_model=PaginatedBiens)
async def list_biens(
    current_user: AuthDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    statut: str | None = Query(None),
    ville: str | None = Query(None),
    canton: str | None = Query(None),
    owner_id: uuid.UUID | None = Query(None),
    agency_id: uuid.UUID | None = Query(None),
) -> PaginatedBiens:
    return await BienService(db).list(
        current_user=current_user,
        page=page,
        size=size,
        type=type,
        statut=statut,
        ville=ville,
        canton=canton,
        owner_id=str(owner_id) if owner_id else None,
        agency_id=str(agency_id) if agency_id else None,
    )


@router.post("", response_model=BienRead, status_code=status.HTTP_201_CREATED)
async def create_bien(
    payload: BienCreate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    bien = await BienService(db).create(payload, current_user=current_user)
    return BienRead.model_validate(bien)


@router.get("/{bien_id}", response_model=BienDetail)
async def get_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> BienDetail:
    detail = await BienService(db).get_detail(bien_id, current_user=current_user)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return detail


@router.patch("/{bien_id}", response_model=BienRead)
async def update_bien(
    bien_id: uuid.UUID,
    payload: BienUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> BienRead:
    bien = await BienService(db).update(bien_id, payload, current_user=current_user)
    if bien is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return BienRead.model_validate(bien)


@router.delete("/{bien_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_bien(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienService(db).delete(bien_id, current_user=current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")


# ═════════════════════════════════════════════════════════════════════════════
# Images
# ═════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{bien_id}/images",
    response_model=BienImageRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
    is_cover: bool = Form(False),
) -> BienImageRead:
    return await BienService(db).add_image(bien_id, file, is_cover, current_user)


@router.delete(
    "/{bien_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_image(
    bien_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienService(db).delete_image(bien_id, image_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image introuvable")


# ═════════════════════════════════════════════════════════════════════════════
# Documents
# ═════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{bien_id}/documents",
    response_model=BienDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
    file: UploadFile = File(...),
    doc_type: str = Form("autre"),
) -> BienDocumentRead:
    return await BienService(db).add_document(bien_id, file, doc_type, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Équipements
# ═════════════════════════════════════════════════════════════════════════════


@router.get("/{bien_id}/equipements", response_model=list[CatalogueEquipementRead])
async def get_bien_equipements(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> list[CatalogueEquipementRead]:
    return await BienService(db).get_equipements(bien_id, current_user)


@router.put("/{bien_id}/equipements", response_model=list[CatalogueEquipementRead])
async def set_bien_equipements(
    bien_id: uuid.UUID,
    payload: SetEquipementsRequest,
    current_user: AuthDep,
    db: DbDep,
) -> list[CatalogueEquipementRead]:
    """Remplace intégralement la liste d'équipements d'un bien."""
    return await BienService(db).set_equipements(
        bien_id, payload.equipement_ids, current_user
    )


@router.delete(
    "/{bien_id}/equipements/{equipement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def remove_bien_equipement(
    bien_id: uuid.UUID,
    equipement_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    ok = await BienService(db).remove_equipement(bien_id, equipement_id, current_user)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Équipement non attaché")


# ═════════════════════════════════════════════════════════════════════════════
# History (audit log)
# ═════════════════════════════════════════════════════════════════════════════


@router.get("/{bien_id}/history", response_model=list[AuditLogResponse])
async def get_bien_history(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLogResponse]:
    # Access check léger (1 SELECT sur biens, sans les joins images/docs/équipements)
    svc = BienService(db)
    await svc.get_for_access_check(bien_id, current_user)
    return await svc.get_history(bien_id, limit=limit)


# ═════════════════════════════════════════════════════════════════════════════
# Generate description IA (Claude)
# ═════════════════════════════════════════════════════════════════════════════


@router.post(
    "/{bien_id}/generate-description",
    response_model=GenerateDescriptionResponse,
)
async def generate_description(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> GenerateDescriptionResponse:
    description = await BienService(db).generate_description(bien_id, current_user)
    return GenerateDescriptionResponse(description=description)


# ═════════════════════════════════════════════════════════════════════════════
# Potentiel IA — passe-plat vers BienService (logique métier dans le service)
# ═════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{bien_id}/potentiel",
    response_model=PotentielIAResponse,
    summary="Potentiel IA du bien",
)
async def get_potentiel_ia(
    bien_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> PotentielIAResponse:
    """Calcul financier + recommandations Claude pour la fiche bien."""
    return await BienService(db).get_potentiel_ia(bien_id, current_user)
