"""Stub Lot 1.5 scaffolding — emails transactionnels Sprint 10.

Implémentation Lot 4 : 9 templates Resend (cf docs/2-ROADMAP.md §2.4.16 +
Lot 4 brief). Wrapper sur `email_service.send_email` existant.

Templates attendus dans backend/app/templates/emails/ (Lot 4) :
  - approbation_proprietaire.html/.txt
  - approbation_donnee.html/.txt
  - candidat_refuse.html/.txt
  - signature_bail_locataire.html/.txt
  - signature_bail_agence.html/.txt
  - bail_signe_tous.html/.txt
  - avenant_a_signer.html/.txt
  - resiliation_envoyee.html/.txt
  - edl_a_planifier.html/.txt
  - rappel_signature_pending.html/.txt
"""

from __future__ import annotations

import uuid


async def send_approbation_proprietaire(candidature_id: uuid.UUID) -> str | None:
    raise NotImplementedError("send_approbation_proprietaire — Lot 4 Sprint 10")


async def send_signature_bail_locataire(contract_id: uuid.UUID) -> str | None:
    raise NotImplementedError("send_signature_bail_locataire — Lot 4 Sprint 10")


async def send_signature_bail_agence(contract_id: uuid.UUID) -> str | None:
    raise NotImplementedError("send_signature_bail_agence — Lot 4 Sprint 10")


async def send_bail_signe_tous(contract_id: uuid.UUID) -> tuple[str | None, str | None]:
    raise NotImplementedError("send_bail_signe_tous — Lot 4 Sprint 10")


async def send_avenant_a_signer(avenant_id: uuid.UUID) -> str | None:
    raise NotImplementedError("send_avenant_a_signer — Lot 4 Sprint 10")


async def send_resiliation_envoyee(resiliation_id: uuid.UUID) -> str | None:
    raise NotImplementedError("send_resiliation_envoyee — Lot 4 Sprint 10")


async def send_edl_a_planifier(
    changement_id: uuid.UUID, phase: str
) -> str | None:
    raise NotImplementedError("send_edl_a_planifier — Lot 4 Sprint 10")


async def send_rappel_signature_pending(
    document_type: str, document_id: uuid.UUID
) -> str | None:
    raise NotImplementedError("send_rappel_signature_pending — Lot 4 Sprint 10")


async def send_candidat_refuse(candidature_id: uuid.UUID) -> str | None:
    raise NotImplementedError("send_candidat_refuse — Lot 4 Sprint 10")
