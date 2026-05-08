"""pdf_edl_service.py — Génération PDF État Des Lieux (PR-EDL-3, 2026-05-08).

Source de vérité = JSONB stocké dans `changements_locataire.edl_entree` /
`edl_sortie` (cf migration 0030, schéma `app.schemas.changement_locataire`).
Le PDF est un **dérivé** — pas une nouvelle source (cf 3-ARCHITECTURE.md §3.3
« Une donnée = une source de vérité unique »).

Architecture choisie (PR-EDL-3 partie 1) :
- fpdf2 (déjà dans requirements, cf pattern `export_etat_locatif_pdf`).
- 100% Python — pas de templates Jinja2.
- Photos Phase 1 : paths référencés en texte (pas embed). Embed = Phase 2.
- Encodage FR via latin-1 (Helvetica core couvre é/è/à/ç/ô/ù/û/ê/î/ï).
- Signature : 2 cases côte à côte (Bailleur / Locataire) en footer.
- Disclaimer IA §4.9 obligatoire en footer (champ `disclaimer_included = true`
  côté `DocumentAlthy` quand stocké).
- Émetteur HBM Swiss Sàrl via `settings.ALTHY_CREDITOR_NAME` (CLAUDE.md §B.3).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from app.core.config import settings
from fastapi import HTTPException, status
from fpdf import FPDF
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ── Constantes ───────────────────────────────────────────────────────────────

EDL_TYPES = {"entree", "sortie"}

# Disclaimer IA §4.9 — pied de page obligatoire pour tout document généré.
# Source texte : frontend/src/legal/CH/disclaimer-ia.md (synthèse).
_DISCLAIMER_IA = (
    "Document généré par l'assistant IA Althy à partir des données saisies. "
    "À titre indicatif uniquement — validation par un professionnel "
    "(régie, notaire, juriste) requise avant toute portée juridique. "
    "Conformément à l'art. 4.9 du règlement produit Althy."
)

# Mapping condition élément IA → libellé FR lisible.
_ETAT_LIBELLE = {
    "bon": "Bon état",
    "usure_normale": "Usure normale",
    "degradation": "Dégradation",
    "moyen": "État moyen",
    "mauvais": "Mauvais état",
    "": "Non renseigné",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

_LATIN1_SUBST = str.maketrans({
    # Tirets typographiques → tiret ASCII
    "—": "-",   # — em dash
    "–": "-",   # – en dash
    "−": "-",   # − minus
    # Puces → tiret/asterisque
    "•": "-",   # • bullet
    "·": "-",   # · middle dot (latin-1 mais ambigu visuellement)
    # Guillemets typographiques → ASCII
    "‘": "'",   # ' left single
    "’": "'",   # ' right single (apostrophe courbe — très fréquent)
    "“": '"',   # " left double
    "”": '"',   # " right double
    # Ellipse + non-breaking
    "…": "...", # …
    " ": " ",   # NBSP
    " ": " ",   # narrow NBSP
})


def _safe(s: Any) -> str:
    """Encode une string pour Helvetica core font (latin-1).

    fpdf2 + font core "Helvetica" ne supporte pas l'Unicode au-delà de
    latin-1 — couvre les accents français usuels (é/è/à/ç/ô/ù/û/ê/î/ï)
    + ISO-8859-1 standard. On substitue d'abord les caractères
    typographiques fréquents (em-dash, bullet, apostrophe courbe) qui
    sortent de latin-1 mais dont on a un équivalent ASCII propre.
    Tout résidu hors latin-1 → remplacé par '?' (très rare après subst).
    """
    if s is None:
        return ""
    return str(s).translate(_LATIN1_SUBST).encode("latin-1", "replace").decode("latin-1")


def _fmt_chf(value: Any) -> str:
    """Formatte un montant en CHF (séparateur milliers + 2 décimales)."""
    if value is None:
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "—"
    return f"CHF {v:,.2f}".replace(",", "'")


def _fmt_date(d: Any) -> str:
    """Formatte une date ISO en JJ.MM.AAAA (CH standard)."""
    if not d:
        return "—"
    if isinstance(d, date):
        return d.strftime("%d.%m.%Y")
    try:
        return date.fromisoformat(str(d)).strftime("%d.%m.%Y")
    except ValueError:
        return str(d)


# ── Loader ───────────────────────────────────────────────────────────────────

async def _load_edl_data(
    db: AsyncSession, changement_id: str, edl_type: str
) -> dict[str, Any]:
    """Charge changement + bien et retourne le payload EDL prêt à rendre.

    Lève 422 si JSONB EDL vide (pas de données à rendre — pré-condition
    métier : passer par /ai/draft-edl + sauvegarde avant la génération PDF).
    Lève 404 si changement introuvable.
    """
    if edl_type not in EDL_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "edl_type doit être 'entree' ou 'sortie'",
        )

    row = await db.execute(
        text("""
            SELECT cl.id, cl.bien_id, cl.edl_entree, cl.edl_sortie,
                   cl.date_checkout, cl.date_checkin,
                   cl.caution_retenue, cl.caution_motif,
                   b.adresse, b.cp, b.ville, b.type, b.owner_id
            FROM changements_locataire cl
            JOIN biens b ON b.id = cl.bien_id
            WHERE cl.id = :id
        """),
        {"id": changement_id},
    )
    rec = row.fetchone()
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Changement introuvable")

    edl_payload = rec.edl_entree if edl_type == "entree" else rec.edl_sortie
    if not edl_payload or not isinstance(edl_payload, dict):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Aucune donnée EDL ({edl_type}) à exporter — saisir l'EDL avant.",
        )
    pieces = edl_payload.get("pieces") or []
    if not pieces:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "EDL sans pièces — au moins une pièce requise pour générer le PDF.",
        )

    return {
        "changement_id": str(rec.id),
        "bien_id": str(rec.bien_id),
        "owner_id": str(rec.owner_id),
        "bien_adresse": rec.adresse,
        "bien_cp": rec.cp,
        "bien_ville": rec.ville,
        "bien_type": rec.type,
        "edl_type": edl_type,
        "edl": edl_payload,
        "inspection_date": rec.date_checkin if edl_type == "entree" else rec.date_checkout,
        "caution_retenue": rec.caution_retenue,
        "caution_motif": rec.caution_motif,
    }


# ── PDF rendering ────────────────────────────────────────────────────────────

class _EdlPdf(FPDF):
    """FPDF subclass avec header/footer institutionnels Althy."""

    def __init__(self, edl_type: str) -> None:
        super().__init__(unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(20, 20, 20)
        self._edl_type_label = (
            "État des lieux d'entrée" if edl_type == "entree"
            else "État des lieux de sortie"
        )

    def header(self) -> None:
        # Émetteur via settings — jamais hardcodé (CLAUDE.md §B.3).
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 5, _safe(settings.ALTHY_CREDITOR_NAME),
                  new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.cell(0, 4, _safe(settings.ALTHY_CREDITOR_STREET),
                  new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 4, _safe(settings.ALTHY_CREDITOR_CITY),
                  new_x="LMARGIN", new_y="NEXT")
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Helvetica", "I", 7)
        self.cell(0, 4, _safe(f"Page {self.page_no()}"), align="C")


def _section_title(pdf: FPDF, label: str) -> None:
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, _safe(label), new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(180, 180, 180)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(2)


def _kv(pdf: FPDF, label: str, value: str, label_w: float = 45.0) -> None:
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(label_w, 6, _safe(label))
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 6, _safe(value or "—"), new_x="LMARGIN", new_y="NEXT")


def _render_pieces(pdf: FPDF, pieces: list[dict[str, Any]]) -> None:
    """Rend la section Pièces avec elements[] (lecture seule Phase 1) + photos."""
    _section_title(pdf, "Inventaire par pièce")

    for idx, piece in enumerate(pieces, 1):
        nom = piece.get("nom") or f"Pièce {idx}"
        etat = _ETAT_LIBELLE.get(piece.get("etat", ""), piece.get("etat", ""))

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, _safe(f"{idx}. {nom}"),
                 new_x="LMARGIN", new_y="NEXT")
        _kv(pdf, "État synthèse", etat)

        commentaire = piece.get("commentaire") or ""
        if commentaire.strip():
            _kv(pdf, "Commentaire", commentaire)

        elements = piece.get("elements") or []
        if elements:
            pdf.set_font("Helvetica", "I", 9)
            pdf.cell(0, 5, _safe("Détail (par élément) :"),
                     new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for el in elements:
                el_name = el.get("name") or "—"
                el_cond = _ETAT_LIBELLE.get(el.get("condition", ""),
                                            el.get("condition", "")) or "—"
                el_notes = el.get("notes") or ""
                line = f"  - {el_name} : {el_cond}"
                if el_notes.strip():
                    line += f" ({el_notes})"
                pdf.multi_cell(0, 5, _safe(line),
                               new_x="LMARGIN", new_y="NEXT")

        photos = piece.get("photos") or []
        if photos:
            pdf.set_font("Helvetica", "I", 8)
            pdf.cell(0, 4, _safe(f"Photos jointes ({len(photos)}) :"),
                     new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 7)
            for p in photos:
                pdf.multi_cell(0, 4, _safe(f"  • {p}"),
                               new_x="LMARGIN", new_y="NEXT")

        pdf.ln(2)


def _render_keys(pdf: FPDF, keys_given: dict[str, int] | None) -> None:
    if not keys_given:
        return
    _section_title(pdf, "Clés remises")
    for key_type, count in keys_given.items():
        _kv(pdf, str(key_type).capitalize(), f"{count}")


def _render_meters(pdf: FPDF, meter_readings: dict[str, Any] | None) -> None:
    if not meter_readings:
        return
    _section_title(pdf, "Relevés compteurs")
    for meter, reading in meter_readings.items():
        _kv(pdf, str(meter).capitalize(),
            "—" if reading is None else str(reading))


def _render_degradations(pdf: FPDF, degradations: list[dict[str, Any]] | None) -> None:
    if not degradations:
        return
    _section_title(pdf, "Dégradations constatées")
    for i, deg in enumerate(degradations, 1):
        loc = deg.get("location") or deg.get("piece") or "—"
        desc = deg.get("description") or deg.get("desc") or "—"
        cost = deg.get("estimated_cost_chf") or deg.get("cost")
        line = f"{i}. [{loc}] {desc}"
        if cost is not None:
            line += f" — coût estimé : {_fmt_chf(cost)}"
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, _safe(line), new_x="LMARGIN", new_y="NEXT")


def _render_signatures(pdf: FPDF) -> None:
    """2 cases signature (Bailleur / Locataire) en bas du PDF."""
    pdf.ln(8)
    _section_title(pdf, "Signatures")

    box_w = (pdf.w - pdf.l_margin - pdf.r_margin - 8) / 2
    y_start = pdf.get_y()

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(box_w, 6, _safe("Bailleur"))
    pdf.cell(8, 6, "")
    pdf.cell(box_w, 6, _safe("Locataire"), new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 8)
    for label in ("Nom :", "Date :", "Signature :"):
        pdf.cell(box_w, 12, _safe(label), border=1)
        pdf.cell(8, 12, "")
        pdf.cell(box_w, 12, _safe(label), border=1, new_x="LMARGIN", new_y="NEXT")

    _ = y_start  # garde y_start si besoin futur (alignement vertical)


def _render_disclaimer(pdf: FPDF) -> None:
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(110, 110, 110)
    pdf.multi_cell(0, 3.5, _safe(_DISCLAIMER_IA),
                   new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)


# ── Public entry-point ───────────────────────────────────────────────────────

async def render_edl_pdf(
    db: AsyncSession,
    changement_id: str,
    edl_type: str,
) -> bytes:
    """Génère un PDF d'EDL à partir du JSONB stocké.

    Args:
        db: session AsyncSession (lecture seule).
        changement_id: UUID du changement_locataire.
        edl_type: "entree" ou "sortie".

    Returns:
        Le PDF complet en bytes (`bytes`).

    Raises:
        HTTPException 404 si changement introuvable.
        HTTPException 422 si JSONB EDL vide ou edl_type invalide.
    """
    data = await _load_edl_data(db, changement_id, edl_type)
    edl: dict[str, Any] = data["edl"]

    pdf = _EdlPdf(edl_type)
    pdf.add_page()

    # ── Titre principal ────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, _safe(pdf._edl_type_label),
             new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(2)

    # ── Métadonnées bien + inspection ──────────────────────────────────────
    _section_title(pdf, "Bien concerné")
    _kv(pdf, "Type", data["bien_type"] or "—")
    _kv(pdf, "Adresse",
        f"{data['bien_adresse']}, {data['bien_cp']} {data['bien_ville']}")
    _kv(pdf, "Date d'inspection", _fmt_date(data["inspection_date"]))

    general_condition = edl.get("general_condition")
    if general_condition:
        _kv(pdf, "État général",
            _ETAT_LIBELLE.get(general_condition, general_condition))

    # ── Pièces (cœur du document) ──────────────────────────────────────────
    _render_pieces(pdf, edl.get("pieces") or [])

    # ── Annexes structurées (PR-EDL-2) ─────────────────────────────────────
    _render_keys(pdf, edl.get("keys_given"))
    _render_meters(pdf, edl.get("meter_readings"))
    _render_degradations(pdf, edl.get("degradations"))

    # ── Coût estimé total ──────────────────────────────────────────────────
    cost = edl.get("total_estimated_cost_chf")
    if cost is not None:
        _section_title(pdf, "Coût total estimé")
        _kv(pdf, "Total", _fmt_chf(cost))

    # ── Caution (sortie uniquement) ────────────────────────────────────────
    if edl_type == "sortie" and data["caution_retenue"] is not None:
        _section_title(pdf, "Caution")
        _kv(pdf, "Retenue", _fmt_chf(data["caution_retenue"]))
        if data["caution_motif"]:
            _kv(pdf, "Motif", data["caution_motif"])

    # ── Remarques libres ───────────────────────────────────────────────────
    remarks = edl.get("remarks")
    if remarks and remarks.strip():
        _section_title(pdf, "Remarques")
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, _safe(remarks),
                       new_x="LMARGIN", new_y="NEXT")

    # ── Signatures + disclaimer IA ─────────────────────────────────────────
    _render_signatures(pdf)
    _render_disclaimer(pdf)

    return bytes(pdf.output())
