"""Helpers partagés pour la génération PDF (fpdf2).

Contexte : fpdf2 + polices core (Helvetica/Times/Courier) sont en latin-1 et
ne supportent pas les caractères Unicode étendus comme l'em dash `—` ou les
guillemets typographiques. Encoder un tel texte lève `UnicodeEncodeError`
dans `normalize_text` au runtime.

Phase 1 (correctif rapide) : `sanitize_for_pdf()` remplace les caractères
Unicode problématiques par des équivalents latin-1 / ASCII.

Phase 2 (refonte propre, sprint dédié) : embarquer une police TTF Unicode
(DejaVu/Noto Sans) via `pdf.add_font(..., uni=True)` — coût bundle ~700 KB
par police, et nécessite tests visuels sur tous les PDFs.
"""
from __future__ import annotations


# Caractères Unicode courants à remplacer pour la compatibilité latin-1.
# Valable pour les polices core fpdf2 (Helvetica, Times, Courier).
_REPLACEMENTS: dict[str, str] = {
    "—": "-",      # em dash —
    "–": "-",      # en dash –
    "―": "-",      # horizontal bar ―
    "−": "-",      # minus sign −
    "‘": "'",      # left single quote ‘
    "’": "'",      # right single quote ’
    "‚": ",",      # single low quote ‚
    "“": '"',      # left double quote “
    "”": '"',      # right double quote ”
    "„": '"',      # double low quote „
    "…": "...",    # ellipsis …
    " ": " ",      # non-breaking space (NBSP)
    " ": " ",      # narrow no-break space
    " ": " ",      # thin space
    "​": "",       # zero-width space
    "™": "(TM)",   # trademark ™
    "®": "(R)",    # registered ®
    "©": "(C)",    # copyright ©
}


def sanitize_for_pdf(text: str | None) -> str:
    """Remplace les caractères Unicode non supportés par fpdf2 (polices core).

    Phase 1 : fix immédiat pour éviter `UnicodeEncodeError` au runtime.
    Phase 2 : migrer vers une police TTF Unicode (DejaVu/Noto) — sprint dédié.

    Retourne `""` si `text` est `None` ou vide (pratique pour les `cell()`).
    """
    if not text:
        return ""
    for unicode_char, replacement in _REPLACEMENTS.items():
        text = text.replace(unicode_char, replacement)
    return text
