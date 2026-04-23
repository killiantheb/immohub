"""
Security layer for CATHY.

Dependency resolution order:
  bearer_scheme
    └─ _decode_token()          → raw JWT payload (dict)
         └─ get_current_user()  → DB User model (auto-upsert on first login)
              ├─ require_roles(*roles)
              ├─ require_bien_access()
              └─ require_agency_access()
"""

from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from jwt import PyJWKClient, PyJWKClientError
from app.core.config import settings
from app.core.database import get_db
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── Role definitions (CLAUDE.md §profiles) ───────────────────────────────────

# Canonical role names
ROLE_PROPRIO_SOLO    = "proprio_solo"
ROLE_AGENCE          = "agence"
ROLE_PORTAIL_PROPRIO = "portail_proprio"
ROLE_OPENER          = "opener"
ROLE_ARTISAN         = "artisan"
ROLE_EXPERT          = "expert"
ROLE_HUNTER          = "hunter"
ROLE_LOCATAIRE       = "locataire"
ROLE_ACHETEUR        = "acheteur_premium"
ROLE_SUPER_ADMIN     = "super_admin"

# Legacy aliases (from old codebase — accepted during transition)
_LEGACY_ROLE_MAP = {
    "owner":   ROLE_PROPRIO_SOLO,
    "agency":  ROLE_AGENCE,
    "tenant":  ROLE_LOCATAIRE,
    "company": ROLE_ARTISAN,
}

# Role groups for convenience
ROLES_PROPERTY_MANAGERS = (ROLE_PROPRIO_SOLO, ROLE_AGENCE, ROLE_SUPER_ADMIN)
ROLES_MARKETPLACE       = (ROLE_OPENER, ROLE_ARTISAN, ROLE_EXPERT)
ROLES_BUYERS_TENANTS    = (ROLE_LOCATAIRE, ROLE_ACHETEUR)
ROLES_ALL               = (
    ROLE_PROPRIO_SOLO, ROLE_AGENCE, ROLE_PORTAIL_PROPRIO,
    ROLE_OPENER, ROLE_ARTISAN, ROLE_EXPERT, ROLE_HUNTER,
    ROLE_LOCATAIRE, ROLE_ACHETEUR, ROLE_SUPER_ADMIN,
)

# Sections accessible par rôle
ROLE_SECTIONS: dict[str, list[str]] = {
    ROLE_SUPER_ADMIN:     ["*"],  # all
    ROLE_PROPRIO_SOLO:    ["dashboard", "biens", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "sphere", "documents", "candidatures"],
    ROLE_AGENCE:          ["dashboard", "biens", "finances", "interventions", "crm", "listings", "hunters", "comptabilite", "abonnement", "sphere", "documents", "portail", "candidatures"],
    ROLE_PORTAIL_PROPRIO: ["dashboard", "biens", "finances", "documents"],  # accès limité
    ROLE_OPENER:          ["dashboard", "missions", "finances", "abonnement", "sphere"],
    ROLE_ARTISAN:         ["dashboard", "interventions", "finances", "abonnement", "sphere"],
    ROLE_EXPERT:          ["dashboard", "biens", "finances", "abonnement", "sphere"],
    ROLE_HUNTER:          ["dashboard", "hunters", "abonnement", "sphere"],
    ROLE_LOCATAIRE:       ["dashboard", "biens", "finances", "documents", "sphere", "candidatures"],
    ROLE_ACHETEUR:        ["dashboard", "listings", "sphere", "candidatures"],
}

bearer_scheme = HTTPBearer(auto_error=True)

# ── JWKS client (ES256 / RS256 — Supabase asymmetric keys) ───────────────────
# Supabase now issues ES256-signed JWTs. We use PyJWKClient to fetch and cache
# the public keys from the JWKS endpoint and verify the signature.

_jwks_client = PyJWKClient(
    f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
    lifespan=3600,  # refresh keys every hour
)

# ── token decoding ────────────────────────────────────────────────────────────


