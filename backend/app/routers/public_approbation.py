"""Stub Lot 1.5 scaffolding — workflow approbation propriétaire (Sprint 10).

§2.4.16 décision #3 — Interprétation A : candidat issu d'une invitation
existante (magic_links type='invitation'). Magic link dédié
type='approbation_dossier' pour bailleurs sans compte. Pas de marketplace
publique, pas de candidature spontanée, pas de frais CHF 45.

Implémentation Lot 5 : magic_links extension + endpoints + page publique
/approuver/[token].

Endpoints prévus :
  - GET    /api/v1/public/approbation/{token}            (no-auth, lecture synthèse)
  - POST   /api/v1/public/approbation/{token}/approve    (no-auth, scope strict)
  - POST   /api/v1/public/approbation/{token}/deny       (no-auth, scope strict)
  - POST   /api/v1/agences/dossiers/{id}/pre-validate    (RBAC agence)

§B.10 : 501 tant que non implémenté.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.api_route("/public/approbation/{path:path}", methods=["GET", "POST"])
async def public_approbation_stub(path: str = "") -> dict:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        f"Approbation propriétaire — implémentation Lot 5 Sprint 10 (path={path!r})",
    )
