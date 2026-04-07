from __future__ import annotations

from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserProfileResponse,
)
from app.services.auth_service import AuthService
from app.core.limiter import limiter
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

# ── helpers ───────────────────────────────────────────────────────────────────

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


def _bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")


# ── public routes (no auth required) ─────────────────────────────────────────


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un compte Supabase + profil DB",
)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: DbDep) -> AuthResponse:
    """
    1. Crée l'utilisateur dans Supabase Auth (Admin API).
    2. Signe l'utilisateur pour obtenir les tokens JWT.
    3. Crée/met à jour le profil dans la DB.
    """
    return await AuthService(db).register(payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Authentifier via Supabase, retourne JWT + profil",
)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: DbDep) -> AuthResponse:
    """
    Authentifie via Supabase (grant_type=password),
    synchronise le profil en DB et retourne les tokens.
    """
    return await AuthService(db).login(payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renouveler le JWT avec le refresh_token",
)
async def refresh(payload: RefreshRequest, db: DbDep) -> TokenResponse:
    return await AuthService(db).refresh(payload)


# ── protected routes (JWT required) ──────────────────────────────────────────


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Invalider la session Supabase",
)
async def logout(request: Request, _: AuthUserDep, db: DbDep):
    token = _bearer_token(request)
    await AuthService(db).logout(token)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Profil complet de l'utilisateur authentifié",
)
async def get_me(current_user: AuthUserDep, db: DbDep) -> UserProfileResponse:
    """
    Retourne le profil DB complet avec les permissions calculées.
    """
    return await AuthService(db).get_profile(current_user)


@router.put(
    "/me",
    response_model=UserProfileResponse,
    summary="Mettre à jour son profil",
)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: AuthUserDep,
    db: DbDep,
) -> UserProfileResponse:
    return await AuthService(db).update_profile(current_user, payload)
