"""Stub Lot 1.5 scaffolding — router mandats de gestion (Sprint 10).

Implémentation Lot 2 : CRUD mandats agence ↔ propriétaire.

§2.4.16 doctrine — commission_pct_* = donnée contractuelle pure stockée
pour appparaître dans le PDF mandat. Aucun endpoint de prélèvement /
versement / Stripe Connect (interdit §B.15). Si une fonction "calculer
ce que je dois à l'agence" est demandée Phase 1.0, elle reste purement
informationnelle (read-only, sans côté financier).

Endpoints prévus :
  - POST   /api/v1/mandats                              (création draft)
  - GET    /api/v1/mandats?mandant_id|agence_id=...     (liste)
  - GET    /api/v1/mandats/{id}                         (détail)
  - POST   /api/v1/mandats/{id}/send-to-skribble        (signature 2 parties)
  - POST   /api/v1/mandats/{id}/terminer                (résiliation mandat)

§B.10 : 501 tant que non implémenté.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def mandats_stub(path: str = "") -> dict:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        f"Mandats de gestion CRUD — implémentation Lot 2 Sprint 10 (path={path!r})",
    )
