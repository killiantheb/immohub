"""Bien service — logique métier CRUD bien + images + documents + équipements + IA.

Refonte 2026-04-23 : porté depuis property_service.py, adapté à la nouvelle table
`biens` (43 colonnes FR, location annuelle uniquement). Nouvelles responsabilités :
    - Auto-remplissage du canton depuis le NPA via ch_postal_codes (Phase 1 : ~230 NPAs)
    - Gestion des équipements (catalogue global + jonction bien_equipements)

Storage Supabase :
    Bucket : bien-images    → {bien_id}/{image_id}.{ext}
    Bucket : bien-documents → {bien_id}/{doc_id}.{ext}
"""

from __future__ import annotations

import math
import mimetypes
import uuid
from typing import TYPE_CHECKING

import httpx
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.bien import (
    Bien,
    BienDocument,
    BienEquipement,
    BienImage,
    CatalogueEquipement,
)
from app.schemas.bien import (
    AuditLogResponse,
    BienCreate,
    BienDetail,
    BienDocumentRead,
    BienImageRead,
    BienListItem,
    BienRead,
    BienUpdate,
    CatalogueEquipementRead,
    PaginatedBiens,
    PotentielIAResponse,
)
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select, text
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
        bien = await self._get(bien_id)
        if bien is None:
            return False
        if not _can_write(bien, current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Suppression refusée")
        bien.is_active = False
        await self.db.flush()
        await self._log(current_user, "delete", str(bien.id))
        return True

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
        url = await _upload_to_storage("bien-images", path, data, content_type)

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

        path = img.url.split("/bien-images/")[-1] if "/bien-images/" in img.url else None
        if path:
            await _delete_from_storage("bien-images", path)

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
        url = await _upload_to_storage("bien-documents", path, data, content_type)

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
        rows = (
            await self.db.execute(
                select(AuditLog)
                .where(
                    AuditLog.resource_type == "bien",
                    AuditLog.resource_id == bien_id,
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
