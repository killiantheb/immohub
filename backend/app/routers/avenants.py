"""Stub Lot 1.5 scaffolding — router avenants (Sprint 10).

Implémentation Lot 2 : CRUD avenants + send-to-skribble + status polling.
Endpoints prévus :
  - POST   /api/v1/avenants                          (création draft)
  - GET    /api/v1/avenants?contract_id=...          (liste)
  - GET    /api/v1/avenants/{id}                     (détail)
  - PUT    /api/v1/avenants/{id}                     (édition draft)
  - DELETE /api/v1/avenants/{id}                     (soft delete)
  - POST   /api/v1/avenants/{id}/send-to-skribble    (envoi signature)
  - GET    /api/v1/avenants/{id}/pdf                 (PDF draft)

§B.10 : 501 tant que non implémenté.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def avenants_stub(path: str = "") -> dict:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        f"Avenants CRUD — implémentation Lot 2 Sprint 10 (path={path!r})",
    )
