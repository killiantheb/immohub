"""Stub Lot 1.5 scaffolding — service Skribble (Sprint 10).

Implémentation Lot 2 : SkribbleClient + auth JWT + signatures requests +
download signed PDF + cancel + withdraw signer.

§2.4.16 — Skribble SES bascule Phase 1.0 (était Phase 1.1). Coexiste avec
Plan B SES renforcée (flow Sprint 8) via `settings.SKRIBBLE_ENABLED`.

Doctrine §B.10 honnête : si Skribble down/5xx → propage exception explicite,
pas de silence. Doctrine §B.12 : si log d'usage Skribble, session DÉDIÉE.
"""

from __future__ import annotations

from typing import Any


class SkribbleClient:
    """Stub — implémentation Lot 2.

    Méthodes prévues :
      - authenticate() → JWT bearer token (cache 1h)
      - create_signature_request(...) → SkribbleSignatureRequest
      - get_signature_request(request_id) → SkribbleSignatureRequest
      - download_signed_pdf(request_id) → bytes
      - cancel_signature_request(request_id) → bool
      - withdraw_signer(request_id, signer_id) → bool
    """

    def __init__(self) -> None:
        pass

    async def authenticate(self) -> str:
        raise NotImplementedError("SkribbleClient.authenticate — Lot 2 Sprint 10")

    async def create_signature_request(self, **kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError("SkribbleClient.create_signature_request — Lot 2 Sprint 10")

    async def get_signature_request(self, request_id: str) -> dict[str, Any]:
        raise NotImplementedError("SkribbleClient.get_signature_request — Lot 2 Sprint 10")

    async def download_signed_pdf(self, request_id: str) -> bytes:
        raise NotImplementedError("SkribbleClient.download_signed_pdf — Lot 2 Sprint 10")

    async def cancel_signature_request(self, request_id: str) -> bool:
        raise NotImplementedError("SkribbleClient.cancel_signature_request — Lot 2 Sprint 10")

    async def withdraw_signer(self, request_id: str, signer_id: str) -> bool:
        raise NotImplementedError("SkribbleClient.withdraw_signer — Lot 2 Sprint 10")
