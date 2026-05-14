"""Orchestrateur signature 5 docs Sprint 10 (Lot 2).

Façade unique pour les 5 types de documents signables :
  - Bail            (Contract)
  - Avenant         (Avenant)
  - Résiliation     (Resiliation)
  - Mandat gestion  (MandatGestion)
  - EDL + convention sortie (changements_locataire.edl_entree/edl_sortie/
                              convention_sortie)

Pipeline standard (chaque `send_*_to_skribble`) :
  1. Charge l'entité depuis DB.
  2. Idempotence : si `skribble_session_id` non-NULL → retourne le session_id existant.
  3. Génère le PDF draft via le service PDF correspondant (Lot 3 — stubs Lot 1.5
     retournent un placeholder b"%PDF-1.4..." pour permettre Lot 2 de coder).
  4. Upload draft Supabase bucket signable-documents.
  5. Détermine signataires selon type (Sunimmo policy Sprint 10) :
       Bail        : [locataire, agence_mandataire]
       Avenant     : [locataire, agence_mandataire]
       Résiliation : [initiateur seul]
       Mandat      : [mandant, agence]
       EDL         : [locataire, agence_mandataire]
  6. SkribbleClient.create_signature_request().
  7. MAJ row : skribble_session_id + skribble_status='pending_signatures' +
     status='pending_signatures' + draft_pdf_url (si applicable).
  8. **Ne commit pas** — l'appelant (router) gère la transaction.

Doctrine §B.10 : si Skribble down → propage SkribbleAPIError (router → 502).
Doctrine §B.15 : pas de side-effect financier sur mandat (commission_pct_*
                  reste data pure).
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.core.config import settings
from app.models.avenant import Avenant
from app.models.bien import Bien
from app.models.contract import Contract
from app.models.locataire import Locataire
from app.models.mandat_gestion import MandatGestion
from app.models.resiliation import Resiliation
from app.models.user import User
from app.services.skribble_service import (
    SkribbleClientError,
    SkribbleSigner,
    get_skribble_client,
)
from app.services.storage import upload_pdf
from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("althy.signature_orchestrator")


# ── Helpers ──────────────────────────────────────────────────────────────────


def _frontend_url(path: str) -> str:
    base = (settings.SKRIBBLE_RETURN_URL_BASE or settings.FRONTEND_URL).rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def _webhook_url() -> str:
    if settings.SKRIBBLE_WEBHOOK_URL:
        return settings.SKRIBBLE_WEBHOOK_URL
    # Construit depuis FRONTEND_URL (ou env API_URL si défini un jour).
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/api/v1/webhooks/skribble"


async def _user_to_signer(db: AsyncSession, user_id: uuid.UUID, lang: str = "fr") -> SkribbleSigner:
    user = await db.get(User, user_id)
    if user is None:
        raise SkribbleClientError(f"User {user_id} introuvable pour signataire")
    if not user.email:
        raise SkribbleClientError(f"User {user_id} sans email — impossible de signer")
    return SkribbleSigner(
        email_address=user.email,
        first_name=user.first_name or "",
        last_name=user.last_name or user.email.split("@")[0],
        language=lang,
        mobile_number=user.phone if user.phone else None,
    )


def _bucket() -> str:
    return settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS


def _check_enabled() -> None:
    if not settings.SKRIBBLE_ENABLED:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Skribble désactivé — utiliser Plan B (Sprint 8 sign + countersign)",
        )


# ── Send: Contract (bail) ────────────────────────────────────────────────────


async def send_contract_to_skribble(
    db: AsyncSession, contract_id: uuid.UUID
) -> dict[str, Any]:
    """Envoie un bail (Contract) en signature Skribble — locataire + agence."""
    _check_enabled()

    contract = await db.get(Contract, contract_id)
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract introuvable")

    # Idempotence
    if contract.skribble_session_id:
        logger.info(
            "send_contract_to_skribble: idempotent skip contract=%s session=%s",
            contract_id, contract.skribble_session_id,
        )
        return {
            "id": contract.skribble_session_id,
            "status": contract.skribble_status or "pending_signatures",
            "idempotent": True,
        }

    if contract.tenant_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Contract sans tenant_id — impossible d'envoyer en signature",
        )
    if contract.agency_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Contract sans agency_id (mandat de gestion absent) — impossible d'envoyer en signature",
        )

    from app.services.pdf_bail_service import generate_bail_pdf

    pdf_bytes = await generate_bail_pdf(contract_id, contract.template_type)

    # Upload draft
    key = await upload_pdf(
        user_id=str(contract.owner_id),
        bien_id=str(contract.bien_id),
        doc_type="bail-draft",
        mois=contract.reference,
        pdf_bytes=pdf_bytes,
        bucket=_bucket(),
    )

    # Signers : locataire + agence-mandataire
    signers = [
        await _user_to_signer(db, contract.tenant_id),
        await _user_to_signer(db, contract.agency_id),
    ]

    client = get_skribble_client()
    skribble_resp = await client.create_signature_request(
        document_pdf_bytes=pdf_bytes,
        document_filename=f"Bail-{contract.reference}.pdf",
        title=f"Bail {contract.reference}",
        signers=signers,
        quality=settings.SKRIBBLE_DEFAULT_QUALITY,
        callback_success_url=_frontend_url(f"/app/contracts/{contract_id}?signed=ok"),
        callback_error_url=_frontend_url(f"/app/contracts/{contract_id}?signed=err"),
        webhook_url=_webhook_url(),
    )

    contract.skribble_session_id = skribble_resp.get("id")
    contract.skribble_status = "pending_signatures"
    contract.skribble_signer_role_required = ["locataire", "agence_mandataire"]
    contract.status = "draft"  # reste draft tant que pas signé
    return skribble_resp


# ── Send: Avenant ────────────────────────────────────────────────────────────


async def send_avenant_to_skribble(
    db: AsyncSession, avenant_id: uuid.UUID
) -> dict[str, Any]:
    _check_enabled()
    avenant = await db.get(Avenant, avenant_id)
    if avenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avenant introuvable")

    if avenant.skribble_session_id:
        return {
            "id": avenant.skribble_session_id,
            "status": avenant.skribble_status or "pending_signatures",
            "idempotent": True,
        }

    contract = await db.get(Contract, avenant.contract_id)
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract parent introuvable")
    if contract.tenant_id is None or contract.agency_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Contract sans tenant_id ou agency_id — impossible d'envoyer avenant",
        )

    from app.services.pdf_avenant_service import generate_avenant_pdf

    pdf_bytes = await generate_avenant_pdf(avenant_id)

    key = await upload_pdf(
        user_id=str(contract.owner_id),
        bien_id=str(contract.bien_id),
        doc_type="avenant-draft",
        mois=avenant.reference,
        pdf_bytes=pdf_bytes,
        bucket=_bucket(),
    )

    signers = [
        await _user_to_signer(db, contract.tenant_id),
        await _user_to_signer(db, contract.agency_id),
    ]

    client = get_skribble_client()
    skribble_resp = await client.create_signature_request(
        document_pdf_bytes=pdf_bytes,
        document_filename=f"Avenant-{avenant.reference}.pdf",
        title=f"Avenant {avenant.reference} — {avenant.avenant_type}",
        signers=signers,
        quality=settings.SKRIBBLE_DEFAULT_QUALITY,
        callback_success_url=_frontend_url(f"/app/avenants/{avenant_id}?signed=ok"),
        callback_error_url=_frontend_url(f"/app/avenants/{avenant_id}?signed=err"),
        webhook_url=_webhook_url(),
    )

    avenant.skribble_session_id = skribble_resp.get("id")
    avenant.skribble_status = "pending_signatures"
    avenant.status = "pending_signatures"
    avenant.draft_pdf_url = key
    return skribble_resp


# ── Send: Résiliation ────────────────────────────────────────────────────────


async def send_resiliation_to_skribble(
    db: AsyncSession, resiliation_id: uuid.UUID
) -> dict[str, Any]:
    """Résiliation : un seul signataire (l'initiateur).

    Si initiateur=locataire → tenant_id signe.
    Si initiateur=bailleur → contract.owner_id signe.
    Si initiateur=agence_mandataire → contract.agency_id signe.
    """
    _check_enabled()
    resiliation = await db.get(Resiliation, resiliation_id)
    if resiliation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résiliation introuvable")

    if resiliation.skribble_session_id:
        return {
            "id": resiliation.skribble_session_id,
            "status": resiliation.skribble_status or "pending_signatures",
            "idempotent": True,
        }

    contract = await db.get(Contract, resiliation.contract_id)
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract parent introuvable")

    # Détermination signataire unique selon initiateur
    if resiliation.initiateur == "locataire":
        signer_user_id = contract.tenant_id
    elif resiliation.initiateur == "bailleur":
        signer_user_id = contract.owner_id
    elif resiliation.initiateur == "agence_mandataire":
        signer_user_id = contract.agency_id
    else:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Initiateur invalide: {resiliation.initiateur}",
        )

    if signer_user_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Contract sans user pour initiateur={resiliation.initiateur}",
        )

    from app.services.pdf_resiliation_service import generate_resiliation_pdf

    pdf_bytes = await generate_resiliation_pdf(resiliation_id)

    key = await upload_pdf(
        user_id=str(contract.owner_id),
        bien_id=str(contract.bien_id),
        doc_type="resiliation-draft",
        mois=resiliation.reference,
        pdf_bytes=pdf_bytes,
        bucket=_bucket(),
    )

    signers = [await _user_to_signer(db, signer_user_id)]

    client = get_skribble_client()
    skribble_resp = await client.create_signature_request(
        document_pdf_bytes=pdf_bytes,
        document_filename=f"Resiliation-{resiliation.reference}.pdf",
        title=f"Résiliation {resiliation.reference}",
        signers=signers,
        quality=settings.SKRIBBLE_DEFAULT_QUALITY,
        callback_success_url=_frontend_url(f"/app/resiliations/{resiliation_id}?signed=ok"),
        callback_error_url=_frontend_url(f"/app/resiliations/{resiliation_id}?signed=err"),
        webhook_url=_webhook_url(),
    )

    resiliation.skribble_session_id = skribble_resp.get("id")
    resiliation.skribble_status = "pending_signatures"
    resiliation.status = "pending_signatures"
    resiliation.draft_pdf_url = key
    return skribble_resp


# ── Send: Mandat de gestion ──────────────────────────────────────────────────


async def send_mandat_to_skribble(
    db: AsyncSession, mandat_id: uuid.UUID
) -> dict[str, Any]:
    """Mandat de gestion : mandant (propriétaire) + agence signent.

    §2.4.16 : commission_pct_* du mandat sont DATA pure pour le PDF — pas de
    side-effect financier (pas de Stripe Connect, pas de prélèvement).
    """
    _check_enabled()
    mandat = await db.get(MandatGestion, mandat_id)
    if mandat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mandat introuvable")

    if mandat.skribble_session_id:
        return {
            "id": mandat.skribble_session_id,
            "status": mandat.skribble_status or "pending_signatures",
            "idempotent": True,
        }

    from app.services.pdf_mandat_service import generate_mandat_pdf

    pdf_bytes = await generate_mandat_pdf(mandat_id)

    bien_id_for_path = str(mandat.bien_id) if mandat.bien_id else "global"
    key = await upload_pdf(
        user_id=str(mandat.mandant_id),
        bien_id=bien_id_for_path,
        doc_type="mandat-draft",
        mois=mandat.reference,
        pdf_bytes=pdf_bytes,
        bucket=_bucket(),
    )

    signers = [
        await _user_to_signer(db, mandat.mandant_id),
        await _user_to_signer(db, mandat.agence_id),
    ]

    client = get_skribble_client()
    skribble_resp = await client.create_signature_request(
        document_pdf_bytes=pdf_bytes,
        document_filename=f"Mandat-{mandat.reference}.pdf",
        title=f"Mandat de gestion {mandat.reference}",
        signers=signers,
        quality=settings.SKRIBBLE_DEFAULT_QUALITY,
        callback_success_url=_frontend_url(f"/app/mandats/{mandat_id}?signed=ok"),
        callback_error_url=_frontend_url(f"/app/mandats/{mandat_id}?signed=err"),
        webhook_url=_webhook_url(),
    )

    mandat.skribble_session_id = skribble_resp.get("id")
    mandat.skribble_status = "pending_signatures"
    mandat.status = "pending_signatures"
    return skribble_resp


# ── Send: EDL ────────────────────────────────────────────────────────────────


async def send_edl_to_skribble(
    db: AsyncSession, changement_id: uuid.UUID, phase: str
) -> dict[str, Any]:
    """Envoi EDL en signature. phase ∈ {entree, sortie, convention}.

    Pas de modèle SQLAlchemy pour `changements_locataire` — on utilise du SQL
    brut (cf services/pdf_edl_service.py qui suit le même pattern).

    Signataires : locataire actif sur le bien + agence du contrat actif.
    """
    _check_enabled()
    if phase not in {"entree", "sortie", "convention"}:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"phase doit être entree|sortie|convention, reçu: {phase}",
        )

    row = (
        await db.execute(
            text("""
                SELECT cl.id, cl.bien_id,
                       cl.edl_entree, cl.edl_sortie, cl.convention_sortie,
                       b.owner_id
                FROM changements_locataire cl
                JOIN biens b ON b.id = cl.bien_id
                WHERE cl.id = :cid
            """),
            {"cid": str(changement_id)},
        )
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Changement locataire introuvable")

    # Locataire actif sur ce bien
    locataire = (
        await db.execute(
            select(Locataire).where(
                Locataire.bien_id == row.bien_id,
                Locataire.statut == "actif",
            )
        )
    ).scalar_one_or_none()
    if locataire is None or locataire.user_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Pas de locataire actif lié à ce bien — impossible d'envoyer EDL",
        )

    # Contract actif pour récupérer agency_id
    contract = await db.get(Contract, locataire.current_contract_id) if locataire.current_contract_id else None
    if contract is None or contract.agency_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Pas de contrat actif avec agency_id — impossible d'envoyer EDL",
        )

    if phase == "convention":
        from app.services.pdf_convention_sortie_service import generate_convention_sortie_pdf

        pdf_bytes = await generate_convention_sortie_pdf(changement_id)
        doc_type = "convention-sortie-draft"
        title = f"Convention de sortie {changement_id}"
    else:
        from app.services.pdf_edl_service import render_edl_pdf

        pdf_bytes = await render_edl_pdf(db, str(changement_id), phase)
        doc_type = f"edl-{phase}-draft"
        title = f"État des lieux ({phase}) {changement_id}"

    key = await upload_pdf(
        user_id=str(row.owner_id),
        bien_id=str(row.bien_id),
        doc_type=doc_type,
        mois=str(changement_id)[:8],
        pdf_bytes=pdf_bytes,
        bucket=_bucket(),
    )

    signers = [
        await _user_to_signer(db, locataire.user_id),
        await _user_to_signer(db, contract.agency_id),
    ]

    client = get_skribble_client()
    skribble_resp = await client.create_signature_request(
        document_pdf_bytes=pdf_bytes,
        document_filename=f"{doc_type}-{changement_id}.pdf",
        title=title,
        signers=signers,
        quality=settings.SKRIBBLE_DEFAULT_QUALITY,
        callback_success_url=_frontend_url(f"/app/changements/{changement_id}?signed=ok"),
        callback_error_url=_frontend_url(f"/app/changements/{changement_id}?signed=err"),
        webhook_url=_webhook_url(),
    )

    # Stocke le session_id dans le JSONB du changement (pas de col dédiée
    # — l'app pourra suivre l'état via le webhook qui muta convention_sortie).
    # Pour les EDL entrée/sortie, on stocke aussi dans le JSONB respectif.
    skribble_session_id = skribble_resp.get("id")
    if phase == "convention":
        convention = row.convention_sortie or {}
        convention["skribble_session_id"] = skribble_session_id
        convention["skribble_status"] = "pending_signatures"
        await db.execute(
            text(
                "UPDATE changements_locataire SET convention_sortie = :v "
                "WHERE id = :cid"
            ),
            {
                "v": __import__("json").dumps(convention),
                "cid": str(changement_id),
            },
        )
    else:
        # JSONB existant (edl_entree ou edl_sortie) — on ajoute la trace
        col = f"edl_{phase}"
        existing = row.edl_entree if phase == "entree" else row.edl_sortie
        existing = existing or {}
        existing["skribble_session_id"] = skribble_session_id
        existing["skribble_status"] = "pending_signatures"
        await db.execute(
            text(f"UPDATE changements_locataire SET {col} = :v WHERE id = :cid"),
            {
                "v": __import__("json").dumps(existing),
                "cid": str(changement_id),
            },
        )

    return skribble_resp
