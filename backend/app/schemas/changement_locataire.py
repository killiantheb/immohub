"""Pydantic schemas — changements_locataire (EDL focus).

Phase 1 EDL : valide la structure du JSONB `edl_sortie` / `edl_entree`
stockée par `routers/changements.py:update_edl`. Avant ce schéma, le champ
était `list[dict[str, Any]]` côté backend → aucune validation de la
structure des pièces.

Source de vérité de la forme JSONB : commentaire SQL dans
`backend/alembic/versions/0030_changements_locataire.py:79-80` :
    { pieces: [{ nom, etat, commentaire, photos: [] }], inventaire: {} }

PR-EDL-2 (2026-05-07) — enrichissement back-compat pour absorber tout ce
que `/ai/draft-edl` renvoie (elements[], keys_given, meter_readings,
degradations, total_estimated_cost_chf, remarks, general_condition).
Tous les nouveaux champs sont OPTIONNELS — l'ancien JSONB ne validera
toujours (pas de migration de données nécessaire). L'édition complète
des `elements[]` est Phase 2 ; en Phase 1 ils sont en lecture seule
côté frontend.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Enums (FR canonique projet, cf CLAUDE.md §3.12) ─────────────────────────
EdlType = Literal["entree", "sortie"]
EtatPiece = Literal["bon", "usure_normale", "degradation", ""]
GeneralCondition = Literal["bon", "moyen", "mauvais", ""]


class EdlElement(BaseModel):
    """Sous-élément d'une pièce (sol, murs, plafond, éclairage…) tel que
    renvoyé par `/ai/draft-edl`. Lecture seule Phase 1 ; édition Phase 2.

    `condition` reste libre (str) côté schéma : l'IA peut renvoyer "à noter"
    en plus des trois valeurs canoniques. La normalisation cosmétique est
    laissée au frontend.
    """

    name: str = Field(..., min_length=1, max_length=100)
    condition: str = Field("", max_length=50)
    notes: str = Field("", max_length=2000)


class EdlPiece(BaseModel):
    """Une pièce d'un EDL — sortie ou entrée.

    `etat = ""` est accepté pour permettre aux pièces fraîchement ajoutées de
    rester sans état tant que le user n'a pas saisi.
    `photos` contient des PATHS RELATIFS au bucket `edl-photos`
    (cf POST /changements/{id}/edl-photos qui retourne `{ url, path }`).
    On ne stocke jamais d'URL signée dans le JSONB (TTL 1 h, deviendrait
    invalide). Le frontend re-signe au load via le hook dédié.

    `elements` (PR-EDL-2) : structure riche renvoyée par l'IA. Optionnelle —
    les pièces saisies à la main n'en ont pas. La condensation `etat`
    reste la source de vérité du résumé pièce ; `elements` est un détail
    non-éditable Phase 1.
    """

    nom: str = Field(..., min_length=1, max_length=100)
    etat: EtatPiece = ""
    commentaire: str = Field("", max_length=2000)
    photos: list[str] = Field(default_factory=list)
    elements: list[EdlElement] | None = None


class EdlSortieSchema(BaseModel):
    """Structure complète du JSONB stocké dans `edl_sortie` / `edl_entree`.

    Champs racine PR-EDL-2 : tous OPTIONNELS pour back-compat avec le JSONB
    pré-existant (qui ne contient que `pieces` + `inventaire`). Persistés
    tels quels par `update_edl` quand le frontend les fournit (typiquement
    après pré-remplissage IA).

    `inventaire` reste libre (`dict[str, Any]`) Phase 1 — sera typé Phase 2
    (compteurs, mobilier furnished, etc.). Note : `keys_given` /
    `meter_readings` PR-EDL-2 sont stockés au niveau racine, pas dans
    `inventaire`, pour rester alignés avec le contrat IA.
    """

    pieces: list[EdlPiece] = Field(default_factory=list)
    inventaire: dict[str, Any] = Field(default_factory=dict)

    # ── Champs racine enrichis (PR-EDL-2) ────────────────────────────────
    general_condition: GeneralCondition | None = None
    keys_given: dict[str, int] | None = None
    meter_readings: dict[str, float | None] | None = None
    degradations: list[dict[str, Any]] | None = None
    total_estimated_cost_chf: float | None = None
    remarks: str | None = Field(None, max_length=4000)
