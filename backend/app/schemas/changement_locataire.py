"""Pydantic schemas — changements_locataire (EDL focus).

Phase 1 EDL : valide la structure du JSONB `edl_sortie` / `edl_entree`
stockée par `routers/changements.py:update_edl`. Avant ce schéma, le champ
était `list[dict[str, Any]]` côté backend → aucune validation de la
structure des pièces. Cette validation reste minimale (sans formaliser
encore inventaire ni meter readings) — sera enrichie aux phases suivantes.

Source de vérité de la forme JSONB : commentaire SQL dans
`backend/alembic/versions/0030_changements_locataire.py:79-80` :
    { pieces: [{ nom, etat, commentaire, photos: [] }], inventaire: {} }
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Enums (FR canonique projet, cf CLAUDE.md §3.12) ─────────────────────────
EdlType = Literal["entree", "sortie"]
EtatPiece = Literal["bon", "usure_normale", "degradation", ""]


class EdlPiece(BaseModel):
    """Une pièce d'un EDL — sortie ou entrée.

    `etat = ""` est accepté pour permettre aux pièces fraîchement ajoutées de
    rester sans état tant que le user n'a pas saisi.
    `photos` contient des PATHS RELATIFS au bucket `edl-photos`
    (cf POST /changements/{id}/edl-photos qui retourne `{ url, path }`).
    On ne stocke jamais d'URL signée dans le JSONB (TTL 1 h, deviendrait
    invalide). Le frontend re-signe au load via le hook dédié.
    """

    nom: str = Field(..., min_length=1, max_length=100)
    etat: EtatPiece = ""
    commentaire: str = Field("", max_length=2000)
    photos: list[str] = Field(default_factory=list)


class EdlSortieSchema(BaseModel):
    """Structure complète du JSONB stocké dans `edl_sortie` / `edl_entree`.

    `inventaire` reste libre (`dict[str, Any]`) Phase 1 — sera typé Phase 2
    (compteurs, clés remises, mobilier furnished, etc.).
    """

    pieces: list[EdlPiece] = Field(default_factory=list)
    inventaire: dict[str, Any] = Field(default_factory=dict)
