"""
Registry de parsers — résolution (country, format) → parser.

Permet d'ajouter un parser SEPA / MT940 / pain.001 futur sans modifier le
service de réconciliation.
"""
from __future__ import annotations

from .base import BankStatementParser, UnsupportedFormatError
from .camt053 import Camt053Parser
from .camt054 import Camt054Parser

_REGISTRY: dict[tuple[str, str], type[BankStatementParser]] = {}


def register_parser(country: str, format_id: str, parser_cls: type[BankStatementParser]) -> None:
    """Enregistre un parser pour un couple (pays, format)."""
    _REGISTRY[(country.upper(), format_id.lower())] = parser_cls


def get_parser(bank_country: str = "CH", format: str = "camt.054") -> BankStatementParser:
    """Retourne une instance du parser pour (bank_country, format).

    Raises:
        UnsupportedFormatError: si aucun parser n'est enregistré.
    """
    key = (bank_country.upper(), format.lower())
    cls = _REGISTRY.get(key)
    if cls is None:
        raise UnsupportedFormatError(
            f"Aucun parser enregistré pour country={bank_country!r} format={format!r}. "
            f"Formats connus : {sorted(_REGISTRY.keys())}"
        )
    return cls()


# Enregistrement par défaut
register_parser("CH", "camt.054", Camt054Parser)
# Routes EU préparées (FR, DE, IT via CAMT.053)
register_parser("EU", "camt.053", Camt053Parser)
register_parser("FR", "camt.053", Camt053Parser)
register_parser("DE", "camt.053", Camt053Parser)
register_parser("IT", "camt.053", Camt053Parser)
