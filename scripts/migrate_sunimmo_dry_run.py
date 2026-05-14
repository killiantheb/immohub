"""Migration Sunimmo dry-run — Sprint 10 Lot 8.

Audit lecture seule des baux Sunimmo existants en prod pour identifier :
  - Baux orphelins (sans owner_id ou bien_id manquant)
  - Champs Sprint 10 manquants (template_type NULL, deposit_type non strict, etc.)
  - Conflits potentiels avec migration 0051 (deposit_type hors enum, etc.)
  - Mandats manquants (proprio sans MandatGestion vers Sunimmo)

Usage :
  cd backend && python ../scripts/migrate_sunimmo_dry_run.py [--agency-email cathy@sunimmo-riviera.ch]

Pas de mutation DB — output report markdown stdout uniquement.
§B.11 doctrine : pas d'écriture en prod sans validation Killian explicite.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(here, "backend"))


SUNIMMO_AGENCY_EMAIL_DEFAULT = "cathy@sunimmo-riviera.ch"
DEPOSIT_TYPE_VALID = ("gocaution", "caution_bancaire", "compte_epargne", "especes")
TEMPLATE_TYPE_VALID = (
    "sunimmo_annee", "sunimmo_saison", "sunimmo_nuitees",
    "sunimmo_commercial", "sunimmo_parc", "sunimmo_vaud",
)


async def main() -> int:
    print("# Sunimmo Migration Dry-Run — Sprint 10\n")
    print(f"_Generated : {datetime.now().isoformat()}_\n")

    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # 1. Sunimmo agency user lookup
        agency_email = os.environ.get("SUNIMMO_AGENCY_EMAIL", SUNIMMO_AGENCY_EMAIL_DEFAULT)
        print(f"## 1. Sunimmo agency user (`{agency_email}`)\n")
        row = (
            await db.execute(
                text("SELECT id, email, role, first_name, last_name FROM users WHERE email = :e"),
                {"e": agency_email},
            )
        ).one_or_none()
        if row is None:
            print(f"- ⚠️  **WARNING** : aucun user `{agency_email}` trouvé en DB.")
            print(f"- Action : provisionner manuellement le user Sunimmo `role='agence'`.")
            agency_id = None
        else:
            print(f"- ✓ User trouvé : `id={row.id}`, role=`{row.role}`")
            if row.role != "agence":
                print(f"- ⚠️  Role actuel `{row.role}` ≠ `agence` — corriger avant migration.")
            agency_id = row.id

        # 2. Baux existants
        print(f"\n## 2. Baux existants en DB (`contracts`)\n")
        baux_rows = (
            await db.execute(
                text("""
                    SELECT id, reference, owner_id, bien_id, tenant_id, agency_id,
                           status, deposit_type, template_type, monthly_rent,
                           signed_at, tenant_signed_at, skribble_session_id,
                           is_active, created_at
                    FROM contracts
                    WHERE is_active = TRUE
                    ORDER BY created_at DESC
                """)
            )
        ).all()

        print(f"- Total baux actifs : **{len(baux_rows)}**\n")

        if not baux_rows:
            print("- Aucun bail en DB. Migration n'a rien à faire — Sunimmo démarre fresh Phase 1.0.")
            return 0

        # Sub-audit categories
        sans_bien = [r for r in baux_rows if r.bien_id is None]
        sans_owner = [r for r in baux_rows if r.owner_id is None]
        sans_tenant = [r for r in baux_rows if r.tenant_id is None]
        deposit_type_hors_enum = [
            r for r in baux_rows
            if r.deposit_type is not None and r.deposit_type not in DEPOSIT_TYPE_VALID
        ]
        template_type_null = [r for r in baux_rows if r.template_type is None]
        sans_skribble = [r for r in baux_rows if r.skribble_session_id is None]
        signed_plan_b = [
            r for r in baux_rows
            if r.signed_at is not None and r.tenant_signed_at is not None
        ]

        print("### 2.1 Intégrité référentielle\n")
        print(f"- Baux sans `bien_id` : {len(sans_bien)} (devrait être 0 — RESTRICT)")
        print(f"- Baux sans `owner_id` : {len(sans_owner)} (devrait être 0 — RESTRICT)")
        print(f"- Baux sans `tenant_id` : {len(sans_tenant)} (= baux non-attribués, OK Phase 1.0)")
        if sans_bien:
            for r in sans_bien:
                print(f"  - ⚠️  bail `{r.reference}` (id `{r.id}`)")

        print("\n### 2.2 Champs Sprint 10 à backfiller\n")
        print(f"- `deposit_type` hors enum strict 0051 : **{len(deposit_type_hors_enum)}**")
        for r in deposit_type_hors_enum[:5]:
            print(f"  - bail `{r.reference}` → deposit_type=`{r.deposit_type}` (sera reset à `gocaution`)")
        if len(deposit_type_hors_enum) > 5:
            print(f"  - ... et {len(deposit_type_hors_enum) - 5} autres")
        print(f"- `template_type` NULL : **{len(template_type_null)}** (à backfiller défaut `sunimmo_annee`)")

        print("\n### 2.3 Statut signature\n")
        print(f"- Baux signés Plan B Sprint 8 (`signed_at` + `tenant_signed_at`) : {len(signed_plan_b)}")
        print(f"- Baux sans session Skribble : {len(sans_skribble)} (= peuvent passer Plan A si SKRIBBLE_ENABLED=True)")

        # 3. Mandats requis
        print(f"\n## 3. Mandats `MandatGestion` requis\n")
        owners = sorted({r.owner_id for r in baux_rows if r.owner_id})
        print(f"- Propriétaires uniques détectés : **{len(owners)}**\n")

        if agency_id:
            mandats_rows = (
                await db.execute(
                    text("""
                        SELECT mandant_id, status FROM mandats_gestion
                        WHERE agence_id = :aid AND is_active = TRUE
                    """),
                    {"aid": str(agency_id)},
                )
            ).all()
            existing_mandants = {r.mandant_id for r in mandats_rows}
            mandats_manquants = [o for o in owners if o not in existing_mandants]

            print(f"- Mandats déjà créés (agency_id=`{agency_id}`) : {len(mandats_rows)}")
            print(f"- Propriétaires SANS mandat → à créer : **{len(mandats_manquants)}**\n")

            for owner_id in mandats_manquants[:5]:
                u_row = (
                    await db.execute(
                        text("SELECT email, first_name, last_name FROM users WHERE id = :uid"),
                        {"uid": str(owner_id)},
                    )
                ).one_or_none()
                if u_row:
                    nom = " ".join(p for p in (u_row.first_name, u_row.last_name) if p) or u_row.email
                    print(f"  - 🆕 Mandat à créer pour `{nom}` (`{u_row.email}`, id `{owner_id}`)")
            if len(mandats_manquants) > 5:
                print(f"  - ... et {len(mandats_manquants) - 5} autres")
        else:
            print(f"- ⚠️  Impossible de vérifier les mandats sans user Sunimmo (cf §1).")

        # 4. Avenants / résiliations historiques
        print("\n## 4. Avenants & Résiliations historiques\n")
        nb_avenants = (
            await db.execute(
                text("SELECT COUNT(*) AS c FROM avenants WHERE is_active = TRUE")
            )
        ).scalar_one()
        nb_resiliations = (
            await db.execute(
                text("SELECT COUNT(*) AS c FROM resiliations WHERE is_active = TRUE")
            )
        ).scalar_one()
        print(f"- Avenants en DB : **{nb_avenants}** (Sunimmo démarre Phase 1.0 fresh — devrait être 0)")
        print(f"- Résiliations en DB : **{nb_resiliations}** (idem — devrait être 0)")

        # 5. Plan d'action
        print("\n## 5. Plan d'action recommandé (à exécuter par Killian — pas auto)\n")
        print("1. Vérifier que `users.email = SUNIMMO_AGENCY_EMAIL` existe avec `role='agence'`")
        print("2. Pour chaque propriétaire dans `§3 — Propriétaires SANS mandat` :")
        print("   - Créer `MandatGestion(mandant_id=owner_id, agence_id=sunimmo_id, ...)` via UI `/app/mandats/new`")
        print("   - Envoyer en signature Skribble (mandant + agence)")
        print(f"3. Pour les {len(template_type_null)} baux sans `template_type` : backfill SQL")
        print("   ```sql")
        print("   UPDATE contracts SET template_type='sunimmo_annee' WHERE template_type IS NULL;")
        print("   UPDATE contracts SET cgul_version='althy_v1_2026' WHERE cgul_version IS NULL;")
        print("   ```")
        if deposit_type_hors_enum:
            print(f"4. Les {len(deposit_type_hors_enum)} baux avec `deposit_type` hors enum seront")
            print("   automatiquement reset à `gocaution` par la migration 0051 (idempotent).")
        print("5. **Aucune écriture ne sera effectuée par ce dry-run.**")

        print(f"\n_Dry-run terminé sans aucune mutation DB._\n")
        return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
