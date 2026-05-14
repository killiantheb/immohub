from __future__ import annotations

from datetime import date
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bien import Bien
from app.models.notification import Notification
from app.models.paiement import Paiement
from app.models.user import User
from app.schemas.transaction import AgencyDashboard, OwnerDashboard
from app.services.transaction_service import TransactionService
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]


# ── KPI endpoints (existing) ──────────────────────────────────────────────────


@router.get("/owner", response_model=OwnerDashboard, summary="KPIs propriétaire")
async def owner_dashboard(current_user: AuthUserDep, db: DbDep) -> OwnerDashboard:
    """Revenue, occupancy rate, pending/late rents for the current owner."""
    return await TransactionService(db).owner_dashboard(current_user=current_user)


@router.get("/agency", response_model=AgencyDashboard, summary="KPIs agence")
async def agency_dashboard(current_user: AuthUserDep, db: DbDep) -> AgencyDashboard:
    """Portfolio stats, YTD revenue and commissions for an agency user."""
    return await TransactionService(db).agency_dashboard(current_user=current_user)


# ── Briefing IA ───────────────────────────────────────────────────────────────


class BriefingResponse(BaseModel):
    titre: str
    message: str
    date: str
    is_today: bool


@router.get("/briefing", response_model=BriefingResponse, summary="Briefing IA du jour")
async def get_briefing(current_user: AuthUserDep, db: DbDep) -> BriefingResponse:
    """
    Return today's AI briefing stored by the Celery task.
    Falls back to a placeholder if not yet generated.
    """
    result = await db.execute(
        select(Notification)
        .where(
            and_(
                Notification.user_id == current_user.id,
                Notification.type == "briefing_quotidien",
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(1)
    )
    notif = result.scalar_one_or_none()
    today = date.today().isoformat()

    if not notif:
        return BriefingResponse(
            titre=f"Briefing du {date.today().strftime('%d/%m/%Y')}",
            message="Votre briefing personnalisé sera généré automatiquement à 07h00.",
            date=today,
            is_today=False,
        )

    notif_date = notif.created_at.date().isoformat() if notif.created_at else ""
    return BriefingResponse(
        titre=notif.titre,
        message=notif.message,
        date=notif_date,
        is_today=(notif_date == today),
    )


# ── Économies vs régie ────────────────────────────────────────────────────────


class SavingsResponse(BaseModel):
    saved_this_month: float  # CHF saved vs typical régie commission
    saved_ytd: float         # Year-to-date savings
    nb_biens: int
    loyers_mois: float       # Total rents received this month
    regie_rate: float        # Régie commission rate used (8 %)


@router.get("/savings", response_model=SavingsResponse, summary="Économies vs régie")
async def get_savings(current_user: AuthUserDep, db: DbDep) -> SavingsResponse:
    """
    Compute how much the user saved vs a traditional régie this month.
    Formula: rents_received * 8% + CHF 75/bien admin fee.
    """
    today = date.today()
    mois_courant = today.strftime("%Y-%m")

    # Count user's biens
    biens_res = await db.execute(
        select(Bien.id).where(Bien.owner_id == current_user.id)
    )
    bien_ids = [r[0] for r in biens_res.fetchall()]
    nb_biens = len(bien_ids)

    # Sum loyers reçus this month
    loyers_mois = 0.0
    if bien_ids:
        paiements_res = await db.execute(
            select(Paiement).where(
                and_(
                    Paiement.bien_id.in_(bien_ids),
                    Paiement.statut == "recu",
                    Paiement.mois == mois_courant,
                )
            )
        )
        loyers_mois = sum(float(p.montant) for p in paiements_res.scalars().all())

    REGIE_RATE = 0.08  # 8 % commission régie typique en Suisse
    ADMIN_FEE_PER_BIEN = 75.0  # CHF/bien/mois frais administratifs

    commission_regie = loyers_mois * REGIE_RATE
    frais_admin = nb_biens * ADMIN_FEE_PER_BIEN
    saved_this_month = round(commission_regie + frais_admin, 0)

    # YTD: scale by months elapsed (Jan = 1 month)
    saved_ytd = round(saved_this_month * today.month, 0)

    return SavingsResponse(
        saved_this_month=saved_this_month,
        saved_ytd=saved_ytd,
        nb_biens=nb_biens,
        loyers_mois=loyers_mois,
        regie_rate=REGIE_RATE,
    )


# ── /summary — agrégation dashboard Sprint 9 Lot D ───────────────────────────
# Source de vérité = table loyer_transactions (cf §B.13 Sprint 8 Lot B).
# RBAC strict : filtre owner_id = current_user.id pour proprio_solo ;
# super_admin voit tout (pour audit prod). Phase 1.0 = scope proprio_solo
# + super_admin (cf §B.7 + §B.15).


class DashboardHistoriqueMois(BaseModel):
    mois: str           # "YYYY-MM"
    attendu: float      # CHF total attendu sur le mois (montant_total)
    recu: float         # CHF total dont statut IN ('recu', 'reverse')


class DashboardBienApercu(BaseModel):
    id: str
    titre: str          # `titre` du bien si présent, fallback "<type> à <ville>"
    adresse: str        # "<adresse>, <ville>"
    statut: str         # 'loue' | 'vacant' | 'en_vente' | ...
    loyer: float | None  # loyer mensuel CHF du bien (peut être null si non saisi)


class DashboardSummaryResponse(BaseModel):
    biens_count: int
    loyers_mois_attendu: float
    loyers_mois_recu: float
    loyers_recu_pct: int  # 0..100 — 0 si attendu == 0 (pas "100%" mensonger §B.10)
    historique_6_mois: list[DashboardHistoriqueMois]
    biens_apercu: list[DashboardBienApercu]


def _previous_month_first(d: date, n: int) -> date:
    """Retourne le 1er du mois (d - n mois). n=0 => 1er du mois courant."""
    year, month = d.year, d.month - n
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    summary="Agrégat dashboard (biens + loyers du mois + 6 mois + aperçu biens)",
)
async def get_dashboard_summary(
    current_user: AuthUserDep,
    db: DbDep,
) -> DashboardSummaryResponse:
    """Agrégat consolidé pour le dashboard manager (proprio_solo / super_admin).

    Source loyers : table `loyer_transactions` (cf §B.13, jamais `transactions`).
    Toutes les requêtes filtrent owner_id = current_user.id (RBAC strict).
    Super_admin contourne le filtre pour audit prod.

    Empty states honnêtes (§B.10/§B.11) :
    - aucun loyer attendu → loyers_mois_attendu = 0, loyers_recu_pct = 0
    - aucun bien → biens_count = 0, biens_apercu = []
    """
    is_admin = current_user.role == "super_admin"
    owner_filter = "" if is_admin else "AND owner_id = :uid"
    params: dict = {} if is_admin else {"uid": str(current_user.id)}

    today = date.today()
    mois_courant_first = today.replace(day=1)
    debut_6_mois = _previous_month_first(mois_courant_first, 5)  # 6 mois inclus

    # ── 1) Compte biens (is_active=true, RBAC) ─────────────────────────────────
    biens_count_q = await db.execute(
        text(
            f"SELECT COUNT(*) AS n FROM biens "
            f"WHERE is_active = true {owner_filter}"
        ),
        params,
    )
    biens_count = int(biens_count_q.scalar() or 0)

    # ── 2) Loyers du mois courant — attendu + reçu ─────────────────────────────
    mois_q = await db.execute(
        text(
            f"""
            SELECT
              COALESCE(SUM(montant_total), 0)::float AS attendu,
              COALESCE(SUM(CASE WHEN statut IN ('recu', 'reverse')
                                 THEN montant_total ELSE 0 END), 0)::float AS recu
            FROM loyer_transactions
            WHERE mois_concerne = :mois
              {owner_filter}
            """
        ),
        {**params, "mois": mois_courant_first},
    )
    mois_row = mois_q.mappings().one()
    loyers_attendu = float(mois_row["attendu"])
    loyers_recu = float(mois_row["recu"])
    loyers_pct = int(round((loyers_recu / loyers_attendu) * 100)) if loyers_attendu > 0 else 0

    # ── 3) Historique 6 mois (attendu + reçu groupés) ──────────────────────────
    hist_q = await db.execute(
        text(
            f"""
            SELECT
              mois_concerne,
              COALESCE(SUM(montant_total), 0)::float AS attendu,
              COALESCE(SUM(CASE WHEN statut IN ('recu', 'reverse')
                                 THEN montant_total ELSE 0 END), 0)::float AS recu
            FROM loyer_transactions
            WHERE mois_concerne >= :debut
              AND mois_concerne <= :fin
              {owner_filter}
            GROUP BY mois_concerne
            """
        ),
        {**params, "debut": debut_6_mois, "fin": mois_courant_first},
    )
    by_mois: dict[str, dict[str, float]] = {}
    for row in hist_q.mappings().all():
        key = row["mois_concerne"].strftime("%Y-%m")
        by_mois[key] = {"attendu": float(row["attendu"]), "recu": float(row["recu"])}

    historique: list[DashboardHistoriqueMois] = []
    for i in range(5, -1, -1):
        m = _previous_month_first(mois_courant_first, i)
        key = m.strftime("%Y-%m")
        entry = by_mois.get(key, {"attendu": 0.0, "recu": 0.0})
        historique.append(
            DashboardHistoriqueMois(
                mois=key,
                attendu=entry["attendu"],
                recu=entry["recu"],
            )
        )

    # ── 4) Aperçu biens (5 premiers, ordre récent) ─────────────────────────────
    biens_q = await db.execute(
        text(
            f"""
            SELECT id, titre, type, adresse, ville, statut, loyer
            FROM biens
            WHERE is_active = true {owner_filter}
            ORDER BY created_at DESC
            LIMIT 5
            """
        ),
        params,
    )
    biens_apercu: list[DashboardBienApercu] = []
    for row in biens_q.mappings().all():
        titre = row["titre"] or f"{(row['type'] or 'Bien').capitalize()} à {row['ville']}"
        adresse = f"{row['adresse']}, {row['ville']}"
        loyer_val = float(row["loyer"]) if row["loyer"] is not None else None
        biens_apercu.append(
            DashboardBienApercu(
                id=str(row["id"]),
                titre=titre,
                adresse=adresse,
                statut=row["statut"],
                loyer=loyer_val,
            )
        )

    return DashboardSummaryResponse(
        biens_count=biens_count,
        loyers_mois_attendu=loyers_attendu,
        loyers_mois_recu=loyers_recu,
        loyers_recu_pct=loyers_pct,
        historique_6_mois=historique,
        biens_apercu=biens_apercu,
    )
