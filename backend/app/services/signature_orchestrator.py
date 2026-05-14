"""Stub Lot 1.5 scaffolding — orchestrateur signature 5 docs Sprint 10.

Façade unique pour les 5 types de documents Sprint 10 :
  - Bail            (Contract)
  - Avenant         (Avenant)
  - Résiliation     (Resiliation)
  - Mandat gestion  (MandatGestion)
  - EDL + convention sortie (ChangementLocataire.edl_entree / edl_sortie /
                              convention_sortie)

Implémentation Lot 2 :
  1. Génère le PDF draft via pdf_*_service.py (Lot 3 — stubs Lot 1.5 retournent
     b"PLACEHOLDER" pour permettre Lot 2 de coder contre l'interface stable).
  2. Upload draft Supabase bucket `signable-documents`.
  3. Détermine signataires selon type (Sunimmo policy figée Sprint 10 brief §D) :
       Bail        : [locataire, agence_mandataire]
       Avenant     : [locataire, agence_mandataire]
       Résiliation : [initiateur seul]
       Mandat      : [mandant, agence]
       EDL         : [locataire, agence_mandataire]
  4. SkribbleClient.create_signature_request → stocke skribble_session_id
     + status=pending_signatures sur la row.
"""

from __future__ import annotations

import uuid
from typing import Any


async def send_contract_to_skribble(contract_id: uuid.UUID) -> dict[str, Any]:
    raise NotImplementedError("signature_orchestrator.send_contract_to_skribble — Lot 2 Sprint 10")


async def send_avenant_to_skribble(avenant_id: uuid.UUID) -> dict[str, Any]:
    raise NotImplementedError("signature_orchestrator.send_avenant_to_skribble — Lot 2 Sprint 10")


async def send_resiliation_to_skribble(resiliation_id: uuid.UUID) -> dict[str, Any]:
    raise NotImplementedError("signature_orchestrator.send_resiliation_to_skribble — Lot 2 Sprint 10")


async def send_mandat_to_skribble(mandat_id: uuid.UUID) -> dict[str, Any]:
    raise NotImplementedError("signature_orchestrator.send_mandat_to_skribble — Lot 2 Sprint 10")


async def send_edl_to_skribble(
    changement_id: uuid.UUID, phase: str
) -> dict[str, Any]:
    """phase = 'entree' | 'sortie' | 'convention'."""
    raise NotImplementedError("signature_orchestrator.send_edl_to_skribble — Lot 2 Sprint 10")
