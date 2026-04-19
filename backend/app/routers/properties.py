from __future__ import annotations

from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.property import (
    AuditLogResponse,
    PaginatedProperties,
    PropertyCreate,
    PropertyDetail,
    PropertyDocumentResponse,
    PropertyImageResponse,
    PropertyRead,
    PropertyUpdate,
)
from app.services.property_service import PropertyService
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── List & Create ──────────────────────────────────────────────────────────────


@router.get("", response_model=PaginatedProperties)
async def list_properties(
    current_user: AuthUserDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None),
    status: str | None = Query(None),
    city: str | None = Query(None),
    owner_id: str | None = Query(None),
    agency_id: str | None = Query(None),
) -> PaginatedProperties:
    return await PropertyService(db).list(
        current_user=current_user,
        page=page,
        size=size,
        type=type,
        status=status,
        city=city,
        owner_id=owner_id,
        agency_id=agency_id,
    )


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
async def create_property(
    payload: PropertyCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> PropertyRead:
    if current_user.role not in ("proprio_solo", "agence", "super_admin"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Seuls les propriétaires et agences peuvent créer un bien"
        )
    prop = await PropertyService(db).create(payload, current_user=current_user)
    return PropertyRead.model_validate(prop)


# ── Single property ────────────────────────────────────────────────────────────


@router.get("/{property_id}", response_model=PropertyDetail)
async def get_property(
    property_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> PropertyDetail:
    detail = await PropertyService(db).get_detail(property_id, current_user=current_user)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return detail


@router.put("/{property_id}", response_model=PropertyRead)
async def update_property(
    property_id: str,
    payload: PropertyUpdate,
    current_user: AuthUserDep,
    db: DbDep,
) -> PropertyRead:
    prop = await PropertyService(db).update(property_id, payload, current_user=current_user)
    if prop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
    return PropertyRead.model_validate(prop)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_property(
    property_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    deleted = await PropertyService(db).delete(property_id, current_user=current_user)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")


# ── Images ─────────────────────────────────────────────────────────────────────


@router.post(
    "/{property_id}/images",
    response_model=PropertyImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    property_id: str,
    db: DbDep,
    current_user: AuthUserDep,
    file: UploadFile = File(...),
    is_cover: bool = Form(False),
) -> PropertyImageResponse:
    return await PropertyService(db).add_image(
        property_id, file=file, is_cover=is_cover, current_user=current_user
    )


@router.delete(
    "/{property_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def delete_image(
    property_id: str,
    image_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    deleted = await PropertyService(db).delete_image(
        property_id, image_id, current_user=current_user
    )
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image introuvable")


# ── Documents ──────────────────────────────────────────────────────────────────


@router.post(
    "/{property_id}/documents",
    response_model=PropertyDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    property_id: str,
    db: DbDep,
    current_user: AuthUserDep,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
) -> PropertyDocumentResponse:
    return await PropertyService(db).add_document(
        property_id, file=file, doc_type=doc_type, current_user=current_user
    )


# ── History ────────────────────────────────────────────────────────────────────


@router.get("/{property_id}/history", response_model=list[AuditLogResponse])
async def get_history(
    property_id: str,
    current_user: AuthUserDep,
    db: DbDep,
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLogResponse]:
    return await PropertyService(db).get_history(property_id, limit=limit)


# ── AI description ─────────────────────────────────────────────────────────────


@router.post("/{property_id}/generate-description")
async def generate_description(
    property_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    description = await PropertyService(db).generate_description(
        property_id, current_user=current_user
    )
    return {"description": description}
