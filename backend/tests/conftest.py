"""Pytest fixtures — async test client + DB setup."""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Override settings before app import
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-minimum-ok!")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/immohub_test")
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "placeholder-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "placeholder-jwt-secret-32-chars-min!")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ.setdefault("STRIPE_SECRET_KEY", "")

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="session")
async def client():
    """Async HTTP client wired to the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture
def fake_user_id() -> str:
    return str(uuid.uuid4())


def make_jwt_header(user_id: str = None) -> dict:
    """Return a fake Authorization header for tests that bypass auth."""
    # In CI we use a test override — real auth is handled by Supabase in prod
    return {"Authorization": f"Bearer test-token-{user_id or uuid.uuid4()}"}
