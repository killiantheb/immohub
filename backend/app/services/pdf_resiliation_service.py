"""Stub Lot 1.5 scaffolding — PDF résiliation (Sprint 10).

Implémentation Lot 3. Avertissement formule officielle CO 266l si
initiateur=bailleur + bail habitation (la formule cantonale officielle
reste obligatoire en Phase 1.0 — ce PDF ne la remplace pas).
"""

from __future__ import annotations

import uuid


async def generate_resiliation_pdf(resiliation_id: uuid.UUID) -> bytes:
    """Stub Lot 1.5 — Lot 3 livre le template courrier + avertissement CO 266l."""
    return b"%PDF-1.4\n% Placeholder Lot 1.5 scaffolding - Lot 3 will deliver the real PDF\n%%EOF\n"
