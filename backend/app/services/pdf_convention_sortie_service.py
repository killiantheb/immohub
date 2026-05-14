"""Stub Lot 1.5 scaffolding — PDF convention de sortie (Sprint 10).

Implémentation Lot 3. Fidèle à "Convention de sortie - Template.docx" Sunimmo :
table dynamique description défauts + estimations, inventaire des clés,
mode indemnisation, reconnaissance de dette art. 82 LP.

Source de vérité : `changements_locataire.convention_sortie` JSONB
(migration 0051 §G).
"""

from __future__ import annotations

import uuid


async def generate_convention_sortie_pdf(changement_id: uuid.UUID) -> bytes:
    """Stub Lot 1.5 — Lot 3 livre le template."""
    return b"%PDF-1.4\n% Placeholder Lot 1.5 scaffolding - Lot 3 will deliver the real PDF\n%%EOF\n"
