"""AI router package — fusion Lot C de ai_documents + ai_scoring + ai_listings.

Expose un unique `router` (prefix `/ai`) qui regroupe les 3 sous-modules.
URLs publiques inchangées : `/api/v1/ai/<endpoint>`.
"""
from fastapi import APIRouter

from app.routers.ai.documents import router as _documents_router
from app.routers.ai.listings import router as _listings_router
from app.routers.ai.scoring import router as _scoring_router

router = APIRouter(prefix="/ai", tags=["ai"])
router.include_router(_documents_router)
router.include_router(_scoring_router)
router.include_router(_listings_router)
