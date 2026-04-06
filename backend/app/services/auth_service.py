"""
Auth service — bridge between our DB and the Supabase Auth API.

Supabase endpoints used:
  POST /auth/v1/admin/users          — admin create user (service key)
  POST /auth/v1/token?grant_type=… — sign in / refresh (anon key)
  POST /auth/v1/logout               — revoke session (user token)
"""

from __future__ import annotations

import uuid

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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

# ── Supabase HTTP helpers ─────────────────────────────────────────────────────

_ADMIN_HEADERS = {
    "apikey": settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

_ANON_HEADERS = {
    "apikey": settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json",
}


def _auth_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/auth/v1{path}"


async def _supabase_post(
    url: str,
    payload: dict,
    headers: dict,
    *,
    expected: int = 200,
) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json=payload, headers=headers)

    if resp.status_code not in (expected, 200, 201):
        try:
            detail = resp.json().get("msg") or resp.json().get("message") or resp.text
        except Exception:
            detail = resp.text
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail or "Supabase error",
        )

    return resp.json() if resp.content else {}


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _get_or_create_db_user(
    db: AsyncSession,
    *,
    supabase_uid: str,
    email: str,
    first_name: str | None = None,
    last_name: str | None = None,
    phone: str | None = None,
    role: str = "owner",
) -> User:
    result = await db.execute(select(User).where(User.supabase_uid == supabase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            supabase_uid=supabase_uid,
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            role=role,
            is_verified=True,
        )
        db.add(user)
    else:
        # Always keep email in sync
        user.email = email
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if phone is not None:
            user.phone = phone

    await db.flush()
    await db.refresh(user)
    return user


def _build_token(data: dict) -> TokenResponse:
    return TokenResponse(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        token_type=data.get("token_type", "bearer"),
        expires_in=data.get("expires_in", 3600),
    )


# ── Public service methods ────────────────────────────────────────────────────

class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register(self, req: RegisterRequest) -> AuthResponse:
        # 1. Create user in Supabase via Admin API
        supa = await _supabase_post(
            _auth_url("/admin/users"),
            payload={
                "email": req.email,
                "password": req.password,
                "email_confirm": True,  # skip email verification in dev
                "user_metadata": {
                    "first_name": req.first_name,
                    "last_name": req.last_name,
                    "role": req.role,
                },
            },
            headers=_ADMIN_HEADERS,
            expected=201,
        )

        supabase_uid: str = supa["id"]

        # 2. Now sign in to get tokens (Admin API doesn't return tokens)
        token_data = await _supabase_post(
            _auth_url("/token?grant_type=password"),
            payload={"email": req.email, "password": req.password},
            headers=_ANON_HEADERS,
        )

        # 3. Upsert in our DB
        user = await _get_or_create_db_user(
            self.db,
            supabase_uid=supabase_uid,
            email=req.email,
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            role=req.role,
        )

        return AuthResponse(
            token=_build_token(token_data),
            user=UserProfileResponse.model_validate(user),
        )

    async def login(self, req: LoginRequest) -> AuthResponse:
        # 1. Authenticate with Supabase
        token_data = await _supabase_post(
            _auth_url("/token?grant_type=password"),
            payload={"email": req.email, "password": req.password},
            headers=_ANON_HEADERS,
        )

        supa_user = token_data.get("user", {})
        supabase_uid: str = supa_user.get("id", "")
        meta: dict = supa_user.get("user_metadata", {})

        # 2. Upsert in our DB
        user = await _get_or_create_db_user(
            self.db,
            supabase_uid=supabase_uid,
            email=req.email,
            first_name=meta.get("first_name"),
            last_name=meta.get("last_name"),
            role=meta.get("role", "owner"),
        )

        return AuthResponse(
            token=_build_token(token_data),
            user=UserProfileResponse.model_validate(user),
        )

    async def refresh(self, req: RefreshRequest) -> TokenResponse:
        token_data = await _supabase_post(
            _auth_url("/token?grant_type=refresh_token"),
            payload={"refresh_token": req.refresh_token},
            headers=_ANON_HEADERS,
        )
        return _build_token(token_data)

    async def logout(self, access_token: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _auth_url("/logout"),
                headers={
                    **_ANON_HEADERS,
                    "Authorization": f"Bearer {access_token}",
                },
            )

    async def get_profile(self, user: User) -> UserProfileResponse:
        return UserProfileResponse.model_validate(user)

    async def update_profile(self, user: User, req: UpdateProfileRequest) -> UserProfileResponse:
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        await self.db.flush()
        await self.db.refresh(user)
        return UserProfileResponse.model_validate(user)
