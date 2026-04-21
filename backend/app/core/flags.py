"""Backend feature flags — masque l'accès aux routers Phase 2/3.

Pendant sur `frontend/src/lib/flags.ts` : tant qu'un module n'est pas activé
côté front, son router back renvoie 503 (pas 401/404 — on ne veut pas leak
l'existence de l'endpoint).

Usage (au niveau du `include_router`, AVANT toute dépendance d'auth) :

    from fastapi import Depends
    from app.core.flags import require_flag

    app.include_router(
        crm_router,
        prefix="/api/v1/crm",
        dependencies=[Depends(require_flag("BACKEND_FLAG_CRM"))],
    )

Règle : missing env var → False (défaut sûr).
Les routers webhook (stripe_webhooks, etc.) ne doivent JAMAIS être gatés
sous peine de perte d'événements prod.
"""
from fastapi import HTTPException, status

from app.core.config import settings


def require_flag(flag_name: str):
    """Dépendance FastAPI : lève 503 si le flag est OFF."""

    def _check() -> None:
        enabled = bool(getattr(settings, flag_name, False))
        if not enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Module non disponible",
            )

    return _check
