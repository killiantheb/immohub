"""
Parser CAMT.054 (Notification de crédit — Suisse via QR-facture SPC 2.0).
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from .base import BankEntry, BankStatementParser

# Namespaces supportés (V04 SIX classique, V08 récent)
_CAMT_NS = [
    "urn:iso:std:iso:20022:tech:xsd:camt.054.001.04",
    "urn:iso:std:iso:20022:tech:xsd:camt.054.001.08",
]


class Camt054Parser(BankStatementParser):
    country = "CH"
    format_id = "camt.054"

    def parse(self, payload: bytes) -> list[BankEntry]:
        root = ET.fromstring(payload)
        entries: list[BankEntry] = []

        for ns_uri in _CAMT_NS:
            nsp = {"n": ns_uri}
            for ntry in root.findall(".//n:Ntry", nsp):
                amt_el = ntry.find("n:Amt", nsp)
                date_el = ntry.find("n:BookgDt/n:Dt", nsp) or ntry.find("n:ValDt/n:Dt", nsp)
                ref_el = ntry.find(".//n:RmtInf/n:Strd/n:CdtrRefInf/n:Ref", nsp)

                if amt_el is None or ref_el is None:
                    continue
                ref = (ref_el.text or "").strip().replace(" ", "")
                try:
                    amt = float((amt_el.text or "0").strip())
                except (ValueError, AttributeError):
                    continue
                ccy = amt_el.get("Ccy", "CHF")
                dt = (
                    date_el.text.strip()
                    if date_el is not None and date_el.text
                    else datetime.now(UTC).date().isoformat()
                )
                entries.append(
                    BankEntry(
                        reference=ref,
                        montant=amt,
                        date=dt,
                        currency=ccy,
                        raw={"format": "camt.054", "ns": ns_uri},
                    )
                )

        return entries
