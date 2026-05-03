# Sprint A11.A.6.b — Endpoints CRUD sous-tables fiche bien

> Statut : ✅ Code livré (smoke runtime à exécuter sur preview Vercel + Railway après merge)
> Date livraison : 2026-05-03
> Branche : feat/bien-endpoints (à merger sur main)

## Périmètre livré

CRUD complet pour les 4 nouvelles entités du data model A11.A.6.a + extension implicite du PATCH `/biens/{id}` aux 28 nouveaux champs (déjà PATCH-ables via le pattern dynamique de `BienService.update`, juste validé en CH0).

## 16 endpoints ajoutés

| Méthode | Path | Description |
|---|---|---|
| GET | `/api/v1/biens/{bien_id}/annexes` | Liste annexes |
| POST | `/api/v1/biens/{bien_id}/annexes` | Création — 201 |
| PATCH | `/api/v1/biens/{bien_id}/annexes/{annexe_id}` | Update partiel |
| DELETE | `/api/v1/biens/{bien_id}/annexes/{annexe_id}` | Soft delete — 204 |
| GET | `/api/v1/biens/{bien_id}/contacts` | Liste contacts externes |
| POST | `/api/v1/biens/{bien_id}/contacts` | Création — 201 |
| PATCH | `/api/v1/biens/{bien_id}/contacts/{contact_id}` | Update partiel |
| DELETE | `/api/v1/biens/{bien_id}/contacts/{contact_id}` | Soft delete |
| GET | `/api/v1/biens/{bien_id}/compteurs` | Liste compteurs |
| POST | `/api/v1/biens/{bien_id}/compteurs` | Création — 201 |
| PATCH | `/api/v1/biens/{bien_id}/compteurs/{compteur_id}` | Update partiel |
| DELETE | `/api/v1/biens/{bien_id}/compteurs/{compteur_id}` | Soft delete |
| GET | `/api/v1/users/me/bank-accounts` | Liste comptes user authentifié |
| POST | `/api/v1/users/me/bank-accounts` | Création — 201 |
| PATCH | `/api/v1/users/me/bank-accounts/{account_id}` | Update partiel |
| DELETE | `/api/v1/users/me/bank-accounts/{account_id}` | Soft delete |

## 4 services créés

- `BienAnnexeService` (`app/services/bien_annexe_service.py`) — réutilise `_can_write` parent + `_get_or_404` de `BienService`.
- `BienContactService` (`app/services/bien_contact_service.py`) — pattern symétrique.
- `BienCompteurService` (`app/services/bien_compteur_service.py`) — pattern symétrique.
- `BankAccountService` (`app/services/bank_account_service.py`) — scope `current_user`, logique métier `est_principal` unique avec bascule atomique des autres comptes.

## 8 schemas Create/Update ajoutés

- `BienAnnexeCreate` / `BienAnnexeUpdate`
- `BienContactCreate` / `BienContactUpdate`
- `BienCompteurCreate` / `BienCompteurUpdate`
- `BankAccountCreate` / `BankAccountUpdate`

Validation Pydantic légère (min_length, max_length, ge=0). Pas d'enum strict pour les champs `type` / `role` / `usage` / `partage` / `caution_type` etc. — valeurs admises documentées en commentaire mais stockées en str (cohérent décision A11.A.5).

## Logique métier `est_principal` unique enforced

Double garde-fou :

1. **DB-side** : unique partial index `ix_bank_accounts_user_principal_unique` sur `bank_accounts(user_id) WHERE est_principal = true` (créé en migration 0035 via mini-patch sécurité). Toute tentative d'INSERT ou UPDATE qui rendrait un user avec 2 comptes principaux est rejetée par Postgres avec `IntegrityError`.

2. **Service-side** : `BankAccountService._unset_other_principals(user_id, exclude_id)` est appelé AVANT le SET de `est_principal=true` sur la cible (POST avec `est_principal=true` ou PATCH avec `est_principal=true`). Bascule tous les autres comptes du user à `false` puis flush explicite — garantit l'absence de violation de la contrainte au flush final.

Pattern aligné sur `BienService.add_image` qui bascule `is_cover`.

## Décisions arbitraires prises pendant le sprint

1. **Access control sur sous-tables** — pour Phase 1, lecture (`GET`) et écriture (`POST/PATCH/DELETE`) requièrent toutes deux `_can_write` (proprio / agency / created_by / super_admin). Le locataire actif peut consulter le bien via `BienDetail` (qui inclut annexes/contacts/compteurs en lecture seule) mais ne peut pas appeler directement les endpoints `/annexes` etc. À reconsidérer Phase 2 si on veut un GET ouvert au locataire.

2. **Suppression du compte principal** — quand un user supprime son compte `est_principal=true`, **aucune ré-élection automatique** d'un autre compte. L'utilisateur reste sans principal jusqu'à ce qu'il en désigne un. Decision UX : éviter une bascule silencieuse qui surprendrait l'utilisateur. À confirmer avec l'UX A11.A.6.c.

3. **Soft delete uniforme** — toutes les routes DELETE font un soft delete (`is_active=False`), cohérent avec la doctrine globale et le pattern `BienService.delete`. Permet l'audit trail et la restauration future.

## Backlog identifié

### Pour A11.A.6.c (UI)

- Refonte modale Caractéristiques avec accordéon/tabs pour les 50 champs `biens` (sections : Identité bâtiment / Caractéristiques techniques / Conditions location / Fiscalité / Description publique).
- Sections fiche bien étendues avec mini-tableaux ou sous-panels :
  - Annexes (caves, parkings, places…)
  - Contacts externes (régie tierce, syndic, concierge…)
  - Compteurs (eau/électricité/gaz…)
- UI gestion BankAccount dans `/app/settings` ou `/app/profil` avec UX "désigner principal" claire (1 clic) + warning si suppression du principal.

### Backlog refacto

- **Validation IBAN** — sprint sécurité financière dédié avec `python-stdnum` (validation format IBAN selon pays + checksum mod-97).
- **Acquisition automatique GeoAdmin/RegBL** — sprint dédié APIs publiques pour pré-remplir EGID / EWID / commune_ofs lors du géocodage du bien (cf `docs/6-LEGAL.md` §6.16 cadre Hunter + référence catalogue APIs CH).
- **Chiffrement at-rest IBAN** — Phase 2 via pgcrypto ou KMS (cohérent docstring `BankAccount`).
- **Suppression `User.iban` legacy** — Phase 2 quand tous les call sites migrés vers `user.bank_accounts`.
- **Audit logs sous-tables** — actuellement les CRUD annexes / contacts / compteurs / bank_accounts ne loggent pas dans `audit_logs` (seul `BienService.update` le fait). À ajouter quand le besoin de traçabilité se fait sentir (sprint compliance Phase 2).

## Doc de référence

- Sprint précédent : `docs/session12/SPRINT-A11A6a-data-model.md` (data model + migration 0035).
- `docs/7-CATALOGUE-DONNEES-ALTHY.md` — catalogue exhaustif source.
- `docs/3-ARCHITECTURE.md` §3.13 — conventions endpoints REST.
- `docs/4-PRODUIT.md` §4.6 — Module Bien.
