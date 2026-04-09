"""Portail proprio — /api/v1/portail

Géré par l'agence : crée des accès limités pour les propriétaires mandants.
Le portail_proprio peut voir ses biens, loyers et documents — rien d'autre.
"""

from __future__ import annotations

import secrets
import uuid
from typing import Annotated

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    ROLE_AGENCE,
    ROLE_PORTAIL_PROPRIO,
    ROLE_SUPER_ADMIN,
    get_current_user,
    require_roles,
)
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep       = Annotated[AsyncSession, Depends(get_db)]
AgencyDep   = Annotated[User, Depends(require_roles(ROLE_AGENCE, ROLE_SUPER_ADMIN))]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class PortailCreateRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    property_ids: list[str] = []   # UUIDs des biens à partager


class PortailUserRead(BaseModel):
    id: str
    email: str
    first_name: str | None
    last_name: str | None
    role: str
    created_at: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_portail_user(
    body: PortailCreateRequest,
    db: DbDep,
    agency: AgencyDep,
):
    """
    L'agence crée un accès portail_proprio pour un propriétaire mandant.
    Envoie un email d'invitation avec un lien de création de mot de passe.
    """
    # Check email not already registered
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Un compte avec cet email existe déjà.")

    # Create user with portail_proprio role
    temp_password = secrets.token_urlsafe(24)  # Force reset at first login
    portail_user = User(
        id=uuid.uuid4(),
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        role=ROLE_PORTAIL_PROPRIO,
        hashed_password=None,  # Will be set via Supabase invitation
        is_verified=False,
    )
    db.add(portail_user)
    await db.flush()

    # TODO: Send Supabase invitation email via Admin API
    # supabase_admin.auth.admin.invite_user_by_email(
    #     email=body.email,
    #     options={"data": {"role": "portail_proprio", "invited_by": str(agency.id)}}
    # )

    await db.commit()
    await db.refresh(portail_user)

    return PortailUserRead(
        id=str(portail_user.id),
        email=portail_user.email,
        first_name=portail_user.first_name,
        last_name=portail_user.last_name,
        role=portail_user.role,
        created_at=str(portail_user.created_at),
    )


@router.get("")
async def list_portail_users(
    db: DbDep,
    agency: AgencyDep,
):
    """Liste les portails proprio créés par cette agence."""
    result = await db.execute(
        select(User).where(User.role == ROLE_PORTAIL_PROPRIO)
    )
    users = result.scalars().all()
    return {
        "items": [
            PortailUserRead(
                id=str(u.id),
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                role=u.role,
                created_at=str(u.created_at),
            )
            for u in users
        ]
    }


@router.delete("/{portail_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_portail_access(
    portail_user_id: uuid.UUID,
    db: DbDep,
    agency: AgencyDep,
):
    """Révoque l'accès portail d'un propriétaire mandant."""
    result = await db.execute(
        select(User).where(
            User.id == portail_user_id,
            User.role == ROLE_PORTAIL_PROPRIO,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utilisateur portail non trouvé.")

    user.is_active = False
    await db.commit()


@router.get("/me/access")
async def portail_access_info(
    db: DbDep,
    user: CurrentUser,
):
    """
    Retourne les biens auxquels le portail_proprio a accès.
    Accessible uniquement par le portail_proprio lui-même.
    """
    from app.models.property import Property

    if user.role not in (ROLE_PORTAIL_PROPRIO, ROLE_SUPER_ADMIN):
        raise HTTPException(403, "Réservé aux utilisateurs portail.")

    # Portail proprio voit les biens où il est agency_id ou owner_id
    result = await db.execute(
        select(Property).where(
            (Property.owner_id == user.id) | (Property.agency_id == user.id),
            Property.is_active == True,
        )
    )
    props = result.scalars().all()

    return {
        "role": user.role,
        "sections": ["dashboard", "biens", "finances", "documents"],
        "properties_count": len(props),
        "properties": [
            {"id": str(p.id), "name": p.name, "address": p.address}
            for p in props
        ],
    }
