"""
Currency service — fondations multi-devises (2026-04-20).

Althy Phase 1 : CHF uniquement. Ce service pose les bases pour la future
expansion Europe (Y3-Y4) sans impact fonctionnel immédiat.

Exchange rates :
- En Phase 1 on ne fait AUCUN appel réseau. La fonction retourne des taux
  figés pour permettre aux développeurs frontend de tester le format multi-
  devise, mais toute conversion réelle en prod doit brancher un provider
  (ECB, XE, Fixer, Open Exchange Rates).
- Interface stable : `get_exchange_rate(from_currency, to_currency) -> float`
  reste identique quand on branchera une source live.

Formatting :
- `format_currency(amount, currency, locale)` applique le formatage local
  avec Babel si disponible, sinon fallback naïf (CHF 1'234.50).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Union

Number = Union[int, float, Decimal]

# ─── Constantes ──────────────────────────────────────────────────────────────

SUPPORTED_CURRENCIES: tuple[str, ...] = ("CHF", "EUR", "GBP", "USD")
DEFAULT_CURRENCY: str = "CHF"
DEFAULT_LOCALE: str = "fr_CH"

# Taux figés (2026-04-20) — à remplacer par appel API live avant expansion.
# Base : 1 CHF. Lecture : 1 CHF = {value} {currency}.
_FROZEN_RATES_BASE_CHF: dict[str, float] = {
    "CHF": 1.0,
    "EUR": 1.03,   # 1 CHF ≈ 1.03 EUR
    "GBP": 0.88,   # 1 CHF ≈ 0.88 GBP
    "USD": 1.11,   # 1 CHF ≈ 1.11 USD
}


class UnsupportedCurrencyError(ValueError):
    """Levée quand une devise hors `SUPPORTED_CURRENCIES` est demandée."""


# ─── API publique ────────────────────────────────────────────────────────────

def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    """Retourne le taux `from_currency` → `to_currency`.

    Phase 1 : taux figés (pas d'appel réseau).
    Phase Europe : brancher un provider (ECB XML, Fixer, XE) ici. L'interface
    ne change pas — les callers consomment toujours un `float`.

    Raises:
        UnsupportedCurrencyError: si une devise n'est pas dans SUPPORTED_CURRENCIES.
    """
    _ensure_supported(from_currency)
    _ensure_supported(to_currency)

    if from_currency == to_currency:
        return 1.0

    # Conversion via pivot CHF : from → CHF → to
    from_to_chf = 1.0 / _FROZEN_RATES_BASE_CHF[from_currency]
    chf_to_target = _FROZEN_RATES_BASE_CHF[to_currency]
    return from_to_chf * chf_to_target


def convert(amount: Number, from_currency: str, to_currency: str) -> float:
    """Convertit un montant d'une devise vers une autre."""
    rate = get_exchange_rate(from_currency, to_currency)
    return float(amount) * rate


def format_currency(
    amount: Number,
    currency: str = DEFAULT_CURRENCY,
    locale: str = DEFAULT_LOCALE,
) -> str:
    """Formate un montant selon la locale.

    Essaie Babel en premier (formatage local précis, ex: "1 234,50 CHF" en fr_CH).
    Fallback naïf si Babel absent : "CHF 1'234.50" style suisse.

    Args:
        amount: montant à formater.
        currency: ISO-4217 (CHF, EUR, ...).
        locale: BCP-47 ou POSIX (fr_CH, fr-CH, de_CH, en_US, ...).

    Returns:
        Chaîne formatée prête pour affichage.
    """
    _ensure_supported(currency)
    locale_normalized = locale.replace("-", "_")

    try:
        from babel.numbers import format_currency as babel_format  # type: ignore[import-not-found]

        return babel_format(Decimal(str(amount)), currency, locale=locale_normalized)
    except Exception:
        return _fallback_format(amount, currency)


# ─── Privé ───────────────────────────────────────────────────────────────────

def _ensure_supported(currency: str) -> None:
    if currency not in SUPPORTED_CURRENCIES:
        raise UnsupportedCurrencyError(
            f"Devise non supportée : {currency}. Attendu l'une de {SUPPORTED_CURRENCIES}."
        )


def _fallback_format(amount: Number, currency: str) -> str:
    """Formatage minimal sans Babel — style suisse (apostrophe pour milliers)."""
    value = float(amount)
    # Séparateur milliers : apostrophe (convention suisse)
    whole, dec = f"{value:,.2f}".split(".")
    whole = whole.replace(",", "'")
    return f"{currency} {whole}.{dec}"
