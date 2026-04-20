"""
Interface commune à tous les parsers de relevés bancaires.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(slots=True)
class BankEntry:
    """Une ligne de relevé bancaire normalisée (indépendante du format source)."""

    reference: str
    """Référence du paiement (QR-référence CH, end-to-end SEPA, etc.)."""

    montant: float
    """Montant crédité."""

    date: str
    """ISO-8601 (YYYY-MM-DD) — date de comptabilisation."""

    currency: str = "CHF"
    """ISO-4217 (CHF, EUR, ...). Extrait du champ Ccy du relevé si présent."""

    raw: dict = field(default_factory=dict)
    """Champs bruts additionnels pour debug / audit."""


class UnsupportedFormatError(ValueError):
    """Levée quand aucun parser n'est enregistré pour (country, format)."""


class BankStatementParser(ABC):
    """Parser abstrait d'un relevé bancaire."""

    #: ISO-3166-1 alpha-2 du pays de la banque émettrice ("CH", "FR", "DE", ...)
    country: str = ""

    #: Identifiant court du format ("camt.054", "camt.053", "mt940", ...)
    format_id: str = ""

    @abstractmethod
    def parse(self, payload: bytes) -> list[BankEntry]:
        """Parse les bytes du fichier et retourne une liste normalisée."""
