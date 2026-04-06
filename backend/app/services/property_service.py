"""
Property service — business logic for CRUD, file uploads and AI description.

Storage layout in Supabase:
  Bucket: property-images    → {property_id}/{image_id}.{ext}
  Bucket: property-documents → {property_id}/{doc_id}.{ext}
"""

from __future__ import annotations

import math
import mimetypes
import uuid
from typing import TYPE_CHECKING

import httpx
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.property import Property, PropertyDocument, PropertyImage
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
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.user import User

# ── Supabase Storage helpers ───────────────────────────────────────────────────

_STORAGE_HEADERS = {
    "apikey": settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
}

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _storage_url(bucket: str, path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"


def _public_url(bucket: str, path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


async def _upload_to_storage(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """Upload bytes to Supabase Storage, return public URL."""
    url = _storage_url(bucket, path)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            content=data,
            headers={**_STORAGE_HEADERS, "Content-Type": content_type},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Storage upload failed: {resp.text}",
        )
    return _public_url(bucket, path)


async def _delete_from_storage(bucket: str, path: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        await client.delete(
            _storage_url(bucket, path),
            headers=_STORAGE_HEADERS,
        )


# ── Access helpers ─────────────────────────────────────────────────────────────


def _can_write(prop: Property, user: User) -> bool:
    if user.role == "super_admin":
        return True
    uid = user.id
    return prop.owner_id == uid or prop.created_by_id == uid or prop.agency_id == uid


# ── Service ────────────────────────────────────────────────────────────────────


class PropertyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── List ──────────────────────────────────────────────────────────────────

    async def list(
        self,
        current_user: User,
        page: int = 1,
        size: int = 20,
        type: str | None = None,
        status: str | None = None,
        city: str | None = None,
        owner_id: str | None = None,
        agency_id: str | None = None,
    ) -> PaginatedProperties:
        base_q = select(Property).where(Property.is_active.is_(True))

        # Scope by role
        if current_user.role not in ("super_admin",):
            if current_user.role in ("owner", "agency"):
                base_q = base_q.where(
                    (Property.owner_id == current_user.id)
                    | (Property.agency_id == current_user.id)
                    | (Property.created_by_id == current_user.id)
                )
            else:
                # opener / tenant / company have no access to the property list
                raise HTTPException(403, "Accès réservé aux propriétaires et agences")

        # Optional filters
        if type:
            base_q = base_q.where(Property.type == type)
        if status:
            base_q = base_q.where(Property.status == status)
        if city:
            base_q = base_q.where(Property.city.ilike(f"%{city}%"))
        if owner_id and current_user.role == "super_admin":
            base_q = base_q.where(Property.owner_id == owner_id)
        if agency_id and current_user.role in ("super_admin", "agency"):
            base_q = base_q.where(Property.agency_id == agency_id)

        # Count
        count_q = select(func.count()).select_from(base_q.subquery())
        total: int = (await self.db.execute(count_q)).scalar_one()

        # Paginate
        offset = (page - 1) * size
        items_q = base_q.order_by(Property.created_at.desc()).offset(offset).limit(size)
        rows = (await self.db.execute(items_q)).scalars().all()

        return PaginatedProperties(
            items=[PropertyRead.model_validate(r) for r in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    # ── Create ────────────────────────────────────────────────────────────────

    async def create(self, payload: PropertyCreate, current_user: User) -> Property:
        uid = current_user.id
        prop = Property(
            owner_id=uid,
            created_by_id=uid,
            agency_id=uid if current_user.role == "agency" else None,
            **payload.model_dump(),
        )
        self.db.add(prop)
        await self.db.flush()
        await self.db.refresh(prop)
        await self._log(current_user, "create", str(prop.id), new_values=payload.model_dump())
        return prop

    # ── Get detail ────────────────────────────────────────────────────────────

    async def get_detail(self, property_id: str, current_user: User) -> PropertyDetail | None:
        prop = await self._get(property_id)
        if prop is None:
            return None

        # Load images
        img_rows = (
            (
                await self.db.execute(
                    select(PropertyImage)
                    .where(PropertyImage.property_id == prop.id)
                    .order_by(PropertyImage.order)
                )
            )
            .scalars()
            .all()
        )

        # Load documents
        doc_rows = (
            (
                await self.db.execute(
                    select(PropertyDocument).where(PropertyDocument.property_id == prop.id)
                )
            )
            .scalars()
            .all()
        )

        detail = PropertyDetail.model_validate(prop)
        detail.images = [PropertyImageResponse.model_validate(r) for r in img_rows]
        detail.documents = [PropertyDocumentResponse.model_validate(r) for r in doc_rows]
        return detail

    # ── Update ────────────────────────────────────────────────────────────────

    async def update(
        self, property_id: str, payload: PropertyUpdate, current_user: User
    ) -> Property | None:
        prop = await self._get(property_id)
        if prop is None:
            return None
        if not _can_write(prop, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

        old = {k: getattr(prop, k) for k in payload.model_fields}
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(prop, field, value)
        await self.db.flush()
        await self.db.refresh(prop)
        await self._log(
            current_user,
            "update",
            str(prop.id),
            old_values=old,
            new_values=payload.model_dump(exclude_unset=True),
        )
        return prop

    # ── Soft delete ───────────────────────────────────────────────────────────

    async def delete(self, property_id: str, current_user: User) -> bool:
        prop = await self._get(property_id)
        if prop is None:
            return False
        if not _can_write(prop, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
        prop.is_active = False
        await self.db.flush()
        await self._log(current_user, "delete", str(prop.id))
        return True

    # ── Images ────────────────────────────────────────────────────────────────

    async def add_image(
        self,
        property_id: str,
        file: UploadFile,
        is_cover: bool,
        current_user: User,
    ) -> PropertyImageResponse:
        prop = await self._get_or_404(property_id)
        if not _can_write(prop, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

        content_type = file.content_type or "image/jpeg"
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unsupported image type: {content_type}"
            )

        data = await file.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 10 MB)"
            )

        ext = mimetypes.guess_extension(content_type) or ".jpg"
        image_id = uuid.uuid4()
        path = f"{property_id}/{image_id}{ext}"
        url = await _upload_to_storage("property-images", path, data, content_type)

        # Count existing images to set order
        count = (
            await self.db.execute(select(func.count()).where(PropertyImage.property_id == prop.id))
        ).scalar_one()

        # Unset previous cover if needed
        if is_cover:
            covers = (
                (
                    await self.db.execute(
                        select(PropertyImage).where(
                            PropertyImage.property_id == prop.id,
                            PropertyImage.is_cover.is_(True),
                        )
                    )
                )
                .scalars()
                .all()
            )
            for c in covers:
                c.is_cover = False

        img = PropertyImage(
            id=image_id,
            property_id=prop.id,
            url=url,
            order=count,
            is_cover=is_cover,
        )
        self.db.add(img)
        await self.db.flush()
        await self.db.refresh(img)
        return PropertyImageResponse.model_validate(img)

    async def delete_image(self, property_id: str, image_id: str, current_user: User) -> bool:
        prop = await self._get_or_404(property_id)
        if not _can_write(prop, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

        result = await self.db.execute(
            select(PropertyImage).where(
                PropertyImage.id == uuid.UUID(image_id),
                PropertyImage.property_id == prop.id,
            )
        )
        img = result.scalar_one_or_none()
        if img is None:
            return False

        # Best-effort storage deletion (don't fail the DB op if storage fails)
        path = img.url.split("/property-images/")[-1] if "/property-images/" in img.url else None
        if path:
            await _delete_from_storage("property-images", path)

        await self.db.delete(img)
        await self.db.flush()
        return True

    # ── Documents ─────────────────────────────────────────────────────────────

    async def add_document(
        self,
        property_id: str,
        file: UploadFile,
        doc_type: str,
        current_user: User,
    ) -> PropertyDocumentResponse:
        prop = await self._get_or_404(property_id)
        if not _can_write(prop, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

        content_type = file.content_type or "application/pdf"
        if content_type not in ALLOWED_DOC_TYPES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unsupported document type: {content_type}"
            )

        data = await file.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 10 MB)"
            )

        ext = mimetypes.guess_extension(content_type) or ".pdf"
        doc_id = uuid.uuid4()
        path = f"{property_id}/{doc_id}{ext}"
        url = await _upload_to_storage("property-documents", path, data, content_type)

        doc = PropertyDocument(
            id=doc_id,
            property_id=prop.id,
            type=doc_type,
            url=url,
            name=file.filename or f"document{ext}",
        )
        self.db.add(doc)
        await self.db.flush()
        await self.db.refresh(doc)
        return PropertyDocumentResponse.model_validate(doc)

    # ── History ───────────────────────────────────────────────────────────────

    async def get_history(self, property_id: str, limit: int = 50) -> list[AuditLogResponse]:
        rows = (
            (
                await self.db.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.resource_type == "property",
                        AuditLog.resource_id == property_id,
                    )
                    .order_by(AuditLog.created_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [AuditLogResponse.model_validate(r) for r in rows]

    # ── AI description ────────────────────────────────────────────────────────

    async def generate_description(self, property_id: str, current_user: User) -> str:
        if not settings.ANTHROPIC_API_KEY:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Claude API not configured")

        prop = await self._get_or_404(property_id)
        if not _can_write(prop, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

        features = []
        if prop.surface:
            features.append(f"{prop.surface} m²")
        if prop.rooms:
            features.append(f"{prop.rooms} pièce(s)")
        if prop.floor is not None:
            features.append(f"étage {prop.floor}")
        if prop.is_furnished:
            features.append("meublé")
        if prop.has_parking:
            features.append("parking")
        if prop.pets_allowed:
            features.append("animaux acceptés")

        prompt = (
            f"Rédige une description immobilière professionnelle en français pour ce bien :\n"
            f"- Type : {prop.type}\n"
            f"- Adresse : {prop.address}, {prop.city} ({prop.zip_code})\n"
            f"- Caractéristiques : {', '.join(features) or 'non renseignées'}\n"
            f"- Loyer mensuel : {prop.monthly_rent} € CC"
            if prop.monthly_rent
            else f"- Prix de vente : {prop.price_sale} €"
            if prop.price_sale
            else ""
            "\nLa description doit faire 2-3 paragraphes, être engageante et mettre en valeur le bien."
        )

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 512,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )

        if resp.status_code != 200:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Claude API error")

        description: str = resp.json()["content"][0]["text"]

        # Persist the generated description
        prop.description = description
        await self.db.flush()
        await self._log(
            current_user, "ai_description", str(prop.id), new_values={"description": description}
        )

        return description

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get(self, property_id: str) -> Property | None:
        try:
            pid = uuid.UUID(property_id)
        except ValueError:
            return None
        result = await self.db.execute(
            select(Property).where(Property.id == pid, Property.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def _get_or_404(self, property_id: str) -> Property:
        prop = await self._get(property_id)
        if prop is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Property not found")
        return prop

    async def _log(
        self,
        user: User,
        action: str,
        resource_id: str,
        old_values: dict | None = None,
        new_values: dict | None = None,
    ) -> None:
        log = AuditLog(
            user_id=user.id,
            action=action,
            resource_type="property",
            resource_id=resource_id,
            old_values=old_values,
            new_values=new_values,
        )
        self.db.add(log)
