"""Réconciliation des paiements reçus sur le compte Althy.

Supporte :
  - Fichiers CAMT.054 V04 et V08 (SIX Group, banking suisse)
  - Listes manuelles [{reference, montant, date}]
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Namespaces CAMT.054 (V04 et V08)
_CAMT_NS = [
    "urn:iso:std:iso:20022:tech:xsd:camt.054.001.04",
    "urn:iso:std:iso:20022:tech:xsd:camt.054.001.08",
]


def parse_camt054(xml_bytes: bytes) -> list[dict]:
    """
    Parse un fichier CAMT.054.
    Retourne une liste de {reference: str, montant: float, date: str}.
    """
    root = ET.fromstring(xml_bytes)
    entries: list[dict] = []

    for ns_uri in _CAMT_NS:
        nsp = {"n": ns_uri}
        for ntry in root.findall(".//n:Ntry", nsp):
            amt_el  = ntry.find("n:Amt", nsp)
            date_el = ntry.find("n:BookgDt/n:Dt", nsp) or ntry.find("n:ValDt/n:Dt", nsp)
            ref_el  = ntry.find(".//n:RmtInf/n:Strd/n:CdtrRefInf/n:Ref", nsp)

            if amt_el is None or ref_el is None:
                continue
            ref = ref_el.text.strip().replace(" ", "")
            try:
                amt = float(amt_el.text.strip())
            except (ValueError, AttributeError):
                continue
            dt = date_el.text.strip() if date_el is not None else datetime.utcnow().date().isoformat()
            entries.append({"reference": ref, "montant": amt, "date": dt})

    return entries


async def reconcile_payments(incoming: list[dict], db: AsyncSession) -> dict:
    """
    Mappe les entrées [{reference, montant, date}] sur les loyer_transactions en attente.
    - Tolère ±0.05 CHF pour les arrondis bancaires.
    - Met à jour les lignes matchées en statut 'recu'.
    - Déclenche la task de reversement si au moins 1 match.

    Retourne {matches: int, non_matches: int, details: list}.
    """
    matches     = 0
    non_matches = 0
    details: list[dict] = []

    for entry in incoming:
        ref     = str(entry.get("reference", "")).strip().replace(" ", "")
        montant = float(entry.get("montant", 0))
        dt_str  = str(entry.get("date", ""))

        if not ref or len(ref) != 27:
            non_matches += 1
            details.append({"reference": ref, "statut": "ignoré", "raison": "référence invalide (longueur)"})
            continue

        row = (await db.execute(
            text("""
                SELECT id, montant_total, owner_id, statut
                FROM loyer_transactions
                WHERE qr_reference = :ref AND statut = 'en_attente'
                LIMIT 1
            """),
            {"ref": ref},
        )).one_or_none()

        if not row:
            non_matches += 1
            details.append({"reference": ref, "statut": "non_matché", "montant": montant})
            continue

        # Tolérance ±0.05 CHF (arrondis bancaires)
        if abs(float(row.montant_total) - montant) > 0.05:
            non_matches += 1
            details.append({
                "reference": ref, "statut": "montant_incorrect",
                "attendu": float(row.montant_total), "recu": montant,
            })
            continue

        try:
            reception_dt = datetime.fromisoformat(dt_str) if dt_str else datetime.now(UTC)
        except ValueError:
            reception_dt = datetime.now(UTC)

        await db.execute(
            text("""
                UPDATE loyer_transactions
                SET statut = 'recu', date_reception = :dt, updated_at = now()
                WHERE id = :id
            """),
            {"dt": reception_dt, "id": str(row.id)},
        )
        matches += 1
        details.append({"reference": ref, "statut": "recu", "transaction_id": str(row.id)})

    await db.commit()

    if matches > 0:
        from app.tasks.rent_tasks import reverse_loyers  # import tardif — Celery optionnel
        reverse_loyers.delay()

    return {"matches": matches, "non_matches": non_matches, "details": details}
