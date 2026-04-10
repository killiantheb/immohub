"""Notations — /api/v1/notations

POST /notations/                          Dépose une note après vérification d'interaction réelle
GET  /notations/profil/{acteur_id}        Profil public d'un acteur (stats + 5 derniers avis + spécialités)
GET  /notations/classement                Top acteurs filtrables par role/canton/spécialité
"""

from __future__ import annotations

import uuid as _uuid
from typing import Annotated

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/notations", tags=["notations"])

DbDep      = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]

_VALID_ROLES     = {"artisan", "opener", "agence", "proprio", "locataire", "hunter", "expert"}
_VALID_CONTEXTES = {"intervention", "mission", "location", "vente", "livraison", "expertise"}

_ROLE_MAP = {
    "artisan":         "artisan",
    "opener":          "opener",
    "agence":          "agence",
    "agency":          "agence",
    "proprio_solo":    "proprio",
    "owner":           "proprio",
    "portail_proprio": "proprio",
    "locataire":       "locataire",
    "tenant":          "locataire",
    "hunter":          "hunter",
    "expert":          "expert",
}


# ── Payload models ────────────────────────────────────────────────────────────

class NotationCreate(BaseModel):
    acteur_id:    str
    acteur_role:  str | None = None
    contexte_type: str = "mission"
    contexte_id:  str | None = None
    score:        int = Field(..., ge=1, le=5)
    commentaire:  str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _resolve_acteur_role(db: AsyncSession, acteur_uuid: _uuid.UUID) -> str:
    """Resolve the notation role from the users table."""
    row = await db.execute(
        text("SELECT role FROM users WHERE id = :id"),
        {"id": acteur_uuid},
    )
    user_row = row.one_or_none()
    if not user_row:
        raise HTTPException(404, "Acteur introuvable")
    return _ROLE_MAP.get(user_row.role, "artisan")


async def _verify_interaction(
    db: AsyncSession,
    auteur_id: _uuid.UUID,
    acteur_uuid: _uuid.UUID,
    acteur_role: str,
    contexte_type: str,
    contexte_id: _uuid.UUID | None,
) -> bool:
    """
    Vérifie qu'il y a eu une interaction réelle entre auteur et acteur.
    Si contexte_id est fourni, on vérifie l'existence directe du contexte.
    Sinon on cherche dans les tables d'interactions selon le rôle.
    """
    # If a specific context is supplied, check its existence (most precise)
    if contexte_id is not None:
        if contexte_type == "intervention":
            row = await db.execute(
                text("""
                    SELECT 1 FROM interventions
                    WHERE id = :ctx_id
                      AND artisan_id = :acteur
                      AND (signale_par_id = :auteur
                           OR bien_id IN (SELECT id FROM biens WHERE owner_id = :auteur))
                    LIMIT 1
                """),
                {"ctx_id": contexte_id, "acteur": acteur_uuid, "auteur": auteur_id},
            )
            return row.one_or_none() is not None

        if contexte_type == "mission":
            row = await db.execute(
                text("""
                    SELECT 1 FROM missions_ouvreurs
                    WHERE id = :ctx_id
                      AND ouvreur_id = :acteur
                      AND (agence_id = :auteur
                           OR bien_id IN (SELECT id FROM biens WHERE owner_id = :auteur))
                    LIMIT 1
                """),
                {"ctx_id": contexte_id, "acteur": acteur_uuid, "auteur": auteur_id},
            )
            return row.one_or_none() is not None

        # For other context types accept as valid if row exists
        return True

    # No contexte_id — fuzzy check based on role
    if acteur_role == "artisan":
        row = await db.execute(
            text("""
                SELECT 1 FROM interventions
                WHERE artisan_id = :acteur
                  AND (signale_par_id = :auteur
                       OR bien_id IN (SELECT id FROM biens WHERE owner_id = :auteur))
                LIMIT 1
            """),
            {"acteur": acteur_uuid, "auteur": auteur_id},
        )
        return row.one_or_none() is not None

    if acteur_role == "opener":
        row = await db.execute(
            text("""
                SELECT 1 FROM missions_ouvreurs
                WHERE ouvreur_id = :acteur
                  AND (agence_id = :auteur
                       OR bien_id IN (SELECT id FROM biens WHERE owner_id = :auteur))
                LIMIT 1
            """),
            {"acteur": acteur_uuid, "auteur": auteur_id},
        )
        return row.one_or_none() is not None

    if acteur_role == "locataire":
        row = await db.execute(
            text("""
                SELECT 1 FROM locataires
                WHERE user_id = :acteur
                  AND bien_id IN (SELECT id FROM biens WHERE owner_id = :auteur)
                LIMIT 1
            """),
            {"acteur": acteur_uuid, "auteur": auteur_id},
        )
        return row.one_or_none() is not None

    # For other roles (agence, hunter, expert, proprio) allow if they share any document/contract
    row = await db.execute(
        text("""
            SELECT 1 FROM contracts
            WHERE (owner_id = :auteur AND tenant_id = :acteur)
               OR (owner_id = :acteur AND tenant_id = :auteur)
            LIMIT 1
        """),
        {"auteur": auteur_id, "acteur": acteur_uuid},
    )
    return row.one_or_none() is not None


