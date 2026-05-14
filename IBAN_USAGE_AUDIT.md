# IBAN Usage Audit — Sprint 9 Lot A

> 2026-05-14 — post migration 0050 (`feat/sprint-9-lot-a-data-sources`)

Objectif : tracer toutes les sources IBAN bailleur dans le code et documenter
leur statut canonique (CANONICAL / MIGRATED / DEPRECATED / N'EXISTE PAS) après
unification Sprint 9 Lot A.

---

## 1. Sources de vérité — état après migration 0050

| Source | État | Détail |
|---|---|---|
| `bank_accounts` (table) | **CANONICAL** | Source unique Phase 1.0. Multi-comptes par usage (general/regie/cautions/charges/travaux). Index partial `ix_bank_accounts_user_principal_unique` garantit 1 seul `est_principal=true` par user. Accès canonique : `app.services.iban_resolver.get_effective_iban(db, bien_id)`. |
| `Bien.iban_compte_id` (FK) | **CANONICAL** | NOUVEAU (0050). NULL = compte principal owner ; sinon override vers ce `bank_accounts.id` spécifique. ON DELETE SET NULL. |
| `users.iban_legacy` (DB) / `User.iban` (Python) | **DEPRECATED** | Colonne DB renommée par 0050 (visibilité DBA). Attribut Python conservé (mapping `mapped_column("iban_legacy", ...)`) pour rétrocompat `UserProfileResponse`/`UpdateProfileRequest`. Suppression Phase 2 quand `auth.py` schemas migrés. |
| `users.bic_legacy` / `User.bic` | **DEPRECATED** | Idem. |
| `users.bank_account_holder_legacy` / `User.bank_account_holder` | **DEPRECATED** | Idem. |
| `settings.payment_iban` | **N'EXISTE PAS** | Mentionnée dans le brief Lot A mais **aucune occurrence en repo** (vérification `grep -r payment_iban backend/app` = 0 hit ; `models/agency_settings.py` n'a aucun champ IBAN). Aucune migration ne crée cette colonne. Pas de correctif requis. |
| `settings.ALTHY_QR_IBAN` (env var) | **HORS PÉRIMÈTRE** | IBAN corporate Althy pour intermédiation Phase 1 MVP (cf docs/4-PRODUIT.md §4.13). Utilisé comme **fallback** dans `qr_facture.generate_qr_bill_pdf` quand aucun compte bailleur n'est résolu. |

---

## 2. Cascade canonique

```
get_effective_iban(db, bien_id) -> BankAccount | None
│
├─ 1. SELECT bien.iban_compte_id, bien.owner_id FROM biens WHERE id = :bien_id
│
├─ 2a. Si iban_compte_id NOT NULL :
│       SELECT * FROM bank_accounts WHERE id = :iban_compte_id AND is_active
│       → si trouvé : RETURN
│
├─ 2b. Sinon (ou si 2a orphelin) :
│       SELECT * FROM bank_accounts
│       WHERE user_id = :owner_id AND est_principal = true AND is_active = true
│       → unique grâce au partial index (migration 0036)
│
└─ 3. Sinon : RETURN None
        (l'appelant fallback ALTHY_QR_IBAN ou skip)
```

---

## 3. Inventaire usages en code (file:line — statut)

### 3.1 Écritures sur `bank_accounts` (canoniques)
- `backend/alembic/versions/0035_extension_fiche_bien.py:368-394` — [SEED 0035] backfill historique `users.iban` → `bank_accounts` (general/est_principal=true).
- `backend/alembic/versions/0050_unify_iban_sources.py:upgrade()` — [BACKFILL 0050] idempotent : crée bank_account pour les users post-0035 ayant un `iban_legacy` sans bank_account correspondant.
- `backend/app/services/bank_account_service.py` — CRUD existant (non modifié dans ce Lot — surface UX = Lot B).

### 3.2 Lectures via `iban_resolver.get_effective_iban`
- `backend/app/routers/loyers.py:~205` — [MIGRATED] dans `generer_qr_facture`, résout l'IBAN bailleur et passe `qr_iban_override` à `generate_qr_bill_pdf`.

