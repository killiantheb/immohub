"""
Bank parsers — abstraction multi-banque pour la réconciliation.

Phase 1 (2026-04-20) : Suisse uniquement via CAMT.054 (QR-facture SPC 2.0).

Expansion future (Y3-Y4) : SEPA (EUR) pour FR/DE/IT via CAMT.053 et/ou
MT940. L'abstraction `BankStatementParser` permet d'ajouter un parser par
pays sans toucher au service de réconciliation.

Usage :
    from app.services.bank_parsers import get_parser

    parser = get_parser(bank_country="CH", format="camt.054")
    entries = parser.parse(xml_bytes)  # -> list[BankEntry]
"""

from .base import BankEntry, BankStatementParser, UnsupportedFormatError
from .camt054 import Camt054Parser
from .camt053 import Camt053Parser
from .registry import get_parser, register_parser

__all__ = [
    "BankEntry",
    "BankStatementParser",
    "UnsupportedFormatError",
    "Camt054Parser",
    "Camt053Parser",
    "get_parser",
    "register_parser",
]
