"""Service métier — Module Proposition de dates locataire (Sprint 4B).

Workflow back-and-forth bailleur ↔ locataire plafonné à `_MAX_PROPOSITIONS`
tours. À l'atteinte de la limite, l'UI bascule l'utilisateur sur la messagerie
1:1 du bien (cf §4.7 espace locataire — messagerie déjà câblée Sprint 1A.5).

Transitions autorisées (vérifiées par `_assert_transition_allowed`) :

  non_propose                  ──(propose locataire)──> propose_par_locataire
  propose_par_locataire        ──(accepte bailleur)──> accepte
  propose_par_locataire        ──(contre-prop bailleur)──> contre_propose_par_bailleur
  propose_par_locataire        ──(refuse bailleur/locataire)──> refuse
  contre_propose_par_bailleur  ──(accepte locataire)──> accepte
  contre_propose_par_bailleur  ──(re-contre locataire)──> propose_par_locataire (count++)
  contre_propose_par_bailleur  ──(refuse bailleur/locataire)──> refuse
  refuse                       ──(reset locataire)──> non_propose

Doctrine appliquée :
  - §B.10 : transitions strictes, HTTPException 400 si état incompatible.
    Pas de tolérance silencieuse — l'API refuse plutôt que d'afficher un
    faux statut.
  - §B.12 : chaque transition = un seul db.commit() englobant tout. Pas de
    flush isolé. Le caller (router) déclenche la transaction.
  - §B.15 : Phase 1.0 stricte. Pas de side-effect Resend / OAuth.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Final

from app.models.bien import Bien
from app.models.locataire import DossierLocataire, Locataire
from app.models.user import User
from app.schemas.proposition import (
    ContrePropositionBailleurRequest,
    PreferencesLocataire,
    PropositionStatusResponse,
    ProposerDatesRequest,
    ReContrePropositionLocataireRequest,
    RefuserPropositionRequest,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Plafond du back-and-forth. Au-delà → l'UI redirige vers la messagerie.
# Killian a fixé 4 tours (max 4 propositions cumulées des deux côtés) — au-delà
# c'est généralement signe d'un désaccord profond qui mérite un échange libre.
_MAX_PROPOSITIONS: Final[int] = 4


# ── RBAC helpers ──────────────────────────────────────────────────────────────


async def _resolve_parties(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    current_user: User,
) -> tuple[Locataire, Bien, bool, bool, bool]:
    """Vérifie l'accès au dossier et retourne (locataire, bien, is_locataire,
    is_bailleur, is_super_admin).

    Pattern identique à document_dossier_service.resolve_dossier_parties —
    duplication locale pour éviter un import croisé (Sprint Hardening Phase 2
    consolidera dans un helper RBAC commun).
    """
    row = await db.execute(
        select(Locataire, Bien)
        .join(Bien, Bien.id == Locataire.bien_id)
        .where(Locataire.id == locataire_id)
    )
    pair = row.one_or_none()
    if pair is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locataire introuvable")

    locataire, bien = pair
    is_super_admin = current_user.role == "super_admin"
    is_locataire = (
        locataire.user_id is not None and str(locataire.user_id) == str(current_user.id)
    )
    is_bailleur = str(bien.owner_id) == str(current_user.id) or (
        bien.agency_id is not None and str(bien.agency_id) == str(current_user.id)
    )

    if not (is_super_admin or is_locataire or is_bailleur):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous n'avez pas accès au dossier de ce locataire",
        )

    return locataire, bien, is_locataire, is_bailleur, is_super_admin


async def _get_or_create_dossier(
    db: AsyncSession,
    locataire_id: uuid.UUID,
) -> DossierLocataire:
    """Upsert du DossierLocataire (créé si absent)."""
    row = await db.execute(
        select(DossierLocataire).where(DossierLocataire.locataire_id == locataire_id)
    )
    dossier = row.scalar_one_or_none()
    if dossier is None:
        dossier = DossierLocataire(locataire_id=locataire_id)
        db.add(dossier)
        await db.flush()
    return dossier


# ── Computed flags (PropositionStatusResponse.peut_*) ─────────────────────────


def _build_status_response(
    locataire_id: uuid.UUID,
    dossier: DossierLocataire,
    is_locataire: bool,
    is_bailleur: bool,
    is_super_admin: bool,
) -> PropositionStatusResponse:
    """Construit la réponse status + computed flags.

    Les flags `peut_*` permettent au frontend de masquer/afficher les CTA sans
    dupliquer la logique de transition. Ils dépendent du rôle de l'appelant
    (un locataire ne voit jamais `peut_accepter_bailleur`).
    """
    statut = dossier.statut_proposition
    count = dossier.proposition_count
    limite_atteinte = count >= _MAX_PROPOSITIONS

    # Locataire ou super_admin agissent comme locataire pour les flags
    # locataire (super_admin peut tout faire — utile pour debug Sunimmo).
    locataire_can_act = is_locataire or is_super_admin
    bailleur_can_act = is_bailleur or is_super_admin

    peut_proposer = (
        locataire_can_act
        and statut == "non_propose"
        and not limite_atteinte
    )
    peut_contre_proposer = (
        bailleur_can_act
        and statut == "propose_par_locataire"
        and not limite_atteinte
    )
    peut_accepter_bailleur = (
        bailleur_can_act and statut == "propose_par_locataire"
    )
    peut_accepter_locataire = (
        locataire_can_act and statut == "contre_propose_par_bailleur"
    )
    peut_re_contre_proposer = (
        locataire_can_act
        and statut == "contre_propose_par_bailleur"
        and not limite_atteinte
    )
    peut_refuser = (
        statut in ("propose_par_locataire", "contre_propose_par_bailleur")
        and (locataire_can_act or bailleur_can_act)
    )
    peut_reset = locataire_can_act and statut == "refuse"

    # Préférences JSONB → Pydantic
    prefs_raw = dict(dossier.preferences or {})
    preferences = PreferencesLocataire(**prefs_raw)

    return PropositionStatusResponse(
        locataire_id=locataire_id,
        statut_proposition=statut,  # type: ignore[arg-type]  # CHECK constraint DB
        proposition_count=count,
        date_entree_souhaitee=dossier.date_entree_souhaitee,
        duree_envisagee=dossier.duree_envisagee,  # type: ignore[arg-type]
        preferences=preferences,
        commentaire_locataire=dossier.commentaire_locataire,
        date_contre_proposee_bailleur=dossier.date_contre_proposee_bailleur,
        commentaire_bailleur=dossier.commentaire_bailleur,
        motif_refus=dossier.motif_refus,
        date_accord=dossier.date_accord,
        last_proposed_at=dossier.last_proposed_at,
        last_proposed_by=dossier.last_proposed_by,  # type: ignore[arg-type]
        peut_proposer=peut_proposer,
        peut_contre_proposer=peut_contre_proposer,
        peut_accepter_locataire=peut_accepter_locataire,
        peut_accepter_bailleur=peut_accepter_bailleur,
        peut_re_contre_proposer=peut_re_contre_proposer,
        peut_refuser=peut_refuser,
        peut_reset=peut_reset,
        limite_atteinte=limite_atteinte,
    )


# ── Actions ───────────────────────────────────────────────────────────────────


def _assert_transition_allowed(
    *,
    current_statut: str,
    expected: tuple[str, ...],
    action_label: str,
) -> None:
    """§B.10 — refus explicite si l'état actuel n'autorise pas la transition."""
    if current_statut not in expected:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Action « {action_label} » impossible depuis l'état "
            f"« {current_statut} ». États autorisés : {', '.join(expected)}.",
        )


def _assert_count_under_limit(count: int, action_label: str) -> None:
    if count >= _MAX_PROPOSITIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Limite de {_MAX_PROPOSITIONS} propositions atteinte. Continuez "
            f"la discussion par messagerie. Action bloquée : {action_label}.",
        )


async def propose_dates_locataire(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    payload: ProposerDatesRequest,
    current_user: User,
) -> PropositionStatusResponse:
    """Locataire propose ses dates initiales (premier tour ou après reset)."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_locataire or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le locataire peut proposer ses dates d'entrée",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("non_propose",),
        action_label="proposer",
    )
    _assert_count_under_limit(dossier.proposition_count, "proposer")

    dossier.date_entree_souhaitee = payload.date_entree_souhaitee
    dossier.duree_envisagee = payload.duree_envisagee
    dossier.preferences = payload.preferences.model_dump(exclude_none=True)
    dossier.commentaire_locataire = payload.commentaire
    dossier.statut_proposition = "propose_par_locataire"
    dossier.proposition_count = (dossier.proposition_count or 0) + 1
    dossier.last_proposed_at = datetime.now(UTC)
    dossier.last_proposed_by = "locataire"

    await _commit_or_raise(db, "proposition")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def accepter_proposition_bailleur(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    current_user: User,
) -> PropositionStatusResponse:
    """Bailleur accepte la date proposée par le locataire."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_bailleur or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le bailleur peut accepter la proposition du locataire",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("propose_par_locataire",),
        action_label="accepter (bailleur)",
    )
    if dossier.date_entree_souhaitee is None:
        # Filet de sécurité — ne devrait jamais arriver si l'état précédent
        # est cohérent.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Aucune date proposée à accepter (dossier incohérent)",
        )

    dossier.statut_proposition = "accepte"
    dossier.date_accord = dossier.date_entree_souhaitee
    await _commit_or_raise(db, "acceptation bailleur")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def contre_proposer_bailleur(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    payload: ContrePropositionBailleurRequest,
    current_user: User,
) -> PropositionStatusResponse:
    """Bailleur contre-propose une autre date au locataire."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_bailleur or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le bailleur peut contre-proposer une date",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("propose_par_locataire",),
        action_label="contre-proposer",
    )
    _assert_count_under_limit(dossier.proposition_count, "contre-proposer")

    dossier.date_contre_proposee_bailleur = payload.date_contre_proposee
    dossier.commentaire_bailleur = payload.commentaire
    dossier.statut_proposition = "contre_propose_par_bailleur"
    dossier.proposition_count = (dossier.proposition_count or 0) + 1
    dossier.last_proposed_at = datetime.now(UTC)
    dossier.last_proposed_by = "bailleur"

    await _commit_or_raise(db, "contre-proposition bailleur")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def accepter_contre_proposition_locataire(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    current_user: User,
) -> PropositionStatusResponse:
    """Locataire accepte la contre-proposition du bailleur."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_locataire or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le locataire peut accepter la contre-proposition du bailleur",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("contre_propose_par_bailleur",),
        action_label="accepter (locataire)",
    )
    if dossier.date_contre_proposee_bailleur is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Aucune contre-proposition à accepter (dossier incohérent)",
        )

    dossier.statut_proposition = "accepte"
    dossier.date_accord = dossier.date_contre_proposee_bailleur
    await _commit_or_raise(db, "acceptation locataire")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def re_contre_proposer_locataire(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    payload: ReContrePropositionLocataireRequest,
    current_user: User,
) -> PropositionStatusResponse:
    """Locataire re-contre-propose une nouvelle date après contre-proposition
    bailleur. Repart sur le statut `propose_par_locataire` (le cycle continue)."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_locataire or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le locataire peut re-contre-proposer une date",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("contre_propose_par_bailleur",),
        action_label="re-contre-proposer",
    )
    _assert_count_under_limit(dossier.proposition_count, "re-contre-proposer")

    dossier.date_entree_souhaitee = payload.date_entree_souhaitee
    # Optionnel : nouveau commentaire locataire (écrase l'ancien si fourni).
    if payload.commentaire is not None:
        dossier.commentaire_locataire = payload.commentaire
    dossier.statut_proposition = "propose_par_locataire"
    dossier.proposition_count = (dossier.proposition_count or 0) + 1
    dossier.last_proposed_at = datetime.now(UTC)
    dossier.last_proposed_by = "locataire"

    await _commit_or_raise(db, "re-contre-proposition locataire")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def refuser_proposition(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    payload: RefuserPropositionRequest,
    current_user: User,
) -> PropositionStatusResponse:
    """Refus par l'un ou l'autre. Le motif est optionnel mais visible des deux
    côtés (§B.10 — pas de refus opaque)."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_locataire or is_bailleur or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seules les parties au dossier peuvent refuser la proposition",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("propose_par_locataire", "contre_propose_par_bailleur"),
        action_label="refuser",
    )

    dossier.statut_proposition = "refuse"
    dossier.motif_refus = payload.motif_refus
    await _commit_or_raise(db, "refus")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def reset_proposition(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    current_user: User,
) -> PropositionStatusResponse:
    """Locataire relance un nouveau cycle après refus. Reset complet :
    statut → non_propose, count → 0, contre-proposition + motif effacés.
    Les préférences saisies sont conservées (l'utilisateur peut re-proposer
    sans tout re-saisir)."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    if not (is_locataire or is_super_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seul le locataire peut relancer une nouvelle proposition",
        )

    dossier = await _get_or_create_dossier(db, locataire_id)
    _assert_transition_allowed(
        current_statut=dossier.statut_proposition,
        expected=("refuse",),
        action_label="reset",
    )

    dossier.statut_proposition = "non_propose"
    dossier.proposition_count = 0
    dossier.date_contre_proposee_bailleur = None
    dossier.commentaire_bailleur = None
    dossier.motif_refus = None
    dossier.date_accord = None
    dossier.last_proposed_at = None
    dossier.last_proposed_by = None
    # On conserve : date_entree_souhaitee, duree_envisagee, preferences,
    # commentaire_locataire (le locataire peut les ré-utiliser pour proposer
    # une nouvelle fois sans tout re-saisir).

    await _commit_or_raise(db, "reset")
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


async def get_proposition_status(
    db: AsyncSession,
    locataire_id: uuid.UUID,
    current_user: User,
) -> PropositionStatusResponse:
    """GET /locataires/{id}/proposition — état + flags computed pour l'UI."""
    _loc, _bien, is_locataire, is_bailleur, is_super_admin = await _resolve_parties(
        db, locataire_id, current_user
    )
    dossier = await _get_or_create_dossier(db, locataire_id)
    return _build_status_response(
        locataire_id, dossier, is_locataire, is_bailleur, is_super_admin
    )


# ── Commit helper (§B.12 — rollback symétrique) ───────────────────────────────


async def _commit_or_raise(db: AsyncSession, action_label: str) -> None:
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Erreur persistance ({action_label}) : {exc!s:.200}",
        ) from exc
