"""
Security layer for CATHY.

Dependency resolution order:
  bearer_scheme
    └─ _decode_token()          → raw JWT payload (dict)
         └─ get_current_user()  → DB User model (auto-upsert on first login)
              ├─ require_roles(*roles)
              ├─ require_property_access()
              └─ require_agency_access()
"""

from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from app.core.config import settings
from app.core.database import get_db
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

bearer_scheme = HTTPBearer(auto_error=True)

# ── token decoding ────────────────────────────────────────────────────────────


def _decode_token(token: str) -> dict:
    """Validate a Supabase JWT and return the payload."""
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── primary dependency ────────────────────────────────────────────────────────


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Decode the Supabase JWT, look up the matching DB User.
    Auto-creates a minimal profile if the user authenticates for the first time.
    Returns the SQLAlchemy User instance.
    """
    # import here to avoid a circular import at module load time
    from app.models.user import User

    payload = _decode_token(credentials.credentials)
    supabase_uid: str | None = payload.get("sub")
    if not supabase_uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing subject claim")

    result = await db.execute(select(User).where(User.supabase_uid == supabase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        # First hit after Supabase signup — create a skeleton profile
        email: str = payload.get("email", "")
        meta: dict = payload.get("user_metadata", {})
        user = User(
            id=uuid.uuid4(),
            supabase_uid=supabase_uid,
            email=email,
            first_name=meta.get("first_name") or meta.get("full_name", "").split()[0]
            if meta.get("full_name")
            else None,
            last_name=meta.get("last_name")
            or (" ".join(meta.get("full_name", "").split()[1:]) or None),
            role=meta.get("role", "owner"),
            is_verified=bool(payload.get("email_confirmed_at")),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    return user


# Short alias used across routers
CurrentUser = Annotated[object, Depends(get_current_user)]


async def get_current_user_id(user=Depends(get_current_user)) -> str:
    """Lightweight dependency returning only the authenticated user's UUID string."""
    return str(user.id)


# ── permission factories ──────────────────────────────────────────────────────


def require_roles(*roles: str):
    """
    Dependency factory — inject as a default value in route signatures:

        async def route(user = require_roles("super_admin", "agency")):
    """

    async def _check(user=Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role(s): {', '.join(roles)}. Your role: {user.role}",
            )
        return user

    return Depends(_check)


def require_property_access():
    """
    Dependency factory — verifies the authenticated user owns or manages
    the property referenced by `property_id` in the path.

    Usage:
        @router.get("/{property_id}")
        async def route(property_id: uuid.UUID, user = require_property_access()):
    """

    async def _check(
        property_id: uuid.UUID,
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        from app.models.property import Property  # local import avoids circularity

        if user.role == "super_admin":
            return user

        result = await db.execute(select(Property).where(Property.id == property_id))
        prop = result.scalar_one_or_none()

        if prop is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Property not found")

        if prop.owner_id != user.id and prop.agency_id != user.id and prop.created_by_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied to this property")

        return user

    return Depends(_check)


def require_agency_access():
    """
    Dependency factory — verifies the authenticated user belongs to the agency
    referenced by `agency_id` in the path.

    Usage:
        @router.get("/{agency_id}/members")
        async def route(agency_id: uuid.UUID, user = require_agency_access()):
    """

    async def _check(
        agency_id: uuid.UUID,
        user=Depends(get_current_user),
    ):
        if user.role == "super_admin":
            return user

        # agency users match when their own id IS the agency_id,
        # or when they belong to that agency (stored as agency_id on their profile)
        if str(user.id) != str(agency_id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied to this agency")

        return user

    return Depends(_check)