def _decode_token(token: str) -> dict:
    """Validate a Supabase JWT and return the payload.

    Supports both ES256 (asymmetric JWKS, current Supabase default) and
    HS256 (legacy symmetric secret) so the same code works on all projects.
    """
    try:
        # Peek at the algorithm without verifying
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg in ("ES256", "RS256"):
            # Asymmetric: verify via JWKS
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )
        else:
            # Legacy HS256: verify with the project JWT secret
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
    except (jwt.InvalidTokenError, PyJWKClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


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
        raw_role = meta.get("role", ROLE_PROPRIO_SOLO)
        # Normalise legacy role names
        canonical_role = _LEGACY_ROLE_MAP.get(raw_role, raw_role)
        if canonical_role not in ROLES_ALL:
            canonical_role = ROLE_PROPRIO_SOLO

        user = User(
            id=uuid.uuid4(),
            supabase_uid=supabase_uid,
            email=email,
            first_name=meta.get("first_name") or (
                meta.get("full_name", "").split()[0] if meta.get("full_name") else None
            ),
            last_name=meta.get("last_name") or (
                " ".join(meta.get("full_name", "").split()[1:]) or None
            ),
            role=canonical_role,
            is_verified=bool(payload.get("email_confirmed_at")),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    return user


# Short alias used across routers
CurrentUser = Annotated[object, Depends(get_current_user)]

# ── Auth optionnelle (swipe / routes publiques semi-authentifiées) ─────────────

_optional_bearer = HTTPBearer(auto_error=False)


async def get_optional_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_optional_bearer),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User | None":
    """
    Comme get_current_user mais renvoie None si aucun token valide.
    Usage : routes accessibles aux anonymes ET aux connectés.
    """
    if not credentials:
        return None
    try:
        payload = _decode_token(credentials.credentials)
        supabase_uid: str | None = payload.get("sub")
        if not supabase_uid:
            return None
        from app.models.user import User
        result = await db.execute(select(User).where(User.supabase_uid == supabase_uid))
        return result.scalar_one_or_none()
    except Exception:
        return None


async def get_current_user_id(user=Depends(get_current_user)) -> str:
    """Lightweight dependency returning only the authenticated user's UUID string."""
    return str(user.id)


# ── permission factories ──────────────────────────────────────────────────────


def require_roles(*roles: str):
    """
    Dependency factory — inject as a default value in route signatures:

        async def route(user = require_roles("proprio_solo", "agence")):
    """

    async def _check(user=Depends(get_current_user)):
        # Normalise legacy role before checking
        effective_role = _LEGACY_ROLE_MAP.get(user.role, user.role)
        # super_admin bypasses all role checks
        if effective_role == ROLE_SUPER_ADMIN:
            return user
        if effective_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle requis : {', '.join(roles)}. Votre rôle : {effective_role}",
            )
        return user

    return Depends(_check)


def require_section(section: str):
    """
    Verifies the user's role has access to a given section.
    More granular than require_roles — maps to ROLE_SECTIONS.

        async def route(user = require_section("hunters")):
    """

    async def _check(user=Depends(get_current_user)):
        effective_role = _LEGACY_ROLE_MAP.get(user.role, user.role)
        if effective_role == ROLE_SUPER_ADMIN:
            return user
        allowed = ROLE_SECTIONS.get(effective_role, [])
        if section not in allowed and "*" not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé : section '{section}' non autorisée pour le rôle '{effective_role}'",
            )
        return user

    return Depends(_check)


def require_bien_access():
    """
    Dependency factory — verifies the authenticated user owns or manages
    le bien référencé par `bien_id` in the path.

    Usage:
        @router.get("/{bien_id}")
        async def route(bien_id: uuid.UUID, user = require_bien_access()):
    """

    async def _check(
        bien_id: uuid.UUID,
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        from app.models.bien import Bien  # local import avoids circularity

        if user.role == "super_admin":
            return user

        result = await db.execute(select(Bien).where(Bien.id == bien_id))
        bien = result.scalar_one_or_none()

        if bien is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bien introuvable")

        if bien.owner_id != user.id and bien.agency_id != user.id and bien.created_by_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé à ce bien")

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
