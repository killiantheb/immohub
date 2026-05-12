import asyncio
import uuid
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# ── app imports ──────────────────────────────────────────────────────────────
# Must happen before target_metadata is set so all models register themselves.
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import app.models  # noqa: F401 — side-effect: registers all ORM classes

from app.models.base import Base

# ── alembic config ───────────────────────────────────────────────────────────
config = context.config

# Inject DATABASE_URL directly from env so we don't require all settings fields
_db_url = os.environ.get("DATABASE_URL")
if _db_url:
    config.set_main_option("sqlalchemy.url", _db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── offline mode (generates SQL without connecting) ──────────────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── online mode (async) ──────────────────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # Mirror du fix asyncpg/pgbouncer appliqué en runtime à
    # `app/core/database.py:30-47` (cf incident DuplicatePreparedStatementError
    # 2026-05-12, CLAUDE.md §B.12). Sans ces connect_args, `alembic upgrade head`
    # plante sur Railway dès qu'une connexion Supabase Transaction Pooler 6543
    # recycle un `__asyncpg_stmt_N__` déjà utilisé.
    #
    # `async_engine_from_config` est remplacé par `create_async_engine` direct
    # car le second permet de passer connect_args avec un callable
    # (`prepared_statement_name_func` lambda) que la config INI Alembic ne
    # supporte pas.
    url = config.get_main_option("sqlalchemy.url")
    connectable = create_async_engine(
        url,
        poolclass=pool.NullPool,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
        },
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
