"""Router FastAPI — /api/v1/docs-althy (GED Althy)."""

from __future__ import annotations

import uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.document_althy import DocumentAlthy
from app.models.user import User
from app.schemas.document_althy import DocumentAlthyCreate, DocumentAlthyRead, DocumentAlthyUpdate
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthDep = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=list[DocumentAlthyRead])
async def list_documents(
    current_user: AuthDep,
    db: DbDep,
    bien_id: uuid.UUID | None = Query(None),
    locataire_id: uuid.UUID | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> list[DocumentAlthyRead]:
    q = select(DocumentAlthy)
    if bien_id:
        q = q.where(DocumentAlthy.bien_id == bien_id)
    if locataire_id:
        q = q.where(DocumentAlthy.locataire_id == locataire_id)
    if type:
        q = q.where(DocumentAlthy.type == type)
    q = q.offset((page - 1) * size).limit(size)
    rows = await db.execute(q)
    return [DocumentAlthyRead.model_validate(r) for r in rows.scalars()]


@router.post("", response_model=DocumentAlthyRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentAlthyCreate,
    current_user: AuthDep,
    db: DbDep,
) -> DocumentAlthyRead:
    doc = DocumentAlthy(**payload.model_dump())
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentAlthyRead.model_validate(doc)


@router.get("/{doc_id}", response_model=DocumentAlthyRead)
async def get_document(
    doc_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> DocumentAlthyRead:
    result = await db.execute(select(DocumentAlthy).where(DocumentAlthy.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")
    return DocumentAlthyRead.model_validate(doc)


@router.patch("/{doc_id}", response_model=DocumentAlthyRead)
async def update_document(
    doc_id: uuid.UUID,
    payload: DocumentAlthyUpdate,
    current_user: AuthDep,
    db: DbDep,
) -> DocumentAlthyRead:
    result = await db.execute(select(DocumentAlthy).where(DocumentAlthy.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    await db.flush()
    await db.refresh(doc)
    return DocumentAlthyRead.model_validate(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_document(
    doc_id: uuid.UUID,
    current_user: AuthDep,
    db: DbDep,
) -> None:
    result = await db.execute(select(DocumentAlthy).where(DocumentAlthy.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document introuvable")
    await db.delete(doc)
