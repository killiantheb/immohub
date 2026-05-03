# Sprint A11.A.6.a — Data model fiche bien

> Statut : ✅ Code livré, **migration runtime non testée localement**
> (DATABASE_URL pointe sur Supabase prod, pas de DB de test). Test prod
> obligatoire avant merge déploiement.
> Date livraison : 2026-05-03
> Branche : feat/bien-data-model (à merger sur main)

## Périmètre livré

Extension du data model fiche bien selon `docs/7-CATALOGUE-DONNEES-ALTHY.md` :

- **28 colonnes** ajoutées sur `biens` (identité bâtiment, caractéristiques techniques avancées, conditions location, fiscalité, description publique).
- **4 nouvelles tables** : `bien_annexes`, `bien_contacts`, `bank_accounts`, `bien_compteurs`.
- **Migration de données** : `User.iban` non vide → 1 ligne `bank_accounts` (usage='general', est_principal=true) par user concerné.

Aucun endpoint, aucun service, aucune UI — strict scope DB + modèles + schemas Read.

## Migration appliquée — 0035_extension_fiche_bien

### Colonnes ajoutées sur `biens` (28)

| Catégorie | Champs |
|---|---|
| Identité bâtiment (5) | `egid`, `ewid`, `numero_parcelle`, `numero_lot_ppe`, `commune_ofs` |
| Caractéristiques techniques (13) | `nb_etages`, `type_chauffage`, `mode_eau_chaude`, `orientation_principale`, `vue`, `bruit_proximite`, `accessibilite_pmr`, `ascenseur`, `cave_m2`, `balcon_m2`, `terrasse_m2`, `jardin_m2`, `terrain_m2` |
| Conditions location (6) | `loyer_charges_exclus`, `acompte_charges`, `caution_type`, `disponibilite_date`, `duree_minimale_mois`, `preavis_mois` |
| Fiscalité (2) | `valeur_locative_fiscale`, `valeur_assurance_ecab` |
| Description publique (2) | `description_publique`, `points_forts` |

**Skipped (zéro doublon)** :
- `etage`, `annee_renovation`, `classe_energetique` — déjà présents sur `biens`
- `caution_montant` ≡ `biens.deposit` — sémantique identique, non dupliqué

### Tables créées (4)

- `bien_annexes` — caves, parkings, places, garages, box, grenier liés au bien (FK CASCADE).
- `bien_contacts` — contacts externes non-Althy (régie tierce, syndic, concierge, garant, voisins clés). Distinct de `User.locataire` / `User.proprio`.
- `bank_accounts` — comptes bancaires multi-usage par utilisateur (usage : regie/cautions/charges/travaux/general). `est_principal` unique par user à enforcer service Phase 1.b (pas de UNIQUE partial index DB).
- `bien_compteurs` — compteurs eau, électricité, gaz, mazout, chauffage. Avec partage proprio/locataire/divisé.

Tous héritent de la convention `BaseModel` (id UUID + created_at + updated_at + is_active). Index secondaires `(parent_id, type/role/usage)` créés.

### Migration de données

```sql
INSERT INTO bank_accounts (id, user_id, usage, iban, bic, titulaire, ...)
SELECT gen_random_uuid(), id, 'general', iban, bic,
       COALESCE(NULLIF(bank_account_holder, ''),
                NULLIF(TRIM(first_name || ' ' || last_name), ''),
                email),
       true, 'CH', now(), now(), true
FROM users WHERE iban IS NOT NULL AND iban <> ''
```

`User.iban` / `User.bic` / `User.bank_account_holder` **conservés** (déprécié, suppression Phase 2 après migration des call sites).

### Downgrade

