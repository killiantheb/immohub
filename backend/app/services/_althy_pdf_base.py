"""Base PDF Althy — header/footer institutionnels + palette + helpers.

Factorisé Lot 3 Sprint 10 pour les 6 templates signables (bail Sunimmo
4 variantes, avenant, résiliation, mandat de gestion, convention sortie,
EDL avec photos embed).

Doctrine :
  - §B.3 footer entité légale via `settings.ALTHY_CREDITOR_*` (jamais hardcoder
    « HBM Swiss Sàrl »).
  - §B.4 palette Prussian #0F2E4C + Or #C9A961 (jamais d'orange terracotta).
  - §B.2 fr-CH + CHF (jamais €), apostrophe milliers (CHF 1'200.00).
  - §B.11 pas de Lorem Ipsum. Champs vides → "—" ou "À renseigner".

Stack : fpdf2 (police core Helvetica latin-1 — sanitize obligatoire via `_s`).

Source de vérité textes légaux Sunimmo :
`docs/sunimmo-templates/Location Templates/Bail/Bail à l'année.pdf`
+ Contrat de mandat de gestion locative.pdf. Reproduit fidèlement pour Phase 1.0
Sunimmo, à étendre Phase 2 si autres agences clientes.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.core.config import settings
from app.services._pdf_utils import sanitize_for_pdf as _s
from fpdf import FPDF

# ── Palette §B.4 ──────────────────────────────────────────────────────────────
PRUSSIAN = (15, 46, 76)         # #0F2E4C — accent principal, titres
GOLD = (201, 169, 97)           # #C9A961 — accent premium, accents fins
INK = (26, 22, 18)              # #1A1612 — texte titre / valeurs
MUTED = (110, 118, 130)         # #6E7682 — texte secondaire
PARCHMENT = (248, 246, 240)     # #F8F6F0 — fond row alterné, sections
LINE = (224, 220, 210)          # divider clair


# ── Helpers de formatage ──────────────────────────────────────────────────────


def fmt_chf(value: Any, with_currency: bool = True) -> str:
    """Format CHF suisse — apostrophe milliers + 2 décimales (`CHF 1'200.00`)."""
    if value is None:
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "—"
    integer_part, _, decimal_part = f"{v:.2f}".partition(".")
    integer_with_sep = "{:,}".format(int(integer_part)).replace(",", "'")
    formatted = f"{integer_with_sep}.{decimal_part}"
    return f"CHF {formatted}" if with_currency else formatted


def fmt_date(d: Any) -> str:
    """Format date suisse `JJ.MM.AAAA`."""
    if d is None:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d[:10])
        except ValueError:
            return d
    if isinstance(d, datetime):
        d = d.date()
    if isinstance(d, date):
        return d.strftime("%d.%m.%Y")
    return str(d)


def fmt_int(value: Any, fallback: str = "—") -> str:
    if value is None:
        return fallback
    try:
        return str(int(value))
    except (TypeError, ValueError):
        return fallback


def fmt_pct(value: Any, fallback: str = "—") -> str:
    if value is None:
        return fallback
    try:
        return f"{float(value):.2f}%".rstrip("0").rstrip(".") + "%" if str(float(value)).endswith("0") else f"{float(value):.2f}%"
    except (TypeError, ValueError):
        return fallback


# ── Base FPDF class ───────────────────────────────────────────────────────────


class AlthyPdfBase(FPDF):
    """Base FPDF avec header / footer Althy institutionnels.

    Args:
        title: titre affiché dans le header (haut de chaque page).
        subtitle: sous-titre optionnel (sous le titre).
        sender_name: nom expéditeur affiché en haut à droite (ex: "SUNIMMO Riviera").
                     Si None, utilise settings.ALTHY_CREDITOR_NAME.
        sender_address: adresse expéditeur (multiline OK).
        emit_disclaimer_ia: si True, ajoute le disclaimer IA §4.9 en pied de
                            dernière page.
    """

    def __init__(
        self,
        title: str,
        *,
        subtitle: str | None = None,
        sender_name: str | None = None,
        sender_address: str | None = None,
        emit_disclaimer_ia: bool = False,
    ) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(20, 22, 20)
        self.set_auto_page_break(auto=True, margin=22)
        self._title = title
        self._subtitle = subtitle
        self._sender_name = sender_name or settings.ALTHY_CREDITOR_NAME
        self._sender_address = sender_address or self._default_sender_address()
        self._emit_disclaimer_ia = emit_disclaimer_ia

    @staticmethod
    def _default_sender_address() -> str:
        return (
            f"{settings.ALTHY_CREDITOR_STREET}\n"
            f"{settings.ALTHY_CREDITOR_CITY}\n"
            f"{settings.ALTHY_CREDITOR_COUNTRY}"
        )

    # ── Header (chaque page) ─────────────────────────────────────────────────

    def header(self) -> None:
        # Barre d'accent Or en haut
        self.set_fill_color(*GOLD)
        self.rect(0, 0, 210, 2, style="F")

        self.set_y(8)

        # Sender name (haut gauche)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*PRUSSIAN)
        self.cell(110, 5, _s(self._sender_name))

        # Page X/Y (haut droite)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(
            0, 5,
            _s(f"Page {self.page_no()}/{{nb}}"),
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )

        # Sender address (multiline gauche)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        for line in self._sender_address.split("\n"):
            self.cell(0, 4, _s(line), new_x="LMARGIN", new_y="NEXT")

        # Divider fin
        self.ln(2)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        self.line(20, self.get_y(), 190, self.get_y())
        self.ln(4)

    # ── Footer (chaque page) ─────────────────────────────────────────────────

    def footer(self) -> None:
        self.set_y(-15)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        self.line(20, self.get_y(), 190, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*MUTED)
        legal_line = (
            f"Document généré par Althy · Édité par {settings.ALTHY_CREDITOR_NAME} · "
            f"althy.ch"
        )
        self.cell(0, 4, _s(legal_line), align="C")

    # ── Helpers de mise en page ───────────────────────────────────────────────

    def big_title(self, text: str) -> None:
        """Titre principal du document — Fraunces-style serif gras."""
        self.set_font("Times", "B", 22)
        self.set_text_color(*INK)
        self.cell(0, 12, _s(text), align="C", new_x="LMARGIN", new_y="NEXT")
        if self._subtitle:
            self.set_font("Helvetica", "", 10)
            self.set_text_color(*MUTED)
            self.cell(0, 5, _s(self._subtitle), align="C", new_x="LMARGIN", new_y="NEXT")
        # Petite ligne dorée centrale
        y = self.get_y() + 2
        self.set_draw_color(*GOLD)
        self.set_line_width(0.6)
        self.line(95, y, 115, y)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        self.ln(8)

    def section_title(self, text: str, *, gold_underline: bool = True) -> None:
        """Titre de section — small-caps petit + underline Or."""
        self.ln(2)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*PRUSSIAN)
        self.cell(0, 5, _s(text.upper()), new_x="LMARGIN", new_y="NEXT")
        if gold_underline:
            y = self.get_y()
            self.set_draw_color(*GOLD)
            self.set_line_width(0.4)
            self.line(20, y, 50, y)
            self.set_draw_color(*LINE)
            self.set_line_width(0.2)
        self.ln(4)

    def field_row(self, label: str, value: str, *, label_w: float = 60.0) -> None:
        """Ligne `label : value` (paragraphe court)."""
        y0 = self.get_y()
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        self.cell(label_w, 5, _s(label))
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*INK)
        self.multi_cell(
            0, 5, _s(value or "—"), new_x="LMARGIN", new_y="NEXT"
        )
        self.ln(0.5)

    def paragraph(self, text: str, *, size: float = 9, color: tuple[int, int, int] = INK) -> None:
        """Paragraphe de texte courant."""
        self.set_font("Helvetica", "", size)
        self.set_text_color(*color)
        self.multi_cell(0, 4.8, _s(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def paragraph_b(self, text: str, *, size: float = 9) -> None:
        """Paragraphe gras."""
        self.set_font("Helvetica", "B", size)
        self.set_text_color(*INK)
        self.multi_cell(0, 4.8, _s(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def bullet_list(self, items: list[str], *, size: float = 9) -> None:
        """Liste à puces sobre."""
        self.set_font("Helvetica", "", size)
        self.set_text_color(*INK)
        for it in items:
            self.cell(5, 4.5, _s("•"))
            self.multi_cell(0, 4.5, _s(it), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def divider(self) -> None:
        self.ln(3)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        self.line(20, self.get_y(), 190, self.get_y())
        self.ln(3)

    def signatures_block(
        self,
        roles: list[tuple[str, str | None]],
        *,
        city: str = "Crans-Montana",
        signed_date: date | None = None,
    ) -> None:
        """Bloc signatures — N cases côte à côte.

        Args:
            roles: liste de (libellé, nom_signataire_optionnel).
                   Ex: [("Locataire", "Jean Dupont"), ("Sunimmo", None)]
            city: lieu de signature.
            signed_date: date de signature. Si None, "à compléter".
        """
        self.ln(4)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        date_str = fmt_date(signed_date) if signed_date else "à compléter"
        self.cell(
            0, 5, _s(f"Établi en 2 exemplaires, à {city}, le {date_str}"),
            new_x="LMARGIN", new_y="NEXT",
        )
        self.ln(2)

        n = len(roles)
        if n == 0:
            return
        col_w = (210 - 40 - (n - 1) * 8) / n
        for i, (role, name) in enumerate(roles):
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*PRUSSIAN)
            x = 20 + i * (col_w + 8)
            self.set_xy(x, self.get_y())
            self.cell(col_w, 5, _s(role))
        self.ln(6)

        # Cases signature visuelle (placeholder Skribble — l'overlay
        # signature visuelle Skribble sera positionné ici sur le PDF signé).
        y_box = self.get_y()
        for i in range(n):
            x = 20 + i * (col_w + 8)
            self.set_draw_color(*LINE)
            self.set_line_width(0.2)
            self.rect(x, y_box, col_w, 18)
        self.set_y(y_box + 20)

        # Noms sous les cases
        for i, (_role, name) in enumerate(roles):
            x = 20 + i * (col_w + 8)
            self.set_xy(x, self.get_y())
            self.set_font("Helvetica", "", 8)
            self.set_text_color(*MUTED)
            self.cell(col_w, 4, _s(name or "Nom · Prénom"))
        self.ln(5)

    def disclaimer_ia(self) -> None:
        """Pied de page disclaimer IA §4.9 — à appeler avant la fin du document."""
        if not self._emit_disclaimer_ia:
            return
        self.ln(4)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*MUTED)
        msg = (
            "Document généré par l'assistant Althy à partir des données saisies. "
            "Le contenu juridique est conforme au Code des Obligations Suisse. "
            "Validation par un professionnel (régie, juriste) recommandée pour "
            "les cas particuliers."
        )
        self.multi_cell(0, 3.5, _s(msg), new_x="LMARGIN", new_y="NEXT")
