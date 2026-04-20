"""Réconciliation des paiements reçus sur le compte Althy.

Phase 1 : CAMT.054 (SIX Group, QR-facture SPC 2.0) pour la Suisse.
Phase Europe (Y3-Y4) : CAMT.053 pour SEPA via
`app.services.bank_parsers.get_parser("EU", "camt.053")`.

API publique conservée :
  - `parse_camt054(xml_bytes) -> list[dict]`
  - `parse_statement(payload, bank_country, format) -> list[dict]` (nouveau)
  - `reconcile_payments(incoming, db) -> dict`
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.bank_parsers import BankEntry, get_parser


def parse_camt054(xml_bytes: bytes) -> list[dict]:
    """Parse un fichier CAMT.054 (wrapper back-compat → nouveau registry)."""
    return _to_dicts(get_parser("CH", "camt.054").parse(xml_bytes))


def parse_statement(
    payload: bytes,
    bank_country: str = "CH",
    format: str = "camt.054",
) -> list[dict]:
    """Parse générique : délègue au registry `bank_parsers`.

    Args:
        payload: bytes du fichier (XML CAMT).
        bank_country: ISO-3166-1 alpha-2 (CH, FR, DE, IT, EU).
        format: identifiant format ("camt.054", "camt.053", ...).

    Returns:
        Liste normalisée [{reference, montant, date, currency}].
    """
    return _to_dicts(get_parser(bank_country, format).parse(payload))


def _to_dicts(entries: list[BankEntry]) -> list[dict]:
    return [
        {
            "reference": e.reference,
            "montant": e.montant,
            "date": e.date,
            "currency": e.currency,
        }
        for e in entries
    ]


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
