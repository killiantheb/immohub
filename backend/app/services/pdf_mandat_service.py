"""Stub Lot 1.5 scaffolding — PDF mandat de gestion (Sprint 10).

Implémentation Lot 3. 4 pages fidèle à "Contrat de mandat de gestion locative.pdf"
Sunimmo (Articles 1-9 : parties, contrat, désignation objet, prix location,
obligations gérance, obligations propriétaire, commission, durée, droit applicable).

§2.4.16 : commission_pct_* dans le PDF mais AUCUN tracking transactionnel Althy.
"""

from __future__ import annotations

import uuid


async def generate_mandat_pdf(mandat_id: uuid.UUID) -> bytes:
    """Stub Lot 1.5 — Lot 3 livre le template fidèle Sunimmo."""
    return b"%PDF-1.4\n% Placeholder Lot 1.5 scaffolding - Lot 3 will deliver the real PDF\n%%EOF\n"
