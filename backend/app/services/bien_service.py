"""Bien service — logique métier CRUD bien + images + documents + équipements + IA.

Refonte 2026-04-23 : porté depuis property_service.py, adapté à la nouvelle table
`biens` (43 colonnes FR, location annuelle uniquement). Nouvelles responsabilités :
    - Auto-remplissage du canton depuis le NPA via ch_postal_codes (Phase 1 : ~230 NPAs)
    - Gestion des équipements (catalogue global + jonction bien_equipements)

Storage Supabase :
    Bucket bien-images    : configurable via SUPABASE_BUCKET_BIEN_IMAGES
                            (défaut: property-images) → {bien_id}/{image_id}.{ext}
    Bucket bien-documents : configurable via SUPABASE_BUCKET_BIEN_DOCUMENTS
                            (défaut: property-documents) → {bien_id}/{doc_id}.{ext}
"""

from __future__ import annotations

import logging
import math
import mimetypes
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

import httpx

logger = logging.getLogger(__name__)
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.bien import (
    Bien,
    BienDocument,
    BienEquipement,
    BienImage,
    CatalogueEquipement,
)
from app.models.intervention import Intervention
from app.models.locataire import Locataire
from app.models.paiement import Paiement
from app.schemas.bien import (
    AuditLogResponse,
    BienCreate,
    BienDetail,
    BienDocumentRead,
    BienImageRead,
    BienImageUpdate,
    BienListItem,
    BienRead,
    BienUpdate,
    CatalogueEquipementRead,
    EstimationFiscalite,
    EstimationIAEnrichie,
    EstimationLocalite,
    EstimationLocation,
    PaginatedBiens,
    PotentielIAResponse,
    RendementDeduction,
    RendementNetResponse,
)
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import extract, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.user import User


# ── Supabase Storage helpers ──────────────────────────────────────────────────

_STORAGE_HEADERS = {
    "apikey": settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
}

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Rôles pouvant gérer (créer / modifier / supprimer) un bien
MANAGER_ROLES = {"super_admin", "proprio_solo", "agence"}


