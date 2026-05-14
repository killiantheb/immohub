from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.contract import Contract
from app.models.user import User
from app.schemas.contract import ContractCreate, ContractRead, ContractUpdate, PaginatedContracts
from app.services.contract_service import ContractService
from app.services.loyer_activation import activate_first_rent
from app.services.partner_hooks import on_contract_signed
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


def _client_ip(request: Request) -> str:
    """Récupère l'IP réelle (X-Forwarded-For prioritaire si proxy)."""
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("", response_model=PaginatedContracts)
async def list_contracts(
    current_user: AuthUserDep,
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    bien_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
) -> PaginatedContracts:
    return await ContractService(db).list(
        current_user=current_user,
        page=page,
        size=size,
        contract_status=status,
        bien_id=bien_id,
        tenant_id=tenant_id,
    )


@router.post("", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    if current_user.role not in ("proprio_solo", "agence", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    contract = await ContractService(db).create(payload, current_user=current_user)
    return ContractRead.model_validate(contract)


@router.get("/me", response_model=ContractRead | None)
async def get_my_contract(
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead | None:
    """Bail actif du locataire courant (Sprint 8 Lot A — appelé par
    /app/mon-bien côté locataire).

    Retourne `null` si aucun bail n'est encore rattaché à l'utilisateur.
    Sélection : le contrat actif (is_active=true) le plus récent dont
    `tenant_id == current_user.id`.
    """
    result = await db.execute(
        select(Contract)
        .where(
            Contract.tenant_id == current_user.id,
            Contract.is_active.is_(True),
        )
        .order_by(Contract.created_at.desc())
        .limit(1)
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        return None
    return ContractRead.model_validate(contract)


@router.get("/{contract_id}", response_model=ContractRead)
async def get_contract(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    contract = await ContractService(db).get(contract_id, current_user=current_user)
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contrat introuvable")
    return ContractRead.model_validate(contract)


@router.put("/{contract_id}", response_model=ContractRead)
async def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    contract = await ContractService(db).update(contract_id, payload, current_user=current_user)
    return ContractRead.model_validate(contract)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_contract(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    await ContractService(db).delete(contract_id, current_user=current_user)


@router.post("/{contract_id}/sign", response_model=ContractRead)
async def sign_contract(
    contract_id: str,
    request: Request,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    """Acceptation contractuelle bailleur — horodatage + IP (§B.10).

    Plan B SES renforcée (Sprint 8 Lot A). Phase 1.0 supporte deux flows
    parallèles de signature :
      - Plan A = Skribble SES (`POST /contracts/{id}/send-to-skribble`,
        Sprint 10) — actif quand `settings.SKRIBBLE_ENABLED=True`.
      - Plan B = acceptation horodatée renforcée (cet endpoint + countersign) —
        toujours utilisable comme fallback admin ou si Skribble KYC traîne.
    Cf doctrine 2026-05-14 docs/2-ROADMAP.md §2.4.16.

    Une fois le bailleur accepte, le bail reste « en attente de
    contre-signature » : le locataire doit appeler
    POST /contracts/{id}/countersign depuis /app/mon-bien pour activer le
    bail (status → active + 1re loyer_transaction).
    """
    client_ip = _client_ip(request)
    contract = await ContractService(db).sign(contract_id, ip=client_ip, current_user=current_user)
    # Partner hook P1 : propose assurance au propriétaire (best-effort, RGPD-gated).
    await on_contract_signed(db, contract)
    return ContractRead.model_validate(contract)


@router.post("/{contract_id}/countersign", response_model=ContractRead)
async def countersign_contract(
    contract_id: str,
    request: Request,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    """Contre-signature locataire — clôt le workflow d'acceptation à 2 parties.

    Sprint 8 Lot A — Plan B SES renforcée (cf doctrine 2026-05-14
    docs/2-ROADMAP.md §2.4.16). Doctrine :
      - §B.10 : « tenant_signed_at » est une acceptation horodatée + IP.
      - Plan A (Skribble SES Sprint 10) coexiste — quand
        `settings.SKRIBBLE_ENABLED=True`, le flow recommandé passe par
        `POST /contracts/{id}/send-to-skribble`. Plan B reste actif comme
        fallback admin (Skribble down, KYC en attente, signataire ne peut
        accéder au flow Skribble).

    Workflow :
      1. RBAC : seul `Contract.tenant_id == current_user.id` peut contre-signer.
      2. Pré-requis : le bailleur doit avoir signé (`signed_at IS NOT NULL`).
      3. Idempotence : 409 si `tenant_signed_at` est déjà posé.
      4. Pose `tenant_signed_at` + `tenant_signed_ip` + status=active.
      5. Hook `activate_first_rent` : crée la 1re loyer_transaction +
         lie `locataires.current_contract_id` → ce contrat (cf migration
         0049). Best-effort silencieux — l'absence de Locataire actif
         ou de loyer ne doit pas bloquer la contre-signature.
    """
    contract = await ContractService(db).get(contract_id, current_user=current_user)
    if contract is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bail introuvable")

    # RBAC strict : ni bailleur ni agence ne peuvent contre-signer à la place
    # du locataire (sinon l'acceptation perd toute valeur probante).
    if contract.tenant_id != current_user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Vous n'êtes pas le locataire de ce bail",
        )

    if not contract.signed_at:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Le bailleur n'a pas encore accepté ce bail",
        )

    if contract.tenant_signed_at:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Vous avez déjà contre-signé ce bail",
        )

    contract.tenant_signed_at = datetime.now(UTC)
    contract.tenant_signed_ip = _client_ip(request)
    contract.status = "active"

    # Activation loyer — même session, rollback cascadera si le commit foire.
    await activate_first_rent(db, contract)

    await db.flush()
    await db.refresh(contract)
    return ContractRead.model_validate(contract)


@router.get("/{contract_id}/pdf")
async def get_contract_pdf(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
):
    """Generate and stream the contract as a PDF."""
    return await ContractService(db).generate_pdf(contract_id, current_user=current_user)


@router.post("/{contract_id}/send-to-skribble", response_model=ContractRead)
async def send_contract_to_skribble_endpoint(
    contract_id: str,
    current_user: AuthUserDep,
    db: DbDep,
) -> ContractRead:
    """Plan A — envoi du bail en signature Skribble SES (Sprint 10).

    §2.4.16 doctrine : Skribble bascule Phase 1.0. Si
    `settings.SKRIBBLE_ENABLED=False`, retourne 503 et l'UI doit
    rediriger vers Plan B (POST /sign + /countersign Sprint 8).

    RBAC : `proprio_solo` (owner) | `agence` (mandataire) | `super_admin`.
    """
    import uuid as _uuid

    from app.services.signature_orchestrator import send_contract_to_skribble

    try:
        cid = _uuid.UUID(contract_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contrat introuvable")

    contract = await db.get(Contract, cid)
    if contract is None or not contract.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contrat introuvable")

    if current_user.role not in ("proprio_solo", "agence", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
    if current_user.role != "super_admin" and (
        contract.owner_id != current_user.id and contract.agency_id != current_user.id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    if contract.signed_at is not None or contract.tenant_signed_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bail déjà signé via Plan B Sprint 8 — utiliser le flux existant",
        )

    await send_contract_to_skribble(db, cid)
    await db.flush()
    await db.refresh(contract)
    return ContractRead.model_validate(contract)
