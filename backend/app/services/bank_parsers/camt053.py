"""
Parser CAMT.053 (Relevé de compte — SEPA / UE, préparation expansion Europe).

Les banques françaises, allemandes et italiennes exportent principalement
du CAMT.053 (V02, V06, V08). Ce parser extrait les entrées créditrices et
les normalise comme le parser suisse CAMT.054.

Phase 1 : parser présent mais non routé en prod. Pas d'impact fonctionnel.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from .base import BankEntry, BankStatementParser

_CAMT_NS = [
    "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02",
    "urn:iso:std:iso:20022:tech:xsd:camt.053.001.06",
    "urn:iso:std:iso:20022:tech:xsd:camt.053.001.08",
]


class Camt053Parser(BankStatementParser):
    country = "EU"  # générique (FR/DE/IT partagent le format)
    format_id = "camt.053"

    def parse(self, payload: bytes) -> list[BankEntry]:
        root = ET.fromstring(payload)
        entries: list[BankEntry] = []

        for ns_uri in _CAMT_NS:
            nsp = {"n": ns_uri}
            for ntry in root.findall(".//n:Ntry", nsp):
                # Ignore les débits : on ne réconcilie que les crédits
                cdt_dbt = ntry.findtext("n:CdtDbtInd", default="", namespaces=nsp)
                if cdt_dbt != "CRDT":
                    continue

                amt_el = ntry.find("n:Amt", nsp)
                date_el = ntry.find("n:BookgDt/n:Dt", nsp) or ntry.find("n:ValDt/n:Dt", nsp)
                # SEPA : référence end-to-end ou structured creditor ref
                ref_el = (
                    ntry.find(".//n:RmtInf/n:Strd/n:CdtrRefInf/n:Ref", nsp)
                    or ntry.find(".//n:NtryDtls/n:TxDtls/n:Refs/n:EndToEndId", nsp)
                    or ntry.find(".//n:RmtInf/n:Ustrd", nsp)
                )

                if amt_el is None or ref_el is None:
                    continue
                ref = (ref_el.text or "").strip().replace(" ", "")
                try:
                    amt = float((amt_el.text or "0").strip())
                except (ValueError, AttributeError):
                    continue
                ccy = amt_el.get("Ccy", "EUR")
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
                        raw={"format": "camt.053", "ns": ns_uri},
                    )
                )

        return entries
