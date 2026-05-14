"""Stub Lot 1.5 scaffolding — webhook Skribble (Sprint 10).

Implémentation Lot 2 : `backend/app/routers/skribble_webhooks.py` doit :
  1. Vérifier signature HMAC du header `X-Skribble-Signature`.
  2. Parser le payload (event_type, request_id, status, signer_id, timestamp).
  3. Dispatcher selon le type d'événement (created/signed/completed/declined/expired).
  4. Si completed : download_signed_pdf → upload bucket signable-documents → MAJ
     contracts/avenants/resiliations/mandats_gestion/changements_locataire row
     selon `skribble_session_id` matching.
  5. Trigger post-signature hooks (loyer_activation, EDL sortie, etc.).

§B.10 : retourne 501 tant que pas implémenté (pas de faux statut 200).
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.post("/webhooks/skribble")
async def skribble_webhook_stub() -> dict:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        "Skribble webhook receiver — implémentation Lot 2 Sprint 10",
    )