async def _get_moyenne(db: AsyncSession, acteur_uuid: _uuid.UUID) -> float:
    row = await db.execute(
        text("SELECT note_moyenne FROM notation_stats WHERE acteur_id = :id"),
        {"id": acteur_uuid},
    )
    r = row.one_or_none()
    return round(float(r.note_moyenne), 2) if r else 0.0


# ── POST /notations/ ──────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_notation(
    payload: NotationCreate,
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """
    Dépose une notation sur un acteur après vérification d'une interaction réelle.
    Le trigger DB (trg_update_notation_stats) recalcule notation_stats automatiquement.
    Retourne { success, nouvelle_moyenne }.
    """
    try:
        acteur_uuid = _uuid.UUID(payload.acteur_id)
    except ValueError:
        raise HTTPException(422, "acteur_id invalide")

    if acteur_uuid == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vous ne pouvez pas vous noter vous-même")

    contexte_id_val: _uuid.UUID | None = None
    if payload.contexte_id:
        try:
            contexte_id_val = _uuid.UUID(payload.contexte_id)
        except ValueError:
            raise HTTPException(422, "contexte_id invalide")

    # Resolve acteur role
    acteur_role = payload.acteur_role
    if not acteur_role:
        acteur_role = await _resolve_acteur_role(db, acteur_uuid)
    if acteur_role not in _VALID_ROLES:
        acteur_role = "artisan"

    contexte_type = payload.contexte_type if payload.contexte_type in _VALID_CONTEXTES else "mission"

    # Verify real interaction
    has_interaction = await _verify_interaction(
        db, current_user.id, acteur_uuid, acteur_role, contexte_type, contexte_id_val
    )
    if not has_interaction:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Aucune interaction réelle trouvée avec cet acteur. "
            "Vous ne pouvez noter que des acteurs avec lesquels vous avez travaillé.",
        )

    notation_id = _uuid.uuid4()
    try:
        await db.execute(
            text("""
                INSERT INTO notations
                    (id, auteur_id, acteur_id, acteur_role, contexte_type, contexte_id, score, commentaire)
                VALUES
                    (:id, :auteur, :acteur, :acteur_role, :ctx_type, :ctx_id, :score, :commentaire)
            """),
            {
                "id":           notation_id,
                "auteur":       current_user.id,
                "acteur":       acteur_uuid,
                "acteur_role":  acteur_role,
                "ctx_type":     contexte_type,
                "ctx_id":       contexte_id_val,
                "score":        payload.score,
                "commentaire":  payload.commentaire,
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        err = str(exc)
        if "unique" in err.lower() or "duplicate" in err.lower():
            raise HTTPException(status.HTTP_409_CONFLICT, "Vous avez déjà noté cette interaction")
        raise HTTPException(500, f"Erreur lors de la notation : {exc}")

    # Trigger has already updated notation_stats — read the new moyenne
    nouvelle_moyenne = await _get_moyenne(db, acteur_uuid)

    return {
        "success":          True,
        "notation_id":      str(notation_id),
        "nouvelle_moyenne": nouvelle_moyenne,
    }


# ── GET /notations/profil/{acteur_id} ─────────────────────────────────────────

@router.get("/profil/{acteur_id}")
async def get_profil_notation(
    acteur_id: str,
    db: DbDep,
) -> dict:
    """
    Profil public de notation d'un acteur.
    Retourne note_moyenne, nombre_notes, 5 derniers avis et spécialités (artisans).
    """
    try:
        uid = _uuid.UUID(acteur_id)
    except ValueError:
        raise HTTPException(422, "acteur_id invalide")

    # Aggregate stats
    stats_row = await db.execute(
        text("SELECT note_moyenne, nombre_notes, derniere_note_at FROM notation_stats WHERE acteur_id = :id"),
        {"id": uid},
    )
    stats = stats_row.one_or_none()

    # Last 5 reviews with auteur first name (anonymised to initials)
    reviews_row = await db.execute(
        text("""
            SELECT n.score, n.commentaire, n.created_at,
                   LEFT(u.prenom, 1) || '.' AS auteur_initiale
            FROM notations n
            LEFT JOIN users u ON u.id = n.auteur_id
            WHERE n.acteur_id = :id
            ORDER BY n.created_at DESC
            LIMIT 5
        """),
        {"id": uid},
    )
    dernieres_notes = [
        {
            "score":          r.score,
            "commentaire":    r.commentaire,
            "created_at":     r.created_at.isoformat() if r.created_at else None,
            "auteur_initiale": r.auteur_initiale,
        }
        for r in reviews_row
    ]

    # Specialités (artisan only — gracefully empty for others)
    spec_row = await db.execute(
        text("SELECT specialites FROM profiles_artisans WHERE user_id = :id"),
        {"id": uid},
    )
    spec_r = spec_row.one_or_none()
    specialites: list[str] = list(spec_r.specialites or []) if spec_r and spec_r.specialites else []

    note_moyenne = round(float(stats.note_moyenne), 2) if stats else 0.0
    nombre_notes = int(stats.nombre_notes) if stats else 0

    return {
        "acteur_id":      acteur_id,
        "note_moyenne":   note_moyenne,
        "nombre_notes":   nombre_notes,
        "badge_verifie":  nombre_notes >= 10 and note_moyenne >= 4.5,
        "dernieres_notes": dernieres_notes,
        "specialites":    specialites,
    }


# ── GET /notations/classement ─────────────────────────────────────────────────

@router.get("/classement")
async def get_classement(
    db: DbDep,
    role:       str | None = Query(None, description="artisan | opener | agence | expert | hunter"),
    canton:     str | None = Query(None, description="Code canton CH, ex: GE, VD, VS"),
    specialite: str | None = Query(None, description="Spécialité artisan, ex: plomberie"),
    limit:      int        = Query(20, ge=1, le=100),
) -> list[dict]:
    """
    Classement des meilleurs acteurs — utilisé par la Sphère pour les recommandations.
    Filtrable par rôle, canton (biens du proprio) et spécialité artisan.
    """
    role_filter      = role      if role      in _VALID_ROLES else None
    specialite_lower = specialite.lower() if specialite else None

    params: dict = {"limit": limit}

    # Base query: join notation_stats + users + optional profiles_artisans
    where_clauses = ["ns.nombre_notes > 0"]
    if role_filter:
        where_clauses.append("u.role = :role")
        # Map notation role → DB role
        db_role = {
            "artisan": "artisan",
            "opener":  "opener",
            "agence":  "agence",
            "proprio": "proprio_solo",
            "locataire": "locataire",
            "hunter":  "hunter",
            "expert":  "expert",
        }.get(role_filter, role_filter)
        params["role"] = db_role

    if canton:
        # Filter by canton: artisans/ouvreurs active in that canton
        # We join via biens (canton column) where they have missions/interventions
        where_clauses.append("""
            (u.role NOT IN ('artisan', 'opener')
             OR EXISTS (
                SELECT 1 FROM biens b
                WHERE b.canton = :canton
                  AND (
                    EXISTS (SELECT 1 FROM interventions i WHERE i.bien_id = b.id AND i.artisan_id = u.id)
                    OR EXISTS (SELECT 1 FROM missions_ouvreurs m WHERE m.bien_id = b.id AND m.ouvreur_id = u.id)
                  )
             ))
        """)
        params["canton"] = canton.upper()

    if specialite_lower:
        # Filter artisans whose specialites array contains the term (case-insensitive)
        where_clauses.append("""
            EXISTS (
                SELECT 1 FROM profiles_artisans pa
                WHERE pa.user_id = u.id
                  AND EXISTS (
                    SELECT 1 FROM unnest(pa.specialites) s
                    WHERE lower(s) LIKE :spec_like
                  )
            )
        """)
        params["spec_like"] = f"%{specialite_lower}%"

    where_sql = " AND ".join(where_clauses)

    rows = await db.execute(
        text(f"""
            SELECT
                u.id,
                u.prenom,
                u.nom,
                u.role,
                u.photo_url,
                ns.note_moyenne,
                ns.nombre_notes,
                pa.specialites,
                pa.rayon_km,
                pa.assurance_rc,
                (ns.nombre_notes >= 10 AND ns.note_moyenne >= 4.5) AS badge_verifie
            FROM notation_stats ns
            JOIN users u ON u.id = ns.acteur_id
            LEFT JOIN profiles_artisans pa ON pa.user_id = u.id
            WHERE {where_sql}
            ORDER BY ns.note_moyenne DESC, ns.nombre_notes DESC
            LIMIT :limit
        """),
        params,
    )

    return [
        {
            "acteur_id":     str(r.id),
            "prenom":        r.prenom,
            "nom":           r.nom,
            "role":          r.role,
            "photo_url":     r.photo_url,
            "note_moyenne":  round(float(r.note_moyenne), 2),
            "nombre_notes":  int(r.nombre_notes),
            "badge_verifie": bool(r.badge_verifie),
            "specialites":   list(r.specialites or []) if r.specialites else [],
            "rayon_km":      r.rayon_km,
            "assurance_rc":  bool(r.assurance_rc) if r.assurance_rc is not None else False,
        }
        for r in rows
    ]
