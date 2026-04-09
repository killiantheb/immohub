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
from app.routers.agency_settings import router as agency_settings_router
from app.routers.biens import router as biens_router
from app.routers.crm import router as crm_router
from app.routers.documents import router as documents_router
from app.routers.documents_althy import router as docs_althy_router
from app.routers.interventions_althy import router as interventions_althy_router
from app.routers.locataires import router as locataires_router
from app.routers.missions_ouvreurs import router as missions_ouvreurs_router
from app.routers.notifications import router as notifications_router
from app.routers.paiements import router as paiements_router
from app.routers.profiles_artisans import router as profiles_artisans_router
from app.routers.geocode import router as geocode_router
from app.routers.matching import router as matching_router
from app.routers.scoring import router as scoring_router
from app.routers.favorites import router as favorites_router
from app.routers.insurance import router as insurance_router
from app.routers.ratings import router as ratings_router
from app.routers.smart_onboarding import router as smart_onboarding_router
from app.routers.tenants import router as tenants_router
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

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

# ── Proxy headers (Railway terminates TLS; trust X-Forwarded-Proto) ───────────
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

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
app.include_router(ratings_router, prefix="/api/v1/ratings", tags=["ratings"])
app.include_router(favorites_router, prefix="/api/v1/favorites", tags=["favorites"])
app.include_router(agency_settings_router, prefix="/api/v1/agency", tags=["agency"])
app.include_router(insurance_router, prefix="/api/v1/insurance", tags=["insurance"])
app.include_router(crm_router, prefix="/api/v1/crm", tags=["crm"])
app.include_router(documents_router, prefix="/api/v1/documents", tags=["documents"])
# ── Althy core routers ────────────────────────────────────────────────────────
app.include_router(biens_router, prefix="/api/v1/biens", tags=["biens"])
app.include_router(locataires_router, prefix="/api/v1/locataires", tags=["locataires"])
app.include_router(docs_althy_router, prefix="/api/v1/docs-althy", tags=["docs-althy"])
app.include_router(paiements_router, prefix="/api/v1/paiements", tags=["paiements"])
app.include_router(interventions_althy_router, prefix="/api/v1/interventions-althy", tags=["interventions-althy"])
app.include_router(missions_ouvreurs_router, prefix="/api/v1/ouvreurs", tags=["ouvreurs"])
app.include_router(profiles_artisans_router, prefix="/api/v1/profiles-artisans", tags=["profiles-artisans"])
app.include_router(scoring_router, prefix="/api/v1/scoring", tags=["scoring"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(matching_router, prefix="/api/v1/matching", tags=["matching"])
app.include_router(geocode_router, prefix="/api/v1/geocode", tags=["geocode"])


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
