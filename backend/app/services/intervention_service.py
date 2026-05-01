"""Service métier interventions + devis (PR-A11.A.0).

Extrait depuis app/routers/interventions_althy.py — anti-pattern qui mettait
toute la logique inline dans le router. Pattern aligné sur bien_service.py.

PR-A11.A.0 sécurité (AX-01) — règle d'accès :
  - super_admin : tout
  - proprio / agency / created_by du bien lié : read + write + delete
  - artisan assigné (intervention.artisan_id == user.id) : read + write
    (pas delete)
  - locataire actif (Locataire.bien_id == intervention.bien_id,
    statut="actif", user_id == user.id) : read seulement

Anti-énumération :
  - GET liste : filtre silencieusement les interventions inaccessibles
    (pas de 403, on ne révèle pas l'existence du bien d'un autre user).
  - GET détail / PATCH / DELETE : 404 quand la cible existe mais que le
    user n'a aucun droit de lecture (anti-énumération).
  - 403 : seulement quand le user a le droit de lire mais pas l'action
    demandée (édition/suppression).
"""

from __future__ import annotations

import uuid
from typing import Literal, Optional

from app.models.bien import Bien
from app.models.intervention import Devis, Intervention
from app.models.locataire import Locataire
from app.models.user import User
from app.schemas.intervention import (
    DevisCreate,
    DevisUpdate,
    InterventionCreate,
    InterventionUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


AccessMode = Literal["read", "write", "delete"]


class InterventionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # Interventions
    # ─────────────────────────────────────────────────────────────────────────

    async def list_interventions(
        self,
        current_user: User,
        *,
        bien_id: Optional[uuid.UUID] = None,
        statut: Optional[str] = None,
        urgence: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> list[Intervention]:
        # Build base query with role-scoped accessibility filter (anti-énumération).
        q = select(Intervention).join(Bien, Bien.id == Intervention.bien_id)

        if current_user.role != "super_admin":
            uid = current_user.id

            # Tenant-accessible bien_ids (active leases on the user)
            tenant_subq = (
                select(Locataire.bien_id)
                .where(
                    Locataire.user_id == uid,
                    Locataire.statut == "actif",
                    Locataire.is_active.is_(True),
                )
                .scalar_subquery()
            )

            q = q.where(
                (Bien.owner_id == uid)
                | (Bien.agency_id == uid)
                | (Bien.created_by_id == uid)
                | (Intervention.artisan_id == uid)
                | (Intervention.bien_id.in_(tenant_subq))
            )

        if bien_id:
            q = q.where(Intervention.bien_id == bien_id)
        if statut:
            q = q.where(Intervention.statut == statut)
        if urgence:
            q = q.where(Intervention.urgence == urgence)

        q = q.offset((page - 1) * size).limit(size)
        rows = await self.db.execute(q)
        return list(rows.scalars())

    async def get_intervention(
        self, current_user: User, intervention_id: uuid.UUID
    ) -> Intervention:
        inter, _ = await self._load_or_404(intervention_id, current_user, mode="read")
        return inter

    async def create_intervention(
        self, current_user: User, payload: InterventionCreate
    ) -> Intervention:
        bien = await self._get_bien_or_404(payload.bien_id)
        is_active_tenant = await self._is_active_tenant(bien.id, current_user.id)

        if not self._can_create_on_bien(bien, current_user, is_active_tenant):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Vous n'êtes pas autorisé à créer une intervention sur ce bien",
            )

        data = payload.model_dump()
        data["signale_par_id"] = current_user.id
        inter = Intervention(**data)
        self.db.add(inter)
        await self.db.flush()
        await self.db.refresh(inter)
        return inter

    async def update_intervention(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        payload: InterventionUpdate,
    ) -> Intervention:
        inter, _ = await self._load_or_404(
            intervention_id, current_user, mode="write"
        )
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(inter, field, value)
        await self.db.flush()
        await self.db.refresh(inter)
        return inter

    async def delete_intervention(
        self, current_user: User, intervention_id: uuid.UUID
    ) -> None:
        inter, _ = await self._load_or_404(
            intervention_id, current_user, mode="delete"
        )

        # Soft check : refuser la suppression si un devis accepté existe encore.
        accepted_q = await self.db.execute(
            select(Devis.id)
            .where(
                Devis.intervention_id == inter.id,
                Devis.statut == "accepte",
            )
            .limit(1)
        )
        if accepted_q.scalar_one_or_none() is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Suppression impossible : un devis accepté est rattaché à cette "
                "intervention. Annulez ou clôturez-le d'abord.",
            )

        await self.db.delete(inter)

    # ─────────────────────────────────────────────────────────────────────────
    # Devis (sous-ressource)
    # ─────────────────────────────────────────────────────────────────────────

    async def list_devis(
        self, current_user: User, intervention_id: uuid.UUID
    ) -> list[Devis]:
        await self._load_or_404(intervention_id, current_user, mode="read")
        rows = await self.db.execute(
            select(Devis).where(Devis.intervention_id == intervention_id)
        )
        return list(rows.scalars())

    async def create_devis(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        payload: DevisCreate,
    ) -> Devis:
        await self._load_or_404(intervention_id, current_user, mode="write")
        data = payload.model_dump()
        data["intervention_id"] = intervention_id
        d = Devis(**data)
        self.db.add(d)
        await self.db.flush()
        await self.db.refresh(d)
        return d

    async def update_devis(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        devis_id: uuid.UUID,
        payload: DevisUpdate,
    ) -> Devis:
        await self._load_or_404(intervention_id, current_user, mode="write")
        d = await self._get_devis_or_404(intervention_id, devis_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(d, field, value)
        await self.db.flush()
        await self.db.refresh(d)
        return d

    async def delete_devis(
        self,
        current_user: User,
        intervention_id: uuid.UUID,
        devis_id: uuid.UUID,
    ) -> None:
        await self._load_or_404(intervention_id, current_user, mode="delete")
        d = await self._get_devis_or_404(intervention_id, devis_id)
        await self.db.delete(d)

    # ─────────────────────────────────────────────────────────────────────────
    # Access helpers (private)
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _can_access(
        intervention: Intervention,
        bien: Bien,
        user: User,
        mode: AccessMode,
        *,
        is_active_tenant: bool,
    ) -> bool:
        """Règle d'accès intervention selon le mode (read / write / delete).

        Logique alignée sur bien_service._can_write côté manageurs (proprio,
        agency, created_by, super_admin), enrichie pour les interventions :
          - artisan assigné peut lire et écrire (pas supprimer)
          - locataire actif du bien peut lire seulement
        """
        if user.role == "super_admin":
            return True

        uid = user.id
        is_manager = (
            bien.owner_id == uid
            or bien.agency_id == uid
            or bien.created_by_id == uid
        )

        if mode == "delete":
            return is_manager

        is_assigned_artisan = intervention.artisan_id == uid

        if mode == "write":
            return is_manager or is_assigned_artisan

        # mode == "read"
        return is_manager or is_assigned_artisan or is_active_tenant

    @staticmethod
    def _can_create_on_bien(
        bien: Bien,
        user: User,
        is_active_tenant: bool,
    ) -> bool:
        """Qui peut créer une intervention sur un bien :
          - super_admin
          - proprio / agency / created_by du bien
          - locataire actif (signale un problème)
        """
        if user.role == "super_admin":
            return True
        uid = user.id
        return (
            bien.owner_id == uid
            or bien.agency_id == uid
            or bien.created_by_id == uid
            or is_active_tenant
        )

    async def _is_active_tenant(
        self, bien_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        result = await self.db.execute(
            select(Locataire.id).where(
                Locataire.bien_id == bien_id,
                Locataire.user_id == user_id,
                Locataire.statut == "actif",
                Locataire.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none() is not None

    async def _get_bien_or_404(self, bien_id: uuid.UUID) -> Bien:
        result = await self.db.execute(
            select(Bien).where(Bien.id == bien_id, Bien.is_active.is_(True))
        )
        bien = result.scalar_one_or_none()
        if bien is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")
        return bien

    async def _get_or_404(self, intervention_id: uuid.UUID) -> Intervention:
        result = await self.db.execute(
            select(Intervention).where(Intervention.id == intervention_id)
        )
        inter = result.scalar_one_or_none()
        if inter is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Intervention introuvable"
            )
        return inter

    async def _load_or_404(
        self,
        intervention_id: uuid.UUID,
        current_user: User,
        *,
        mode: AccessMode,
    ) -> tuple[Intervention, Bien]:
        """Récupère intervention + bien lié avec check d'accès selon mode.

        Anti-énumération : retourne 404 si l'intervention existe mais que le
        user n'a même pas le droit de lecture. Retourne 403 seulement si le
        user a un accès lecture mais pas l'action demandée.
        """
        inter = await self._get_or_404(intervention_id)
        bien = await self._get_bien_or_404(inter.bien_id)
        is_active_tenant = await self._is_active_tenant(bien.id, current_user.id)

        if not self._can_access(
            inter, bien, current_user, "read",
            is_active_tenant=is_active_tenant,
        ):
            # Le user n'a aucun droit de lecture : on masque l'existence.
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Intervention introuvable"
            )

        if mode != "read" and not self._can_access(
            inter, bien, current_user, mode,
            is_active_tenant=is_active_tenant,
        ):
            verb = "modifier" if mode == "write" else "supprimer"
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Vous n'êtes pas autorisé à {verb} cette intervention",
            )

        return inter, bien

    async def _get_devis_or_404(
        self, intervention_id: uuid.UUID, devis_id: uuid.UUID
    ) -> Devis:
        result = await self.db.execute(
            select(Devis).where(
                Devis.id == devis_id,
                Devis.intervention_id == intervention_id,
            )
        )
        d = result.scalar_one_or_none()
        if d is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Devis introuvable")
        return d
