"""Stub Lot 1.5 scaffolding — router resiliations (Sprint 10).

Implémentation Lot 2 : CRUD résiliations + workflow CO 266l.
Endpoints prévus :
  - POST   /api/v1/resiliations                          (création draft)
  - GET    /api/v1/resiliations?contract_id=...          (liste)
  - GET    /api/v1/resiliations/{id}                     (détail)
  - POST   /api/v1/resiliations/{id}/send-to-skribble    (envoi signature)
  - POST   /api/v1/resiliations/{id}/marquer-envoyee     (courrier recommandé envoyé)
  - POST   /api/v1/resiliations/{id}/marquer-appliquee   (bail bascule terminated)

§B.10 : 501 tant que non implémenté.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def resiliations_stub(path: str = "") -> dict:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        f"Résiliations CRUD — implémentation Lot 2 Sprint 10 (path={path!r})",
    )
