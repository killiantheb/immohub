"""Stub Lot 1.5 scaffolding — PDF bail Sunimmo (Sprint 10).

Implémentation Lot 3 : 4 variantes USPI/Sunimmo (annee, saison, nuitees,
commercial, parc, vaud) avec fidélité visuelle aux templates Sunimmo
fournis par Killian au moment du spawn Lot 3.

Interface stable Lot 1.5 → Lot 2 (orchestrator peut être codé contre cette
signature avant que Lot 3 livre le contenu réel).
"""

from __future__ import annotations

import uuid


async def generate_bail_pdf(contract_id: uuid.UUID, template_type: str | None = None) -> bytes:
    """Génère le PDF du bail. template_type = sunimmo_annee|saison|nuitees|...

    Stub : retourne un placeholder pour permettre à Lot 2 de coder l'upload
    bucket + envoi Skribble contre une interface stable.
    """
    return b"%PDF-1.4\n% Placeholder Lot 1.5 scaffolding - Lot 3 will deliver the real PDF\n%%EOF\n"
