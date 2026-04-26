import json
from collections.abc import AsyncGenerator
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.core.config import settings
from app.models.base import Base  # noqa: F401 — re-exported for convenience
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker


def _json_default(obj):
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


def _json_serializer(obj, **kwargs):
    return json.dumps(obj, default=_json_default, **kwargs)


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    json_serializer=_json_serializer,
    # Required for Supabase Transaction Pooler 6543 (pgbouncer transaction mode).
    # Prevents DuplicatePreparedStatementError when connections are recycled.
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Session synchrone pour Celery (psycopg2) ─────────────────────────────────
# asyncpg → psycopg2 : on remplace le driver dans l'URL

_sync_url = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
).replace(
    "postgresql+asyncpg+", "postgresql+psycopg2+"  # garde le suffixe si présent
)

_sync_engine = create_engine(
    _sync_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    json_serializer=_json_serializer,
)

SyncSessionLocal = sessionmaker(
    _sync_engine,
    class_=Session,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@contextmanager
def sync_session():
    """Context manager de session synchrone — usage Celery uniquement."""
    db = SyncSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