Implémenté symétriquement (drop indexes + drop tables + drop columns dans l'ordre inverse).

## Modèles SQLAlchemy ajoutés

- `app/models/bien_annexe.py` → `BienAnnexe` (relation back_populates `bien` + Bien.annexes)
- `app/models/bien_contact.py` → `BienContact` (relation back_populates `bien` + Bien.contacts)
- `app/models/bien_compteur.py` → `BienCompteur` (relation back_populates `bien` + Bien.compteurs)
- `app/models/bank_account.py` → `BankAccount` (relation back_populates `user` + User.bank_accounts)

`Bien` étendu avec 28 colonnes + 3 relations 1:N (`annexes`, `contacts`, `compteurs`) en `lazy="selectin"`, cascade `all, delete-orphan`.
`User` étendu avec relation `bank_accounts` (même cascade). Champs IBAN du modèle User marqués DÉPRÉCIÉS dans la docstring.

`app/models/__init__.py` mis à jour avec les 4 nouveaux exports.

## Schemas Pydantic Read minimum

- `BienBase` + `BienUpdate` : 28 champs Optional ajoutés.
- `BienDetail` : nouvelles listes `annexes` / `contacts` / `compteurs`.
- `BienAnnexeRead`, `BienContactRead`, `BienCompteurRead`, `BankAccountRead` : schemas Read minimum (from_attributes ConfigDict pour ORM).

Hors scope : schemas `Create` / `Update` pour les 4 sous-tables (livrés A11.A.6.b avec endpoints).

## Vérifications

- ✅ `python -c "import app.main"` — clean
- ✅ `python -c "from app.models import Bien, BienAnnexe, BienContact, BankAccount, BienCompteur"` — clean
- ✅ `ruff check` sur tous les fichiers modifiés — `All checks passed!` (171 issues auto-fixées via `--fix`, 0 introduite vs baseline)
- ✅ `ruff format` appliqué proprement
- ✅ `mypy app/models/* app/schemas/bien.py` — `Success: no issues found in 7 source files`
- ⚠️ `alembic upgrade head` + `downgrade -1` — **non testés runtime** : DATABASE_URL local pointe Supabase prod, pas de DB test dispo. Migration relue ligne par ligne, syntax compile-checkée via `py_compile`. Test obligatoire côté Killian sur staging Railway avant merge prod.

## Backlog identifié

### Pour PR-A11.A.6.b (endpoints + service)

- Endpoints CRUD pour les 4 sous-tables : `bien_annexes`, `bien_contacts`, `bank_accounts`, `bien_compteurs`.
- Schemas `Create` / `Update` pour les 4 tables avec validation Pydantic des enums (type / role / usage / partage).
- Extension `BienService.update` pour les 28 nouveaux champs (déjà PATCH-ables via `BienUpdate` mais sans logique métier dédiée — type_chauffage / mode_eau_chaude pourraient être validés via Literal).
- Logique métier `est_principal` unique sur `BankAccount` (à chaque update/insert avec `est_principal=true`, set tous les autres comptes du même user à false dans la même transaction — pattern identique à `update_image.is_cover`).

### Pour PR-A11.A.6.c (UI)

- Refonte modale Caractéristiques avec accordéon/tabs pour intégrer les 30+ nouveaux champs sans surcharger.
- Pattern édition inline pour les 50 champs au total sur le bien.
- UI gestion annexes / contacts / compteurs depuis la fiche bien (mini-tableaux ou sous-panels).
- UI gestion des `bank_accounts` côté profil utilisateur (settings).

### Backlog dette technique

- Suppression `User.iban` / `User.bic` / `User.bank_account_holder` après migration des call sites (Phase 2 — sprint dédié).
- Suppression colonne legacy `interventions.photos ARRAY[Text]` (orphan depuis A11.A.5 — sprint cleanup data).
- Chiffrement at-rest IBAN dans `bank_accounts` (Phase 2 — pgcrypto ou KMS).

## Doc de référence

- `docs/7-CATALOGUE-DONNEES-ALTHY.md` — catalogue exhaustif fiche bien (source du périmètre).
- `docs/3-ARCHITECTURE.md` §3.3 — modèle de données + 7 consolidations + doctrine zéro doublon.
- `docs/4-PRODUIT.md` §4.6 — Module Bien.
- Sprint précédent : `docs/session12/SPRINT-A11A5-interventions.md` (pattern jumeau pour les sous-tables et la migration).