### 3.3 Lectures legacy `User.iban` (mapping Python sur `users.iban_legacy`)
- `backend/app/routers/documents.py:1290-1292` — [LEGACY KEPT] `owner_info` dans `_build_ctx` (sync, pas d'accès db). Templates HTML consomment `owner.iban`. Migration vers `iban_resolver` reportée à un lot dédié (refacto `_build_ctx` async + injection db).
- `backend/app/routers/documents.py:1154-1156` — [LEGACY KEPT] `agency_info` (idem rationale).
- `backend/app/services/auth_service.py:240-245` — [LEGACY KEPT] `update_profile` setattr générique sur les fields du schema `UpdateProfileRequest`. Le PUT `/auth/me` continue d'accepter `iban`/`bic`/`bank_account_holder` en écriture. À retirer Phase 2 (forcer usage `/users/me/bank-accounts`).

### 3.4 Lectures SQL legacy `users.iban_legacy` (nom physique colonne)
- `backend/app/tasks/rent_tasks.py:514` — [MIGRATED] SQL passe désormais par `LEFT JOIN bank_accounts ba ON user_id AND est_principal AND is_active`, avec `COALESCE(ba.iban, u.iban_legacy)` comme filet de sécurité pour les users post-0050 non re-seedés (théoriquement zéro).

### 3.5 Schemas Pydantic exposant `iban` publiquement
- `backend/app/schemas/auth.py:51-53` — [DEPRECATED — KEPT FOR P1] `UpdateProfileRequest.iban` / `bic` / `bank_account_holder`. À retirer Phase 2 (cleanup pré-marketplace publique).
- `backend/app/schemas/auth.py:89-91` — [DEPRECATED — KEPT FOR P1] `UserProfileResponse` idem. Continue d'exposer la donnée legacy pour rétrocompat `/auth/me`.

### 3.6 Contract (table) — colonnes IBAN dédiées
- `backend/app/schemas/contract.py:39,40,71,72,119,120` — `bank_iban` / `bank_bic` côté contrat. **Hors périmètre Lot A** : ce sont des coordonnées intégrées au bail (Contract.bank_iban), pas le compte bailleur Althy. Reste tel quel (cf docs/4-PRODUIT.md §4.13).
- `backend/app/schemas/bien.py:562-563,706-707,718-719` — `BankAccount*` schemas (lecture/écriture côté API bank_accounts). À cross-check avec Lot B Settings UX.

### 3.7 QR-facture
- `backend/app/services/qr_facture.py:108` — [HARDENED] `qr_iban = qr_iban_override or settings.ALTHY_QR_IBAN or "CH00..."`. Le param `qr_iban_override` est passé par `loyers.py` après résolution canonique (3.2). Phase 1 MVP : si pas de compte bailleur résolu, fallback ALTHY_QR_IBAN (Althy intermédiaire).

---

## 4. Endpoints API impactés

| Endpoint | Statut | Détail |
|---|---|---|
| `POST /api/v1/loyers/generer-qr` | **MIGRATED** | Appelle `get_effective_iban`, passe `qr_iban_override`. |
| `PATCH /api/v1/biens/{id}/iban` | **NEW** | Sprint 9 Lot A. Body `{ bank_account_id: UUID \| null }`. RBAC owner/agency/super_admin. Valide que le compte appartient au propriétaire. |
| `PUT /api/v1/auth/me` | **LEGACY KEPT** | Accepte toujours `iban`/`bic`/`bank_account_holder`. Ces fields écrivent dans `users.iban_legacy`. À retirer Phase 2. |
| `GET /api/v1/auth/me` | **LEGACY KEPT** | Idem en lecture. |
| `POST /api/v1/loyers/quittance` | **N/A** | La quittance n'inclut pas l'IBAN bailleur (cf `generate_quittance_pdf`). |

---

## 5. Doctrine

- **§B.10** : aucun faux statut. Le resolver retourne `None` honnête en absence ; QR-facture continue de générer un PDF valide (avec fallback ALTHY_QR_IBAN).
- **§B.12** : `iban_resolver` est read-only (pas de `db.flush`/`db.add`). PATCH `/biens/{id}/iban` fait 1 SELECT, 1 SELECT validation, 1 commit propre. Pas de logging best-effort à risque.
- **§B.13** : 0050 = 100% Python. `op.alter_column` pour renames + `op.execute("INSERT ... SELECT ...")` pour backfill complexe. Aucun `.sql` créé.
- **§B.15** : Phase 1.0 scope (logiciel gestion pure). Aucune feature marketplace / candidature spontanée / Stripe Connect touchée.

---

## 6. À reprendre Phase 2 (backlog)

1. `auth.py` schemas — retirer `iban`/`bic`/`bank_account_holder` de `UpdateProfileRequest` + `UserProfileResponse`. Forcer usage `/users/me/bank-accounts` (déjà exposé via `bank_account_service`).
2. `documents.py` `_build_ctx` — passer en async + injection `db` pour appeler `iban_resolver` au lieu de lire `owner.iban` legacy. Impact templates HTML : doit rester clé `owner.iban` (300+ f-strings) mais valeur résolue depuis canonique.
3. `users.iban_legacy` / `bic_legacy` / `bank_account_holder_legacy` — DROP COLUMN une fois les 2 points ci-dessus migrés.
4. Chiffrement at-rest des IBAN (pgcrypto ou KMS) — cf docstring `BankAccount`.
