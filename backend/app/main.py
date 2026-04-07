from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.routers import (
    admin,
    ai,
    auth,
    companies,
    contracts,
    dashboard,
    missions,
    openers,
    properties,
    rfq,
    transactions,
)
from app.routers.smart_onboarding import router as smart_onboarding_router
from app.routers.tenants import router as tenants_router
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# ── Sentry ────────────────────────────────────────────────────────────────────

if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=False,
    )


# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://(.*\.vercel\.app|althy\.ch|www\.althy\.ch)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(properties.router, prefix="/api/v1/properties", tags=["properties"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(openers.router, prefix="/api/v1/openers", tags=["openers"])
app.include_router(missions.router, prefix="/api/v1/missions", tags=["missions"])
app.include_router(companies.router, prefix="/api/v1/companies", tags=["companies"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(rfq.router, prefix="/api/v1/rfqs", tags=["rfqs"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(smart_onboarding_router, prefix="/api/v1")
app.include_router(tenants_router, prefix="/api/v1/tenants", tags=["tenants"])


# ── Health check ──────────────────────────────────────────────────────────────


@app.get("/api/health", tags=["health"])
async def health_check():
    """Returns app version, DB connectivity and Redis connectivity."""
    db_status = "ok"
    redis_status = "ok"

    # DB probe
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    # Redis probe
    try:
        import redis as redis_lib  # type: ignore[import]

        r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=1)
        r.ping()
    except Exception:
        redis_status = "error"

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"

    return {
        "status": overall,
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.APP_ENV,
        "db": db_status,
        "redis": redis_status,
    }