def _storage_url(bucket: str, path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"


def _public_url(bucket: str, path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


async def _upload_to_storage(bucket: str, path: str, data: bytes, content_type: str) -> str:
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


# ── Access helpers ────────────────────────────────────────────────────────────


def _can_write(bien: Bien, user: User) -> bool:
    if user.role == "super_admin":
        return True
    uid = user.id
    return bien.owner_id == uid or bien.created_by_id == uid or bien.agency_id == uid


# ── Canton auto-fill ──────────────────────────────────────────────────────────


async def get_canton_from_cp(db: AsyncSession, cp: str) -> str | None:
    """Retourne le canton pour un NPA donné via la table ch_postal_codes.

    Seed Phase 1 : ~230 NPAs (GE/VD/VS/FR/NE/JU + chefs-lieux ZH/BE/BS/TI).
    NPA non couvert → None (l'utilisateur peut remplir à la main).
    """
    if not cp or len(cp) != 4 or not cp.isdigit():
        return None
    row = await db.execute(
        text("SELECT canton FROM ch_postal_codes WHERE code_postal = :cp"),
        {"cp": cp},
    )
    val = row.scalar_one_or_none()
    return val


# ══════════════════════════════════════════════════════════════════════════════
# Service
# ══════════════════════════════════════════════════════════════════════════════


class BienService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # List
    # ─────────────────────────────────────────────────────────────────────────

    async def list(
        self,
        current_user: User,
        page: int = 1,
        size: int = 20,
        type: str | None = None,
        statut: str | None = None,
        ville: str | None = None,
        canton: str | None = None,
        owner_id: str | None = None,
        agency_id: str | None = None,
    ) -> PaginatedBiens:
        base_q = select(Bien).where(Bien.is_active.is_(True))

        # Scope by role
        if current_user.role != "super_admin":
            if current_user.role in ("proprio_solo", "agence"):
                base_q = base_q.where(
                    (Bien.owner_id == current_user.id)
                    | (Bien.agency_id == current_user.id)
                    | (Bien.created_by_id == current_user.id)
                )
            else:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Accès réservé aux propriétaires et agences",
                )

        # Filtres
        if type:
            base_q = base_q.where(Bien.type == type)
        if statut:
            base_q = base_q.where(Bien.statut == statut)
        if ville:
            base_q = base_q.where(Bien.ville.ilike(f"%{ville}%"))
        if canton:
            base_q = base_q.where(Bien.canton == canton)
        if owner_id and current_user.role == "super_admin":
            base_q = base_q.where(Bien.owner_id == owner_id)
        if agency_id and current_user.role in ("super_admin", "agence"):
            base_q = base_q.where(Bien.agency_id == agency_id)

        # Count total
        count_q = select(func.count()).select_from(base_q.subquery())
        total: int = (await self.db.execute(count_q)).scalar_one()

        # Paginate
        offset = (page - 1) * size
        items_q = base_q.order_by(Bien.created_at.desc()).offset(offset).limit(size)
        rows = (await self.db.execute(items_q)).scalars().all()

        # Batch-load des images couvertures pour les biens listés
        from collections import defaultdict

        imgs_by_bien: dict = defaultdict(list)
        if rows:
            bien_ids = [r.id for r in rows]
            img_rows = (
                await self.db.execute(
                    select(BienImage)
                    .where(BienImage.bien_id.in_(bien_ids))
                    .order_by(BienImage.bien_id, BienImage.order)
                )
            ).scalars().all()
            for img in img_rows:
                imgs_by_bien[img.bien_id].append(BienImageRead.model_validate(img))

        items: list[BienListItem] = []
        for r in rows:
            item = BienListItem.model_validate(r)
            item.images = imgs_by_bien.get(r.id, [])
            items.append(item)

        return PaginatedBiens(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Create
    # ─────────────────────────────────────────────────────────────────────────

    async def create(self, payload: BienCreate, current_user: User) -> Bien:
        if current_user.role not in MANAGER_ROLES:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Seuls les propriétaires et agences peuvent créer un bien"
            )

        uid = current_user.id
        data = payload.model_dump()

        # Auto-remplissage canton depuis le cp si pas fourni
        if not data.get("canton") and data.get("cp"):
            detected = await get_canton_from_cp(self.db, data["cp"])
            if detected:
                data["canton"] = detected

        bien = Bien(
            **data,
            owner_id=uid,
            created_by_id=uid,
            agency_id=uid if current_user.role == "agence" else None,
        )
        self.db.add(bien)
        await self.db.flush()
        await self.db.refresh(bien)
        await self._log(current_user, "create", str(bien.id), new_values=data)
        return bien

    # ─────────────────────────────────────────────────────────────────────────
    # Read — single
    # ─────────────────────────────────────────────────────────────────────────

    async def get_detail(self, bien_id: str, current_user: User) -> BienDetail | None:
        bien = await self._get(bien_id)
        if bien is None:
            return None
        if not self._can_read(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        # Images
        img_rows = (
            await self.db.execute(
                select(BienImage)
                .where(BienImage.bien_id == bien.id)
                .order_by(BienImage.order)
            )
        ).scalars().all()

        # Documents
        doc_rows = (
            await self.db.execute(
                select(BienDocument).where(BienDocument.bien_id == bien.id)
            )
        ).scalars().all()

        # Équipements (via jonction + catalogue)
        eq_rows = (
            await self.db.execute(
                select(CatalogueEquipement)
                .join(BienEquipement, BienEquipement.equipement_id == CatalogueEquipement.id)
                .where(BienEquipement.bien_id == bien.id)
                .order_by(CatalogueEquipement.ordre_affichage)
            )
        ).scalars().all()

        detail = BienDetail.model_validate(bien)
        detail.images = [BienImageRead.model_validate(r) for r in img_rows]
        detail.documents = [BienDocumentRead.model_validate(r) for r in doc_rows]
        detail.equipements = [CatalogueEquipementRead.model_validate(r) for r in eq_rows]
        return detail

    # ─────────────────────────────────────────────────────────────────────────
    # Update
    # ─────────────────────────────────────────────────────────────────────────

    async def update(
        self, bien_id: str, payload: BienUpdate, current_user: User
    ) -> Bien | None:
        bien = await self._get(bien_id)
        if bien is None:
            return None
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Modification refusée")

        old = {k: getattr(bien, k) for k in payload.model_fields}
        data = payload.model_dump(exclude_unset=True)

        # Si on change le CP et pas le canton explicitement → re-derive canton
        if "cp" in data and "canton" not in data:
            detected = await get_canton_from_cp(self.db, data["cp"])
            if detected:
                data["canton"] = detected

        for field, value in data.items():
            setattr(bien, field, value)

        await self.db.flush()
        await self.db.refresh(bien)
        await self._log(
            current_user, "update", str(bien.id),
            old_values={k: _serializable(v) for k, v in old.items()},
            new_values={k: _serializable(v) for k, v in data.items()},
        )
        return bien

    # ─────────────────────────────────────────────────────────────────────────
    # Soft delete
    # ─────────────────────────────────────────────────────────────────────────

    async def delete(self, bien_id: str, current_user: User) -> bool:
        """Soft delete d'un bien (rétrocompat — usage interne sans checks)."""
        bien = await self._get(bien_id)
        if bien is None:
            return False
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Suppression refusée")
        bien.is_active = False
        await self.db.flush()
        await self._log(current_user, "delete", str(bien.id))
        return True

    async def delete_with_checks(
        self,
        bien_id: uuid.UUID | str,
        current_user: User,
    ) -> dict:
        """Soft delete avec vérifications préalables (PR-A10).

        Bloque la suppression si :
          - locataire `actif` rattaché au bien
          - paiement(s) `en_attente` ou `retard`
          - intervention(s) `nouveau`/`en_cours`/`planifie`

        Retour :
          - {"success": True, "message": "..."}    → 200
          - {"success": False, "blockers": [...]}  → 409 côté router

        Soft delete + audit log conservés (pas de hard delete — cf
        docs/6-LEGAL.md §6.12 : préservation traçabilité).
        """
        bien = await self._get(bien_id)
        if bien is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Suppression refusée")

        bien_uuid = bien.id
        blockers: list[str] = []

        # 1. Locataire actif ?
        locataire_q = await self.db.execute(
            select(Locataire.id)
            .where(Locataire.bien_id == bien_uuid, Locataire.statut == "actif")
            .limit(1)
        )
        if locataire_q.scalar_one_or_none() is not None:
            blockers.append("Un locataire est actuellement en bail sur ce bien")

        # 2. Paiements en attente ou en retard ?
        paiement_q = await self.db.execute(
            select(Paiement.id)
            .where(
                Paiement.bien_id == bien_uuid,
                Paiement.statut.in_(["en_attente", "retard"]),
            )
            .limit(1)
        )
        if paiement_q.scalar_one_or_none() is not None:
            blockers.append("Des paiements sont en attente ou en retard")

        # 3. Interventions actives ?
        intervention_q = await self.db.execute(
            select(Intervention.id)
            .where(
                Intervention.bien_id == bien_uuid,
                Intervention.statut.in_(["nouveau", "en_cours", "planifie"]),
            )
            .limit(1)
        )
        if intervention_q.scalar_one_or_none() is not None:
            blockers.append("Des interventions sont en cours ou planifiées")

        if blockers:
            return {"success": False, "blockers": blockers}

        # Soft delete + audit
        bien.is_active = False
        await self.db.flush()
        await self._log(current_user, "delete", str(bien.id))

        return {
            "success": True,
            "message": "Bien archivé. Restauration possible Phase 2.",
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Images
    # ─────────────────────────────────────────────────────────────────────────

    async def add_image(
        self,
        bien_id: str,
        file: UploadFile,
        is_cover: bool,
        current_user: User,
    ) -> BienImageRead:
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        content_type = file.content_type or "image/jpeg"
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Format image non supporté : {content_type}",
            )

        data = await file.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Fichier trop gros (max 10 MB)",
            )

        ext = mimetypes.guess_extension(content_type) or ".jpg"
        image_id = uuid.uuid4()
        path = f"{bien_id}/{image_id}{ext}"
        url = await _upload_to_storage(
            settings.SUPABASE_BUCKET_BIEN_IMAGES, path, data, content_type
        )

        count = (
            await self.db.execute(
                select(func.count()).where(BienImage.bien_id == bien.id)
            )
        ).scalar_one()

        if is_cover:
            covers = (
                await self.db.execute(
                    select(BienImage).where(
                        BienImage.bien_id == bien.id, BienImage.is_cover.is_(True)
                    )
                )
            ).scalars().all()
            for c in covers:
                c.is_cover = False

        img = BienImage(
            id=image_id,
            bien_id=bien.id,
            url=url,
            order=count,
            is_cover=is_cover,
        )
        self.db.add(img)
        await self.db.flush()
        await self.db.refresh(img)
        return BienImageRead.model_validate(img)

    async def update_image(
        self,
        bien_id: uuid.UUID | str,
        image_id: uuid.UUID,
        payload: BienImageUpdate,
        current_user: User,
    ) -> BienImageRead | None:
        """PATCH partiel d'une image attachée au bien.

        Champs supportés :
          - is_cover : si True, force l'unicité du flag sur le bien
            (toutes les autres images repassent à False dans la même
            transaction).
          - order    : repositionne une image individuellement.

        Retour : BienImageRead à jour, ou None si l'image n'existe pas
        (le router lève alors un 404).
        """
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        result = await self.db.execute(
            select(BienImage).where(
                BienImage.id == image_id,
                BienImage.bien_id == bien.id,
            )
        )
        img = result.scalar_one_or_none()
        if img is None:
            return None

        data = payload.model_dump(exclude_unset=True)

        # Bascule la couverture : on force l'unicité avant d'appliquer
        # le True sur l'image cible. Si is_cover=False est passé
        # explicitement, on l'applique tel quel sans toucher aux autres.
        if data.get("is_cover") is True:
            other_covers = (
                await self.db.execute(
                    select(BienImage).where(
                        BienImage.bien_id == bien.id,
                        BienImage.id != image_id,
                        BienImage.is_cover.is_(True),
                    )
                )
            ).scalars().all()
            for c in other_covers:
                c.is_cover = False

        for field, value in data.items():
            setattr(img, field, value)

        await self.db.flush()
        await self.db.refresh(img)
        return BienImageRead.model_validate(img)

    async def reorder_images(
        self,
        bien_id: uuid.UUID | str,
        order: list[uuid.UUID],
        current_user: User,
    ) -> list[BienImageRead]:
        """Reorder atomique des images d'un bien.

        Le payload doit lister TOUS les IDs d'images du bien dans le nouvel
        ordre. Validation stricte : ensembles `payload` ↔ `existants` doivent
        être égaux. Toute divergence (manquant, inconnu, doublon) → 400.

        Écriture : `order = idx` séquentiellement (0-based) dans la même
        transaction.
        """
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        if len(order) != len(set(order)):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "IDs en doublon dans le payload",
            )

        existing = (
            await self.db.execute(
                select(BienImage).where(BienImage.bien_id == bien.id)
            )
        ).scalars().all()
        existing_by_id: dict[uuid.UUID, BienImage] = {img.id: img for img in existing}

        existing_ids: set[uuid.UUID] = set(existing_by_id.keys())
        payload_ids: set[uuid.UUID] = set(order)
        if payload_ids != existing_ids:
            missing = existing_ids - payload_ids
            unknown = payload_ids - existing_ids
            details: list[str] = []
            if missing:
                details.append(f"manquants : {sorted(str(i) for i in missing)}")
            if unknown:
                details.append(f"inconnus : {sorted(str(i) for i in unknown)}")
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Le payload doit lister exactement toutes les images du bien "
                f"({'; '.join(details)})",
            )

        image_id: uuid.UUID
        for idx, image_id in enumerate(order):
            existing_by_id[image_id].order = idx

        await self.db.flush()

        rows = (
            await self.db.execute(
                select(BienImage)
                .where(BienImage.bien_id == bien.id)
                .order_by(BienImage.order)
            )
        ).scalars().all()
        return [BienImageRead.model_validate(r) for r in rows]

    async def delete_image(
        self, bien_id: uuid.UUID | str, image_id: uuid.UUID, current_user: User
    ) -> bool:
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        result = await self.db.execute(
            select(BienImage).where(
                BienImage.id == image_id,
                BienImage.bien_id == bien.id,
            )
        )
        img = result.scalar_one_or_none()
        if img is None:
            return False

        bucket = settings.SUPABASE_BUCKET_BIEN_IMAGES
        marker = f"/{bucket}/"
        path = img.url.split(marker)[-1] if marker in img.url else None
        if path:
            await _delete_from_storage(bucket, path)

        await self.db.delete(img)
        await self.db.flush()
        return True

    # ─────────────────────────────────────────────────────────────────────────
    # Documents
    # ─────────────────────────────────────────────────────────────────────────

    async def add_document(
        self,
        bien_id: str,
        file: UploadFile,
        doc_type: str,
        current_user: User,
    ) -> BienDocumentRead:
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        content_type = file.content_type or "application/pdf"
        if content_type not in ALLOWED_DOC_TYPES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Format document non supporté : {content_type}",
            )

        data = await file.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Fichier trop gros (max 10 MB)",
            )

        ext = mimetypes.guess_extension(content_type) or ".pdf"
        doc_id = uuid.uuid4()
        path = f"{bien_id}/{doc_id}{ext}"
        url = await _upload_to_storage(
            settings.SUPABASE_BUCKET_BIEN_DOCUMENTS, path, data, content_type
        )

        doc = BienDocument(
            id=doc_id,
            bien_id=bien.id,
            type=doc_type,
            url=url,
            name=file.filename or f"document{ext}",
        )
        self.db.add(doc)
        await self.db.flush()
        await self.db.refresh(doc)
        return BienDocumentRead.model_validate(doc)

    # ─────────────────────────────────────────────────────────────────────────
    # Équipements
    # ─────────────────────────────────────────────────────────────────────────

    async def set_equipements(
        self, bien_id: str, equipement_ids: list[uuid.UUID], current_user: User
    ) -> list[CatalogueEquipementRead]:
        """Remplace la liste complète des équipements pour un bien."""
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        # Valider que tous les equipement_ids existent
        if equipement_ids:
            existing = (
                await self.db.execute(
                    select(CatalogueEquipement.id).where(
                        CatalogueEquipement.id.in_(equipement_ids)
                    )
                )
            ).scalars().all()
            existing_set = set(existing)
            unknown = [str(eid) for eid in equipement_ids if eid not in existing_set]
            if unknown:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"Équipements inconnus : {unknown}",
                )

        # Purge existants
        await self.db.execute(
            text("DELETE FROM bien_equipements WHERE bien_id = :bid"),
            {"bid": str(bien.id)},
        )

        # Ajout des nouveaux
        for eq_id in equipement_ids:
            self.db.add(BienEquipement(bien_id=bien.id, equipement_id=eq_id))

        await self.db.flush()

        # Relire la liste triée
        rows = (
            await self.db.execute(
                select(CatalogueEquipement)
                .join(BienEquipement, BienEquipement.equipement_id == CatalogueEquipement.id)
                .where(BienEquipement.bien_id == bien.id)
                .order_by(CatalogueEquipement.ordre_affichage)
            )
        ).scalars().all()

        return [CatalogueEquipementRead.model_validate(r) for r in rows]

    async def remove_equipement(
        self, bien_id: uuid.UUID | str, equipement_id: uuid.UUID, current_user: User
    ) -> bool:
        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        result = await self.db.execute(
            text("""
                DELETE FROM bien_equipements
                WHERE bien_id = :bid AND equipement_id = :eid
            """),
            {"bid": str(bien.id), "eid": str(equipement_id)},
        )
        await self.db.flush()
        return (result.rowcount or 0) > 0

    async def get_equipements(
        self, bien_id: str, current_user: User
    ) -> list[CatalogueEquipementRead]:
        bien = await self._get_or_404(bien_id)
        if not self._can_read(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        rows = (
            await self.db.execute(
                select(CatalogueEquipement)
                .join(BienEquipement, BienEquipement.equipement_id == CatalogueEquipement.id)
                .where(BienEquipement.bien_id == bien.id)
                .order_by(CatalogueEquipement.ordre_affichage)
            )
        ).scalars().all()
        return [CatalogueEquipementRead.model_validate(r) for r in rows]

    # ─────────────────────────────────────────────────────────────────────────
    # History (audit log)
    # ─────────────────────────────────────────────────────────────────────────

    async def get_history(self, bien_id: str, limit: int = 50) -> list[AuditLogResponse]:
        # `audit_logs.resource_id` is `String(36)` (varchar) — see app.models.audit_log.
        # The router passes `bien_id` as `uuid.UUID`, which PostgreSQL refuses to
        # compare to a varchar column ("operator does not exist: character varying = uuid").
        # Cast to str unconditionally to keep both call sites (UUID + str) working.
        bien_id_str = str(bien_id)
        rows = (
            await self.db.execute(
                select(AuditLog)
                .where(
                    AuditLog.resource_type == "bien",
                    AuditLog.resource_id == bien_id_str,
                )
                .order_by(AuditLog.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [AuditLogResponse.model_validate(r) for r in rows]

    # ─────────────────────────────────────────────────────────────────────────
    # AI description
    # ─────────────────────────────────────────────────────────────────────────

    async def generate_description(self, bien_id: str, current_user: User) -> str:
        if not settings.ANTHROPIC_API_KEY:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "Claude API non configurée"
            )

        bien = await self._get_or_404(bien_id)
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

        features = []
        if bien.surface:
            features.append(f"{bien.surface} m²")
        if bien.rooms:
            features.append(f"{bien.rooms} pièce(s)")
        if bien.etage is not None:
            features.append(f"étage {bien.etage}")
        if bien.is_furnished:
            features.append("meublé")
        if bien.parking_type:
            features.append(f"parking {bien.parking_type.replace('_', ' ')}")
        if bien.pets_allowed:
            features.append("animaux acceptés")

        prompt = (
            f"Rédige une description immobilière professionnelle en français pour ce bien suisse :\n"
            f"- Type : {bien.type}\n"
            f"- Adresse : {bien.adresse}, {bien.cp} {bien.ville} ({bien.canton or 'Suisse'})\n"
            f"- Caractéristiques : {', '.join(features) or 'non renseignées'}\n"
            f"- Loyer mensuel : CHF {bien.loyer}\n"
            if bien.loyer
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
        bien.description_logement = description
        await self.db.flush()
        await self._log(
            current_user, "ai_description", str(bien.id),
            new_values={"description_logement": description},
        )
        return description

    # ─────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _can_read(self, bien: Bien, user: User) -> bool:
        if user.role == "super_admin":
            return True
        return (
            bien.owner_id == user.id
            or bien.created_by_id == user.id
            or bien.agency_id == user.id
        )

    async def _get(self, bien_id: uuid.UUID | str) -> Bien | None:
        """Fetch le bien actif par id (accepte UUID ou str)."""
        try:
            bid = bien_id if isinstance(bien_id, uuid.UUID) else uuid.UUID(bien_id)
        except (ValueError, TypeError):
            return None
        result = await self.db.execute(
            select(Bien).where(Bien.id == bid, Bien.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def _get_or_404(self, bien_id: uuid.UUID | str) -> Bien:
        bien = await self._get(bien_id)
        if bien is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
        return bien

    # ─────────────────────────────────────────────────────────────────────────
    # Access check (public — utilisé par les routers pour les endpoints qui
    # n'ont pas besoin de load les relations lourdes comme images / documents)
    # ─────────────────────────────────────────────────────────────────────────

    async def get_for_access_check(
        self, bien_id: uuid.UUID | str, current_user: User
    ) -> Bien:
        """SELECT minimal + check accès en une seule requête.

        Raise HTTPException 404 si introuvable, 403 si pas d'accès.
        À utiliser dans les endpoints qui n'ont pas besoin de charger
        les relations (images/documents/équipements) pour faire leur job.
        """
        bien = await self._get(bien_id)
        if bien is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
        if not self._can_read(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        return bien

    # ─────────────────────────────────────────────────────────────────────────
    # Potentiel IA — analyse financière + recommandations Claude
    # ─────────────────────────────────────────────────────────────────────────

    async def get_potentiel_ia(
        self, bien_id: uuid.UUID | str, current_user: User
    ) -> PotentielIAResponse:
        """Calcul financier (blocs 1-4) + Claude pour recommandations textuelles (blocs 5-7).

        Fallback si Claude indisponible : recommandations génériques.
        """
        from anthropic import AsyncAnthropic

        bien = await self.get_for_access_check(bien_id, current_user)

        loyer = float(bien.loyer or 0)
        charges = float(bien.charges or 0)
        surface = float(bien.surface or 0)

        # ── Blocs 1–4 : calculs financiers ────────────────────────────────────
        # Multiplicateur suisse : 220–250x loyer mensuel brut (marché locatif CH)
        valeur_min = round(loyer * 200, 0) if loyer > 0 else 0.0
        valeur_max = round(loyer * 260, 0) if loyer > 0 else 0.0
        loyer_net_annuel = (loyer - charges) * 12
        valeur_mid = (valeur_min + valeur_max) / 2 if valeur_max > 0 else 1

        rendement_brut = (
            round((loyer * 12 / valeur_mid * 100), 2) if valeur_mid > 0 else 0.0
        )
        rendement_net = (
            round((loyer_net_annuel / valeur_mid * 100), 2) if valeur_mid > 0 else 0.0
        )

        loyer_marche = round(loyer * 1.04, 0) if loyer > 0 else 0.0
        ecart_marche_pct = (
            round(((loyer_marche - loyer) / loyer * 100), 1) if loyer > 0 else 0.0
        )

        # Score investissement (0–10)
        score = 5.0
        if rendement_brut >= 4.5:
            score += 1.5
        elif rendement_brut >= 3.5:
            score += 0.5
        if bien.statut == "loue":
            score += 1.0
        if surface >= 60:
            score += 0.5
        if loyer_marche > loyer:
            score += 0.5
        score = min(10.0, round(score, 1))

        # ── Blocs 5–7 : Claude ────────────────────────────────────────────────
        context = (
            f"Bien : {bien.type} à {bien.adresse}, {bien.cp} {bien.ville}\n"
            f"Surface : {surface} m²   Étage : {bien.etage or 'RDC'}\n"
            f"Loyer actuel : CHF {loyer}/mois   Charges : CHF {charges}/mois\n"
            f"Statut : {bien.statut}   Rendement brut estimé : {rendement_brut}%\n"
            f"Score investissement Althy : {score}/10"
        )

        try:
            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            response = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=600,
                system=(
                    "Tu es un expert immobilier suisse. "
                    "Réponds en JSON valide UNIQUEMENT avec ces 3 clés : "
                    '"recommandations" (liste de 3 strings, conseils actionnables courts), '
                    '"conseil_fiscal" (string, 1 conseil déduction fiscale CH concis), '
                    '"prochaine_action" (string, 1 action prioritaire immédiate). '
                    "Pas d'autre texte."
                ),
                messages=[{"role": "user", "content": context}],
            )
            import json as _json

            raw = response.content[0].text.strip()
            ia_data = _json.loads(raw)
            recommandations: list[str] = ia_data.get("recommandations", [])[:5]
            conseil_fiscal: str = ia_data.get("conseil_fiscal", "")
            prochaine_action: str = ia_data.get("prochaine_action", "")
        except Exception:
            recommandations = [
                "Vérifier les attestations d'assurance RC des locataires",
                "Comparer le loyer actuel avec le marché local",
                "Planifier une inspection annuelle du bien",
            ]
            conseil_fiscal = (
                "Déduisez les charges d'entretien, intérêts hypothécaires et frais de "
                "gérance de votre revenu imposable."
            )
            prochaine_action = "Vérifier la date d'échéance du prochain loyer."

        return PotentielIAResponse(
            valeur_min=valeur_min,
            valeur_max=valeur_max,
            rendement_brut=rendement_brut,
            rendement_net=rendement_net,
            loyer_actuel=loyer,
            loyer_marche=loyer_marche,
            ecart_marche_pct=ecart_marche_pct,
            score_investissement=score,
            recommandations=recommandations,
            conseil_fiscal=conseil_fiscal,
            prochaine_action=prochaine_action,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Rendement net (PR-B sprint 12)
    # Phase 1 : loyer_brut_annuel - cout_interventions (année civile).
    # Phase 2-3 : ajout commission Althy 3 %, commission agence, etc.
    #             — à insérer dans `deductions[]` sans rupture API.
    # ─────────────────────────────────────────────────────────────────────────

    async def get_rendement_net(
        self,
        bien_id: uuid.UUID | str,
        annee: int,
        current_user: User,
    ) -> RendementNetResponse:
        """Calcule le rendement net basique d'un bien sur une année donnée.

        Filtre les interventions par `created_at` (Date NOT NULL via BaseModel)
        plutôt que `date_intervention` (nullable) pour garantir que toutes
        les interventions signalées dans l'année comptent dans le coût,
        même si la date d'intervention finale n'est pas encore renseignée.
        """
        bien = await self.get_for_access_check(bien_id, current_user)

        # Loyer brut annuel
        loyer_mensuel = Decimal(str(bien.loyer or 0))
        loyer_brut_annuel = loyer_mensuel * 12

        # Coût total interventions année civile (somme cout, ignore NULL)
        cout_query = select(
            func.coalesce(func.sum(Intervention.cout), 0)
        ).where(
            Intervention.bien_id == bien.id,
            extract("year", Intervention.created_at) == annee,
        )
        cout_total = (await self.db.execute(cout_query)).scalar() or 0
        cout_interventions = Decimal(str(cout_total))

        # Construction extensible des déductions (Phase 1 : interventions seulement)
        deductions: list[RendementDeduction] = []
        if cout_interventions > 0:
            deductions.append(
                RendementDeduction(
                    type="interventions",
                    montant=cout_interventions,
                    label=f"Coût interventions {annee}",
                )
            )

        # Calcul rendement net
        rendement_net_chf = loyer_brut_annuel - cout_interventions
        if rendement_net_chf < 0:
            rendement_net_chf = Decimal("0")

        if loyer_brut_annuel > 0:
            rendement_net_pct = (rendement_net_chf / loyer_brut_annuel) * 100
            rendement_net_pct = rendement_net_pct.quantize(Decimal("0.01"))
        else:
            rendement_net_pct = Decimal("0")

        return RendementNetResponse(
            annee=annee,
            loyer_brut_annuel=loyer_brut_annuel,
            deductions=deductions,
            rendement_net_chf=rendement_net_chf,
            rendement_net_pct=rendement_net_pct,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Estimation IA enrichie v2 (PR-A9.1 sprint 12)
    # Endpoint /potentiel-v2 — parallèle à l'ancien /potentiel.
    # Refonte complète : analyse localité, 3 scénarios location, fiscalité,
    # 3 scores (investissement, locatif, revente).
    # ─────────────────────────────────────────────────────────────────────────

    async def get_potentiel_ia_v2(
        self,
        bien_id: uuid.UUID | str,
        current_user: User,
    ) -> EstimationIAEnrichie:
        """Estimation IA enrichie. Phase 1 : Claude Sonnet 4.6 + knowledge.

        Logging détaillé (PR-A9.3) pour diagnostiquer pourquoi le fallback
        se déclenche en prod : check API key, longueur réponse, JSON parse,
        validation Pydantic.
        """
        from datetime import datetime, timezone

        bien = await self.get_for_access_check(bien_id, current_user)
        contexte = self._build_contexte_enrichi(bien)

        logger.info("Estim IA v2 — calling Claude for bien %s", bien.id)

        try:
            data = await self._call_claude_estimation_v2(contexte)
        except Exception as exc:
            # Échec amont : API key, network, timeout, JSON decode, code-fences mal strippées.
            logger.error(
                "Estim IA v2 — Claude call failed for bien %s: %s: %s",
                bien.id,
                type(exc).__name__,
                exc,
            )
            return self._fallback_estimation_v2(bien)

        try:
            logger.info(
                "Estim IA v2 — Claude returned %d top-level keys for bien %s",
                len(data),
                bien.id,
            )
            data["bien_id"] = str(bien.id)
            data["generated_at"] = datetime.now(timezone.utc)
            data["model_used"] = "claude-sonnet-4-6"
            data.setdefault("meuble", bool(bien.is_furnished))
            data.setdefault("residence_type", bien.residence_type or "secondaire")
            data.setdefault("location_type_actuel", bien.location_type_actuel)
            return EstimationIAEnrichie(**data)
        except Exception as exc:
            # Validation Pydantic échoue (champs manquants, types invalides, etc.).
            logger.error(
                "Estim IA v2 — Pydantic validation failed for bien %s: %s: %s "
                "| keys received: %s",
                bien.id,
                type(exc).__name__,
                exc,
                sorted(data.keys()) if isinstance(data, dict) else type(data).__name__,
            )
            return self._fallback_estimation_v2(bien)

    def _build_contexte_enrichi(self, bien: Bien) -> dict:
        """Construit le contexte riche (~25 champs) envoyé à Claude."""
        return {
            "id": str(bien.id),
            "type": bien.type,
            "adresse": bien.adresse,
            "ville": bien.ville,
            "cp": bien.cp,
            "canton": bien.canton,
            # Caractéristiques
            "surface_m2": float(bien.surface) if bien.surface else None,
            "rooms": float(bien.rooms) if bien.rooms else None,
            "bedrooms": bien.bedrooms,
            "bathrooms": bien.bathrooms,
            "etage": bien.etage,
            "annee_construction": bien.annee_construction,
            "annee_renovation": bien.annee_renovation,
            "classe_energetique": bien.classe_energetique,
            # Configuration
            "is_furnished": bool(bien.is_furnished),
            "residence_type": bien.residence_type or "secondaire",
            "location_type_actuel": bien.location_type_actuel or "vide",
            # Équipements
            "has_balcony": bool(bien.has_balcony),
            "has_terrace": bool(bien.has_terrace),
            "has_garden": bool(bien.has_garden),
            "has_storage": bool(bien.has_storage),
            "has_fireplace": bool(bien.has_fireplace),
            "parking_type": bien.parking_type,
            "pets_allowed": bool(bien.pets_allowed),
            # Distances (situation)
            "distance_gare_min": bien.distance_gare_minutes,
            "distance_bus_min": bien.distance_arret_bus_minutes,
            "distance_telecabine_min": bien.distance_telecabine_minutes,
            "distance_lac_min": bien.distance_lac_minutes,
            "distance_aeroport_min": bien.distance_aeroport_minutes,
            # Description
            "description_lieu": bien.description_lieu,
            "description_logement": bien.description_logement,
            "situation_notes": bien.situation_notes,
            # Finances actuelles
            "loyer_mensuel_chf": float(bien.loyer) if bien.loyer else None,
            "charges_mensuelles_chf": float(bien.charges) if bien.charges else None,
            "statut": bien.statut,
            # Coords (Claude peut affiner le quartier)
            "lat": bien.lat,
            "lng": bien.lng,
        }

    async def _call_claude_estimation_v2(self, contexte: dict) -> dict:
        """Appel Claude API avec prompt système enrichi. Retourne dict JSON parsé."""
        import json as _json

        from anthropic import AsyncAnthropic

        prompt_systeme = (
            "Tu es un expert immobilier suisse senior avec 20 ans d'expérience. "
            "Tu analyses des biens en détail pour fournir une estimation complète "
            "et nuancée selon le contexte local suisse.\n\n"
            "CONNAISSANCE MARCHÉ SUISSE (référence) :\n"
            "- Genève / Vaud : appartements ~CHF 7'000-12'000/m² vente, "
            "~CHF 25-45/m²/mois loyer\n"
            "- Valais (hors stations) : ~CHF 5'000-9'000/m²\n"
            "- Fribourg / Neuchâtel : ~CHF 5'500-8'500/m²\n"
            "- Stations ski (Crans-Montana, Verbier, Zermatt, Saas-Fee) : "
            "×3-5 vs Plaine\n"
            "- Lausanne / Berne : ~CHF 8'000-13'000/m²\n"
            "- Tessin : ~CHF 6'000-10'000/m²\n\n"
            "CADRE LÉGAL SUISSE :\n"
            "- LRA Valais : limite 90 jours/an de location courte durée pour "
            "résidences secondaires\n"
            "- Lex Weber : interdiction nouvelles résidences secondaires "
            ">20 % dans communes saturées\n"
            "- Permis communaux requis pour location saisonnière (variable)\n"
            "- Fiscalité : valeur locative imposable pour résidence principale "
            "propriétaire-occupant\n\n"
            "INSTRUCTIONS :\n"
            "- Toujours fournir 3 scénarios (annuelle, saisonniere, semaine)\n"
            "- Fourchettes (min-max) plutôt que valeurs ponctuelles\n"
            "- Identifier contraintes légales SPÉCIFIQUES à la localité\n"
            "- confidence_score entre 0 et 10 selon richesse des infos\n"
            "- Réponds UNIQUEMENT en JSON valide selon le schéma demandé\n\n"
            "FORMAT JSON STRICT (toutes les clés obligatoires) :\n"
            "{\n"
            '  "confidence_score": <0-10>,\n'
            '  "valeur_estimee_chf_min": <number>,\n'
            '  "valeur_estimee_chf_max": <number>,\n'
            '  "valeur_par_m2_estimee_chf": <number>,\n'
            '  "localite": {"canton","ville","quartier","prix_moyen_m2_vente_chf",'
            '"prix_moyen_m2_loyer_an_chf","tendance_12_mois",'
            '"delai_vente_moyen_jours","note_attractivite","notes_locales"},\n'
            '  "location_annuelle": {"type":"annuelle","revenu_brut_an_chf_min",'
            '"revenu_brut_an_chf_max","taux_occupation_estime_pct",'
            '"rendement_brut_pct","rendement_net_estime_pct",'
            '"contraintes":[],"avantages":[],"warnings":[],"recommandation"},\n'
            '  "location_saisonniere": {idem type:"saisonniere"},\n'
            '  "location_semaine": {idem type:"semaine"},\n'
            '  "location_recommandee": "<annuelle|saisonniere|semaine>",\n'
            '  "raison_recommandation": "<string>",\n'
            '  "fiscalite": {"impot_revenu_locatif_estime_chf_an",'
            '"deductions_possibles":[],"valeur_locative_estimee_chf",'
            '"conseil_fiscal_principal"},\n'
            '  "points_forts":[], "points_amelioration":[], '
            '"actions_recommandees":[], "prochaine_action_prioritaire",\n'
            '  "score_investissement":<0-10>, "score_locatif":<0-10>, '
            '"score_revente":<0-10>\n'
            "}\n\n"
            "Pas de texte en dehors du JSON."
        )

        prompt_user = (
            "Analyse ce bien et fournis une estimation enrichie complète.\n\n"
            "BIEN À ANALYSER :\n"
            f"{_json.dumps(contexte, indent=2, ensure_ascii=False, default=str)}"
        )

        # Garde-fou explicite — log clair si la clé n'est pas configurée Railway.
        if not settings.ANTHROPIC_API_KEY:
            logger.error("Estim IA v2 — ANTHROPIC_API_KEY missing in settings")
            raise RuntimeError("ANTHROPIC_API_KEY not configured")

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=prompt_systeme,
            messages=[{"role": "user", "content": prompt_user}],
            timeout=60.0,
        )

        raw = response.content[0].text or ""
        logger.info(
            "Estim IA v2 — Claude raw response length: %d chars (model=%s)",
            len(raw),
            getattr(response, "model", "unknown"),
        )

        # Robustesse : strip d'éventuels code fences ```json ... ```
        # (ancien code échouait sur ```json ... ``` car .strip("`") retire
        # aussi les ` du milieu si présents — pattern fragile).
        cleaned = raw.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[len("```json"):].lstrip()
        elif cleaned.startswith("```"):
            cleaned = cleaned[len("```"):].lstrip()
        if cleaned.endswith("```"):
            cleaned = cleaned[: -len("```")].rstrip()
        cleaned = cleaned.strip()

        try:
            return _json.loads(cleaned)
        except _json.JSONDecodeError as exc:
            logger.error(
                "Estim IA v2 — JSON decode failed: %s | first 500 chars: %r",
                exc,
                cleaned[:500],
            )
            raise

    def _fallback_estimation_v2(self, bien: Bien) -> EstimationIAEnrichie:
        """Fallback déterministe — retourne un EstimationIAEnrichie complet.

        Utilisé si Claude API indisponible ou parsing JSON échoué. Les chiffres
        sont conservateurs (multiplicateur médian 230× loyer, scores neutres
        à 5/10). L'utilisateur est averti via `confidence_score = 2.0` (faible).
        """
        from datetime import datetime, timezone

        loyer = float(bien.loyer or 0)
        charges = float(bien.charges or 0)
        surface = float(bien.surface or 0)

        loyer_an = loyer * 12
        # FIX PR-A9.3 — multiplicateur suisse standard appliqué sur le loyer
        # MENSUEL (pas annuel). 200-260× = fourchette marché CH médian.
        # Exemple : 1500 CHF/mois → 300k-390k CHF (vs 3.6M-4.7M avant fix).
        valeur_min = loyer * 200 if loyer > 0 else 0
        valeur_max = loyer * 260 if loyer > 0 else 0
        valeur_mid = (valeur_min + valeur_max) / 2 if valeur_max > 0 else 0
        valeur_m2 = (valeur_mid / surface) if surface > 0 else 0
        rendement_brut = round(loyer_an / valeur_mid * 100, 2) if valeur_mid > 0 else 0
        rendement_net = (
            round((loyer_an - charges * 12) / valeur_mid * 100, 2)
            if valeur_mid > 0
            else 0
        )

        location_neutre = lambda type_: EstimationLocation(  # noqa: E731
            type=type_,
            revenu_brut_an_chf_min=Decimal(str(loyer_an * 0.85)),
            revenu_brut_an_chf_max=Decimal(str(loyer_an * 1.05)),
            taux_occupation_estime_pct=Decimal("100" if type_ == "annuelle" else "60"),
            rendement_brut_pct=Decimal(str(rendement_brut)),
            rendement_net_estime_pct=Decimal(str(rendement_net)),
            contraintes=[],
            avantages=[],
            warnings=[
                "Fourchette générique — analyse IA indisponible. "
                "Vérifier les contraintes légales locales (LRA, Lex Weber, "
                "permis communal) avant toute décision."
            ],
            recommandation=(
                "Estimation indisponible — réessayer plus tard ou consulter "
                "un expert local."
            ),
        )

        return EstimationIAEnrichie(
            bien_id=bien.id,
            generated_at=datetime.now(timezone.utc),
            model_used="fallback-static",
            confidence_score=Decimal("2.0"),
            meuble=bool(bien.is_furnished),
            residence_type=bien.residence_type or "secondaire",
            location_type_actuel=bien.location_type_actuel,
            valeur_estimee_chf_min=Decimal(str(round(valeur_min, 0))),
            valeur_estimee_chf_max=Decimal(str(round(valeur_max, 0))),
            valeur_par_m2_estimee_chf=Decimal(str(round(valeur_m2, 0))),
            localite=EstimationLocalite(
                canton=bien.canton or "??",
                ville=bien.ville or "Inconnu",
                quartier=None,
                prix_moyen_m2_vente_chf=Decimal("7000"),
                prix_moyen_m2_loyer_an_chf=Decimal("280"),
                tendance_12_mois="stable",
                delai_vente_moyen_jours=120,
                note_attractivite=5,
                notes_locales=(
                    "Données indisponibles — analyse IA Claude n'a pas pu être "
                    "complétée. Estimations génériques basées sur le multiplicateur "
                    "200-260× loyer mensuel (marché CH médian)."
                ),
            ),
            location_annuelle=location_neutre("annuelle"),
            location_saisonniere=location_neutre("saisonniere"),
            location_semaine=location_neutre("semaine"),
            location_recommandee="annuelle",
            raison_recommandation=(
                "Sans analyse fine du marché local, la location annuelle reste "
                "le scénario le plus stable et le moins exposé aux contraintes "
                "légales (LRA, Lex Weber)."
            ),
            fiscalite=EstimationFiscalite(
                impot_revenu_locatif_estime_chf_an=Decimal(str(round(loyer_an * 0.20, 0))),
                deductions_possibles=[
                    "Intérêts hypothécaires",
                    "Charges d'entretien réelles",
                    "Frais de gérance",
                ],
                valeur_locative_estimee_chf=None,
                conseil_fiscal_principal=(
                    "Consultez votre fiduciaire pour optimiser les déductions "
                    "selon le canton et votre situation."
                ),
            ),
            points_forts=[],
            points_amelioration=[],
            actions_recommandees=[
                "Réessayer l'estimation IA dans quelques minutes."
            ],
            prochaine_action_prioritaire=(
                "Vérifier la disponibilité de l'API Anthropic et relancer "
                "l'estimation."
            ),
            score_investissement=5,
            score_locatif=5,
            score_revente=5,
        )

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
            resource_type="bien",
            resource_id=resource_id,
            old_values=old_values,
            new_values=new_values,
        )
        self.db.add(log)


# ── Module-level helper ───────────────────────────────────────────────────────


def _serializable(value):
    """Convertit Decimal/datetime/UUID en JSON-safe pour les audit logs."""
    if value is None:
        return None
    if isinstance(value, (int, float, bool, str)):
        return value
    return str(value)
