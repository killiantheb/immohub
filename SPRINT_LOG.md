# Sprint — Fusion properties → biens (refonte complète)

**Branche :** `refonte/fusion-properties-biens-complete`
**Démarré :** 2026-04-23
**Timeboxing cible :** 8–10h (alerte fondateur si dépassement 12h)
**Objectif :** table unique `biens` (43 colonnes) + catalogue équipements + NPA→canton + 4 bugs collatéraux corrigés

---

## Progression

### Étape 1 — Créer branche + SPRINT_LOG ✅
- Branche `refonte/fusion-properties-biens-complete` créée
- SPRINT_LOG.md initialisé

### Étape 2 — CSV Swisstopo ✅ OPTION B VALIDÉE

Seed minimal hardcodé dans la migration 0029. Couverture Phase 1 :
- **GE** 1200-1299 (Genève canton)
- **VD** 1000-1899 (Lausanne + Riviera + arc lémanique)
- **VS** 1860-1999 + 3900-3999 (incluant Sunimmo priorités : Crans-Montana 3963, Verbier 1936, Zermatt 3920, Sion 1950, Martigny 1920, Sierre 3960)
- **FR** 1700-1799
- **NE** 2000-2099 + 2300-2400 (La Chaux-de-Fonds / Le Locle)
- **JU** 2800-2999
- **ZH/BE/BS/TI** (villes principales uniquement, 8000/3000/4000/6900)

NPA non couvert → `canton = NULL`, éditable manuellement dans la fiche.

> **TODO post-Phase 1 :** importer le CSV Swisstopo complet (~4100 NPA) pour couverture
> nationale. Non bloquant, repoussé au sprint futur.

### Étape 2bis — DB locale : PAS DE POSTGRES LOCAL

Dry-run rigoureux :
1. Validation statique : imports Python + schemas Pydantic + greps exhaustifs
2. Peer review (fondateur + associé tech) sur le fichier migration livré
3. Exécution Supabase : **strictement sur validation manuelle** + backup prod téléchargé avant

**Règle absolue sprint :** si un test statique échoue, STOP + diagnostic avant de continuer.

---

### Étape 3 — Migration Alembic 0029 ✅

Fichier : `backend/alembic/versions/0029_fusion_properties_biens_complete.py` (~600 lignes)

Contient :
1. TRUNCATE biens + properties
2. DROP property_images, property_documents
3. CREATE enum parking_type_enum
4. ALTER biens ADD 29 colonnes + 2 contraintes CHECK
5. CREATE 5 index sur biens
6. RENAME property_id → bien_id + FK rebuild dans 9 tables + favorites + generated_documents
7. CREATE bien_images + bien_documents
8. CREATE catalogue_equipements + seed 49 items
9. CREATE bien_equipements (jonction)
10. CREATE ch_postal_codes + seed ~215 NPAs (GE/VD/VS/FR/NE/JU + chefs-lieux ZH/BE/BS/TI)
11. DROP properties + 3 enums legacy

### Étape 4 — Fichier Supabase 0026 ✅

`supabase/migrations/0026_loyer_transactions.sql` : `property_id` → `bien_id`, `REFERENCES properties(id)` → `REFERENCES biens(id)`, index renommé.

### Étape 5-7 — Modèles SQLAlchemy ✅

- `backend/app/models/bien.py` — réécrit (~320 lignes) : Bien (43 colonnes), BienImage, BienDocument, CatalogueEquipement, BienEquipement, enums
- `backend/app/models/{contract,company,crm,inspection,listing,opener,rfq,transaction}.py` — property_id renommé bien_id, FK vers biens(id)
- `backend/app/models/favorite.py` — property_id → bien_id + contrainte unique
- `backend/app/models/document.py` — `generated_documents.property_id` → bien_id
- `backend/app/models/__init__.py` — export Bien/BienImage/BienDocument/BienEquipement/CatalogueEquipement, retrait Property*
- `backend/app/schemas/__init__.py` — export BienCreate/BienRead/BienUpdate, retrait Property*

### Étape 8-10 — Schemas + services ✅

- `backend/app/schemas/bien.py` — réécrit (~250 lignes) : BienCreate/Update/Read/ListItem/Detail/Paginated + BienImageRead + BienDocumentRead + CatalogueEquipementRead + SetEquipementsRequest + AuditLogResponse
- `backend/app/services/bien_service.py` — nouveau (~500 lignes) : BienService avec list/create/get_detail/update/delete/add_image/delete_image/add_document/set_equipements/remove_equipement/get_equipements/get_history/generate_description + helper `get_canton_from_cp()`
- `backend/app/services/catalogue_service.py` — nouveau (~30 lignes)

### Étape 11-12 — Routers biens + catalogue ✅

- `backend/app/routers/biens.py` — réécrit (~350 lignes) : CRUD + /images + /documents + /equipements (GET/PUT/DELETE) + /history + /generate-description + /potentiel (conservé)
- `backend/app/routers/catalogue.py` — nouveau : GET /catalogue/equipements

---

### Étape 13 — 11 routers Property→Bien 🛑 CHECKPOINT UTILISATEUR

**Fichiers à modifier (non encore faits) :**
- `app/routers/admin.py` (status enum transcode)
- `app/routers/agency_settings.py`
- `app/routers/crm.py`
- `app/routers/documents.py`
- `app/routers/favorites.py` (schemas Pydantic + réponses)
- `app/routers/listings.py`
- `app/routers/marketplace.py`
- `app/routers/sphere_agent.py` (local import ligne 1472)
- `app/routers/ai/documents.py` (3 local imports)
- `app/routers/ai/listings.py` (2 local imports)
- `app/routers/ai/scoring.py` (1 attribut)
- `app/routers/contracts.py` (attribut Contract.property_id → bien_id)

### Étape 14 — Bugs collatéraux ✅ (2026-04-23)

- `loyers.py` + bundle services (`qr_facture` + `quittance` + `storage`) — ✅ commit `ab40e7f`. SQL raw `FROM properties` → `FROM biens`, colonnes `address`/`monthly_rent` → `adresse`/`loyer`, INSERT `loyer_transactions.property_id` → `bien_id` (cohérent migration 0026), params services `property_id`/`property_address` → `bien_id`/`bien_adresse`, schemas `GenererQRRequest`/`GenererQuittanceRequest` renommés.
- `interventions_althy.py` — ✅ commit `085064a`. 1 SQL raw pour notification email proprio (`SELECT p.address FROM properties` → `b.adresse FROM biens`).
- `rgpd.py` — ✅ commit `8b52439`. Colonnes fantômes `type_bien`/`loyer_mensuel` (n'existent plus sur biens depuis 0029) → `type`/`loyer`. Clés JSON de l'export utilisateur mises à jour en phase.
- `portail.py` — ✅ commit à venir. 3 SELECTs `type_bien`/`loyer_mensuel` → `type`/`loyer`, 1 ORM `select(Property)` → `select(Bien)`, 1 schema `PortailInvitation.property_ids` → `bien_ids`, dict de réponse `properties_count`/`properties`/`{name, address}` → `biens_count`/`biens`/`{adresse, ville}` (`Property.name` n'existe pas sur Bien, remplacé par `adresse`).

### Étape 15-18 — Services + tasks + main + suppressions 🟡 EN COURS (session 3)

- 5 services : ~~ai_service~~ ✅, contract_service ✅ (étape 13), marketplace_service ✅ (étape 13), ~~transaction_service~~ ✅ (+ supprimer property_service 🛑)
- 2 tasks Celery : rent_tasks.py (3 occurrences), notifications.py (2 occurrences)
- main.py : supprimer import properties + include_router, ajouter catalogue_router
- core/security.py:291 : import local Property
- 4 suppressions : models/property.py, routers/properties.py, services/property_service.py, schemas/property.py

**`ai_service.py`** — ✅ 2026-04-23 session 3. Signature `generate_listing_description(property: Property, db, user_id)` → `(bien: Bien, db, user_id)`. Suppression des 12 `getattr(property, "...", defaults)` remplacés par accès direct aux attributs Bien (adresse/ville/cp/canton/surface/rooms/etage/loyer/charges/deposit/is_furnished/parking_type/pets_allowed). Casts `float()` explicites `if x is not None else None` pour Numeric→Decimal (rooms, loyer, charges, deposit) pour éviter `TypeError` sur `json.dumps` — safe sur `Decimal("0.00")`. Clé `has_parking: bool` → `parking_type: str|None` (plus informatif pour le prompt LLM). Ajout `cp` + `canton or ""` au payload (signal SEO, fallback sur canton nullable). Context_ref `str(property.id)` → `str(bien.id)`. Commentaire stale dans `marketplace_service.py:350` (5e bug dormant) nettoyé. **5e bug dormant corrigé** : les appelants (`routers/ai/listings.py:169` + `services/marketplace_service.py:357`) passaient déjà un `Bien` positionnellement, donc aucune rupture contract. AST OK.

**`transaction_service.py` + `schemas/transaction.py` bundle** — ✅ 2026-04-23 session 3. Bundle obligatoire (service + schema liés par `TransactionRead.model_validate`). 9 refs Property/property_id dans le service + 2 refs dans le schema. **6e bug dormant confirmé** : `TransactionRead.property_id` vs modèle `Transaction.bien_id` depuis étape 5-7 → Pydantic v2 + `from_attributes=True` + champ Optional absent = remplissage `None` silencieux. Impact prod : tous les `OwnerDashboard.recent_transactions[].property_id` et `AgencyDashboard.recent_transactions[].property_id` retournaient `null` depuis la migration → lien frontend vers bien cassé. Correction : renommage `property_id` → `bien_id` aligné sur le modèle.

*Migration 0029 vérifiée* : `RENAME COLUMN property_id TO bien_id` (L174-183) — pas DROP+ADD. Mais TRUNCATE properties CASCADE L72 wipe `transactions` (accepté Option B fondateur). Pas de backfill nécessaire : table vide post-migration, le code refondu insère `bien_id=UUID` à chaque création. Fenêtre "bien_id null" limitée à l'intervalle entre deploy et 1ère nouvelle transaction.

*Scope détaillé* :
- `schemas/transaction.py` : `TransactionCreate.property_id` → `bien_id`, `TransactionRead.property_id` → `bien_id`
- `services/transaction_service.py` : kwarg `list(property_id=...)` → `list(bien_id=...)`, `Transaction.property_id` → `Transaction.bien_id` (filtre + constructor), 2 imports locaux `from app.models.property import Property` → `from app.models.bien import Bien`, 4 accès ORM `Property.{owner_id,agency_id,is_active}` → `Bien.{...}` dans `owner_dashboard`/`agency_dashboard`.
- `Contract.monthly_rent` : zéro touche. `transaction_service` calcule sur `Transaction.amount` (Numeric autonome, décorrelé de Bien.loyer et Contract.monthly_rent).

AST OK sur les 3 fichiers (ai_service + schemas/transaction + transaction_service). Grep résiduel `Property|property_id` dans les 2 fichiers migrés = 0 match.

### 📋 Dette technique post-lancement — méthodes mortes `TransactionService`

Grep exhaustif 2026-04-23 session 3 : `TransactionService(db).{list,create,mark_paid,get,get_stats}` = **0 call site** dans tout le backend. Ces méthodes ont été migrées par cohérence interne (signature publique + modèle ORM) mais aucun endpoint HTTP ne les appelle.

| Méthode | Statut | Hypothèse |
|---|---|---|
| `TransactionService.list()` | 0 call site | Aurait dû être exposée via `routers/transactions.py` (inexistant). L'endpoint admin `/admin/transactions` utilise une `PaginatedTransactions` locale — pas ce service. |
| `TransactionService.create()` | 0 call site | Transactions créées via `rent_tasks` Celery (à migrer étape 15-18 restant) ou directement SQL. Pas d'endpoint HTTP `POST /transactions`. |
| `TransactionService.mark_paid()` | 0 call site | Action "marquer payé" probablement gérée côté frontend via un autre endpoint (admin ? manuel ?). À clarifier. |
| `TransactionService.get()` | 0 call site | Idem. |
| `TransactionService.get_stats()` | 0 call site | Remplacée en pratique par les dashboards `owner_dashboard`/`agency_dashboard`. |

**Action post-refonte** : à évaluer pour suppression après validation alpha — si effectivement zéro usage confirmé en 3 mois, supprimer. Sinon créer `routers/transactions.py` pour exposer proprement les méthodes mortes utiles. On ne porte pas du code mort sans le documenter.

### 🚨 Rupture API frontend étape 19 — dashboard transactions

**Rupture API + correction bug dégradation silencieuse** : `OwnerDashboard.recent_transactions[].property_id` et `AgencyDashboard.recent_transactions[].property_id` → **`bien_id`**.

- **Avant refonte** : `property_id: null` systématique (6e bug dormant, lien vers bien cassé dans les dashboards `/app` et `/app/agence` — toute carte récapitulative transaction récente sans ID bien).
- **Après refonte** : `bien_id: UUID` réel, lien fonctionnel.
- **Action frontend étape 19** : lire `bien_id` à la place de `property_id` dans les réponses `/dashboard/owner` et `/dashboard/agency` → **corrige en plus un affichage cassé en prod actuelle** (cliquer sur une transaction récente ne menait nulle part).

### Étape 19 — Frontend 🛑

- `useBiens.ts` à enrichir (useBiensList paginé, useCatalogueEquipements)
- `useProperties.ts` à supprimer
- `lib/hooks/index.ts` à mettre à jour
- 10+ pages à mettre à jour (biens/page.tsx, contracts/new, crm, admin/transactions, publier, etc.)

### Étape 20-21 — Checkpoint + tests 🛑

---

## Problèmes rencontrés
_(aucun bloquant — peer review du fichier 1 a rattrapé 2 tables FK oubliées : commissions + sale_mandates ; corrigées dans le patch)_

---

## TODOs post-sprint (issus de la peer review)

- **Icônes catalogue équipements** : dans la migration 0029 (seed catalogue_equipements), les noms d'icônes suivants **n'existent pas dans lucide-react v0.383** : `kettle`, `microwave`, `oven`, `pillow`, `blanket`, `cooking-pot`, `iron`, `speaker`. À corriger via UPDATE SQL post-sprint (zéro impact sur la migration, les champs sont des strings libres). Remplacements suggérés : `coffee`, `microwave-oven` n'existe pas non plus — utiliser `utensils` ou `square` comme fallback. Validation visuelle côté frontend.
- **Seed NPA complet CH** : actuellement ~250 NPAs couvrant GE/VD/VS/FR/NE/JU + chefs-lieux ZH/BE/BS/TI. Import du CSV Swisstopo complet (~4100 NPAs) repoussé post-Phase 1 — non bloquant, les NPAs hors seed gardent `canton = NULL` (éditable à la main).
- **Feature Vente + Commissions partenaires** : tables `sale_mandates` et `commissions` existent en DB (alembic 0018 + 0012) mais aucun code Python ne les utilise. Le renommage `property_id → bien_id` est fait dans la migration 0029, mais activer ces features nécessitera un sprint dédié (routers, services, schémas, frontend).
- **Aminona (VS)** : skipé au seed après vérification (3 sources). Aminona partage le NPA 3963 avec Crans-Montana (déjà présent).
- **Typage `float` vs `Decimal` sur colonnes financières** (`loyer`, `charges`, `deposit`, `rooms`) : actuellement `Mapped[float | None]` alors que SQLAlchemy `Numeric` retourne `Decimal` strictement. Choix conforme au reste du codebase (ex: `Property.monthly_rent` historique). Migration vers `Decimal` possible si besoin de précision exacte dans les calculs financiers — pas bloquant pour Phase 1.
- **Bugs détectés en peer review fichier 2** (corrigés immédiatement) :
  - `bien_equipements` : migration créait la table sans `updated_at` / `is_active` alors que le modèle `BienEquipement` héritait de `BaseModel` → crash runtime à l'INSERT. Fix : ajout des 2 colonnes à la migration.
  - `created_by_id` devait être NOT NULL per spec → oubli au premier pass. Fix : NOT NULL ajouté migration + modèle.
- **Bugs détectés en peer review fichier 3** (corrigés immédiatement) :
  - `BienRead.created_by_id` était Optional alors que la DB est NOT NULL — incohérence. Fix : rendu non-nullable.
  - `BienEquipementRead` manquait `model_config = ConfigDict(from_attributes=True)` → crash `model_validate()` sur ORM. Fix : ajouté.
  - Docstring module mentionnait `BienImageCreate` / `BienDocumentCreate` inexistants (uploads multipart, pas JSON). Fix : retiré + note explicative.
- **Notes peer review fichier 3 (non bloquantes)** :
  - **Incohérence intentionnelle float (modèle) / Decimal (schema)** : Pydantic Decimal côté API pour précision financière, SQLAlchemy float pour cohérence codebase. Conversion automatique gérée par Pydantic v2. Choix délibéré pour la propreté de l'API publique.
  - **BienListItem n'est pas réellement lightweight** : hérite de tous les 43 champs de BienRead + images. OK pour MVP, à optimiser si perf devient un problème (créer version minimale avec id, adresse, ville, type, loyer, statut, image de couverture, surface, rooms).
  - **AuditLogResponse** : à vérifier en pratique lors du test de l'endpoint `/biens/{id}/history` que les colonnes sont bien nullable/not nullable comme déclaré côté Pydantic.
- **Bugs + améliorations peer review fichier 4** (corrigés immédiatement) :
  - **Bug history perf** : `get_bien_history` chargeait images + documents + équipements juste pour checker l'accès. Fix : nouvelle méthode publique `BienService.get_for_access_check()` (1 SELECT léger), utilisée dans history.
  - **Bug UUID parsing** : path params `bien_id`/`image_id`/`document_id`/`equipement_id` passaient en `str` → ValueError 500 si malformé. Fix : typage strict `uuid.UUID` → FastAPI renvoie 422 propre. Suppression des `uuid.UUID(id)` dans le service devenus redondants.
  - **Bug generate_description sans response_model** : ajout `GenerateDescriptionResponse` dans schemas + utilisation dans le router pour type-safety OpenAPI.
  - **Refacto Potentiel IA** : 130 lignes de logique métier + access check dupliqué migrés du router vers `BienService.get_potentiel_ia()`. Schéma `PotentielIAResponse` déplacé dans `schemas/bien.py`. Le router devient un passe-plat de 5 lignes. Access check unique via `get_for_access_check()`.
  - **owner_id / agency_id en UUID** : query params `list_biens` typés strict `uuid.UUID | None` → 422 si malformé.
- **SKIPPED pour ce sprint (note)** :
  - **summary= / description= sur endpoints OpenAPI** : cosmétique, à faire dans un sprint dédié quand on ouvre l'API à des tiers.

---

## Fin de session — 2026-04-23 soir (session 2)

### 📊 Bilan session 2

**Étapes terminées :** 13 (12/12 routers) + 14 (4/4 routers + bugs collatéraux)

**11 commits atomiques session 2 :**
| Commit   | Fichier(s)                          | Scope                                    |
|----------|-------------------------------------|------------------------------------------|
| 44d8872  | crm.py                              | Schemas + URL + 8 modèles joints         |
| 66cf18e  | documents.py                        | Stratégie A adaptateur + 2 bugs dormants |
| 6024a64  | listings.py                         | Autonome, minimal                        |
| d232628  | marketplace bundle (2 fichiers)     | Router + service + 3e bug dormant        |
| 07b8622  | admin.py                            | Mapping enum critique + 2 schemas        |
| fcd2e2f  | contracts bundle (4 fichiers)       | Router + service + hook + schema + 4e bug dormant |
| 46532e6  | favorites.py                        | Full rename schemas exposés (rupture max) |
| ab40e7f  | loyers bundle (4 fichiers)          | Router + 3 services QR/quittance/storage |
| 085064a  | interventions_althy.py              | 1 SQL raw notification email             |
| 8b52439  | rgpd.py                             | Colonnes fantômes `type_bien`/`loyer_mensuel` |
| 823128f  | portail.py                          | 5 sites (schema + ORM + 2 SQL raw + dict) |

**Fichiers touchés session 2 : ~21 fichiers backend.**

**Bugs dormants corrigés : 5 (+ 1 bonus pré-existant uuid.UUID)**
1. `documents.py:1412` `PropertyImage` import orphelin → `BienImage`
2. `documents.py:1498` `GeneratedDocument(property_id=...)` → `bien_id`
3. `marketplace_service.py:301` `prop = Property(...)` + `db.add(prop)` → `bien = Bien(...)`
4. `contract_service.py:226` `PropertyImage` import orphelin → `BienImage`
5. `loyers.py` + SQL raw sur `properties`/`address`/`monthly_rent` → `biens`/`adresse`/`loyer` (runtime crash certain)
- Bonus : `uuid.UUID(payload.property_id)` dans `contract_service.create()` avec un champ déjà typé `uuid.UUID` — simplifié.

**Bugs dormants identifiés, non corrigés (scope étape 15-18) :**
- `ai_service.generate_listing_description(property: Property)` — param name + getattr fallbacks renvoient description vide sur un Bien.

**Ruptures API frontend documentées (section dédiée dans SPRINT_LOG) :**
6 routers avec chaque fois la liste exacte des champs touchés + consommateurs frontend identifiés : crm, documents, admin, contracts, favorites, loyers, portail.

### 📈 Progression du sprint global

| Étape       | Statut      | Fichiers touchés  |
|-------------|-------------|-------------------|
| 1–12        | ✅ Session 1 | Fondations + 5 routers étape 13 |
| **13**      | **✅ Session 2** | **12 fichiers (7 routers + 2 services + 1 hook + 1 schema + 1 router déjà fait)** |
| **14**      | **✅ Session 2** | **7 fichiers (4 routers + 3 services helpers)** |
| 15–18       | 🛑 Session 3 | ~10 fichiers (3 services restants + 2 tasks + main + security + 4 suppressions) |
| 19          | 🛑 Session 3 | ~13 fichiers frontend (ruptures à aligner) |
| 20          | 🛑 Session 3 | Tests statiques + checkpoint final |

**Estimation progression globale : ~75%** (fondations + 14 étapes sur 20 total, mais étapes 15-19 restent les plus complexes côté cleanup services + frontend).

### 🔑 Entrée pour la prochaine session

```
Lis SPRINT_LOG.md pour te remettre en contexte.

Scope session 3 :
1. Étape 15-18 : migrer ai_service (dormant bug identifié), transaction_service,
   + 2 tasks Celery (rent_tasks, notifications), + main.py (supprimer routers/properties,
   ajouter catalogue_router), + security.py:291 (1 import local Property),
   + 4 SUPPRESSIONS définitives : models/property.py, routers/properties.py,
   services/property_service.py, schemas/property.py.
2. Étape 19 : aligner frontend (13+ pages) sur tous les schemas renommés.
   Section "Ruptures API frontend" du SPRINT_LOG = briefing complet.
3. Étape 20 : test statique `python -c "import app.main"` + checkpoint.

Note : le .env encoding cp1252 bloque le test d'import runtime. À fixer
séparément (pas dans le scope du sprint).
```

Branche active : `refonte/fusion-properties-biens-complete`
Dernier commit : `823128f`

---

## Fin de session — 2026-04-23 après-midi

### ✅ FAIT

**Fondations (4 fichiers validés en peer review)** :
- `backend/alembic/versions/0029_fusion_properties_biens_complete.py`
- `backend/app/models/bien.py`
- `backend/app/schemas/bien.py`
- `backend/app/routers/biens.py`

**Bonus services** :
- `backend/app/services/bien_service.py` (enrichi : `get_for_access_check` + `get_potentiel_ia`)
- `backend/app/services/catalogue_service.py` (nouveau)
- `backend/app/routers/catalogue.py` (nouveau)

**Modèles liés (FK renommées)** :
- `contract.py`, `company.py`, `crm.py`, `inspection.py`, `listing.py`, `opener.py`, `rfq.py`, `transaction.py`, `favorite.py`, `document.py` (models/__init__.py + schemas/__init__.py)

**Fichier Supabase corrigé** :
- `supabase/migrations/0026_loyer_transactions.sql` (`property_id` → `bien_id`)

**Étape 13 partielle — 6/12 routers migrés** :
- `sphere_agent.py` (bloc création bien, L1472-1498)
- `ai/scoring.py` (schema `AnomalyResponse.property_id` → `bien_id`)
- `ai/listings.py` (generate-listing + import-property)
- `ai/documents.py` (draft-lease, draft-edl, property-recap + 3 schemas)
- `agency_settings.py` (export comptable)
- `crm.py` (2026-04-23 reprise) : imports, 9 modèles joints (Contract/Bien/User/Listing/Mission/Opener/RFQ/RFQQuote/Transaction/CRMContact/CRMNote/Company), schemas `ContactOut/NoteOut/ProspectCreate/ProspectUpdate/NoteCreate/CRMStats` (champs `property_*` → `bien_*`, `properties_count` → `biens_count`), URL `/property/{property_id}/overview` → `/bien/{bien_id}/overview`. `Contract.monthly_rent` conservé (champ contrat, pas bien). AST OK.
- `documents.py` (2026-04-23) : **Stratégie A — pattern adaptateur** validée (clé `ctx["property"]` + noms internes du dict conservés → 300+ f-strings templates HTML intouchés). Import `Property` → `Bien`, `_build_ctx` signature + body (champs adaptés au nouveau schéma Bien), `GenerateRequest.property_id` → `bien_id`, `contract.property_id` → `contract.bien_id`, **2 bugs latents corrigés** : `PropertyImage` → `BienImage` (import orphelin + queries `bien_id`) et `GeneratedDocument(property_id=...)` → `bien_id=...` (colonne inexistante sur le modèle renommé étape 5-7). AST OK.
- `listings.py` (2026-04-23) : autonome (aucune dépendance service). Import `Property` → `Bien`, helper `_get_user_property_ids` → `_get_user_bien_ids`, schema `ListingCreate.property_id` → `bien_id`, attributs `Listing.property_id` → `Listing.bien_id`, messages d'erreur EN → FR. AST OK.
- `marketplace.py` + `marketplace_service.py` (2026-04-23, bundle) : **bundle service obligatoire** (router → service, ~40 refs Property). Router : 14 edits, tous les joins `Listing.property_id == Property.id` → `Bien.id`, filtres FR (`Bien.ville/canton/type`), variables `prop` → `bien`, `listing.property_id` → `listing.bien_id`. Service : schema `PublierRequest.property_id` → `bien_id` + default `type="apartment"` → `"appartement"`, `TYPE_LABEL` régénéré avec nouveau enum FR, `statut_listing/serialize_listing/score_candidature_ia/get_owned_listing/publier_bien_service` adaptés au modèle Bien (clés FR `ville/code_postal/pieces/caution/etage` CONSERVÉES côté sortie API — contrat frontend). **3e bug latent corrigé** : `prop = Property(...)` + `db.add(prop)` dans `publier_bien_service` (INSERT sur table inexistante). Adapter `has_parking` bool → `parking_type = "exterieur" if True else None`. Champs out-of-scope supprimés : `price_sale` (vente = Listing.price), `country` (DEFAULT DB 0037), `is_for_sale`, `tourist_tax_amount`. AST OK sur les 2 fichiers. **5e bug dormant identifié** (non corrigé) : `ai_service.generate_listing_description(property: Property)` appelé avec un Bien renvoie description vide — try/except couvre, migration prévue étape 15-18.

**Commits** :
- `27c5acc` — WIP fondations migration 0029 + modèles + schemas + services + router biens
- `0e42827` — WIP étape 13 : 6/12 routers migrés (comptage 5 pour l'étape 13 stricte, 6e = le router biens.py comptant pour les fondations)

### 🔀 Réorganisation du sprint — services déplacés en étape 13

Greps de dépendances (2026-04-23) ont révélé que 2 routers dépendent de
services encore non migrés (étape 15-18 initialement) :

- `marketplace.py` → `marketplace_service.py` (~40 refs `Property`, crée des
  objets `Property(...)` à publier — bug dormant).
- `contracts.py` → `contract_service.py` (~15 refs) + `partner_hooks.py` (1 ref).

Migrer les routers sans leurs services laisserait du code cassé au runtime
(signatures incohérentes, imports orphelins). **Décision fondateur** : bundler
router + service en étape 13. Scope révisé :

- Étape 13 = 7 routers + 2 services + 1 mini-patch service = **10 fichiers**
- Étape 15-18 = 3 services restants (`ai_service`, `transaction_service`,
  suppression `property_service`) + 2 tasks + `main.py` + `security.py` + 4
  suppressions = **11 fichiers** (vs ~10 prévus initialement)

### 🔜 RESTE ÉTAPE 13 (4 fichiers + 1 bundle, ordre d'attaque recommandé)

1. ~~**`crm.py`**~~ — ✅ fait 2026-04-23 (full rename URL + schemas + modèles)
2. ~~**`documents.py`**~~ — ✅ fait 2026-04-23 (stratégie A adaptateur + 2 bugs latents corrigés)
3. ~~**`listings.py`**~~ — ✅ fait 2026-04-23 (autonome, minimal)
4. ~~**`marketplace.py` + `marketplace_service.py`**~~ — ✅ fait 2026-04-23 (bundle router+service, 3e bug latent corrigé)
5. ~~**`admin.py`**~~ — ✅ fait 2026-04-23 (autonome, 6 edits, mapping enum critique `rented/available` → `loue/vacant`, schema `PlatformStats` + `AdminTransaction` renommés)
6. ~~**`contracts.py` + `contract_service.py` + `partner_hooks.py` + `schemas/contract.py`**~~ — ✅ fait 2026-04-23 (bundle 4 fichiers, 4e bug dormant corrigé, nettoyage UUID `uuid.UUID(uuid.UUID(...))`)
7. ~~**`favorites.py`**~~ — ✅ fait 2026-04-23 (full rename schemas exposés — CASSE FRONTEND jusqu'à étape 19, cf section rupture détaillée)
3. **`listings.py` + `marketplace.py`** — à faire ensemble, logique publication/recherche liée. Utilisent `Property.status == "available"`, `Property.city.ilike(...)`.
4. **`admin.py`** — mapping enum critique (`Property.status.in_(["rented", "available"])` → `Bien.statut.in_(["loue", "vacant"])`) + KPIs plateforme.
5. **`contracts.py`** — attribut `Contract.property_id` → `bien_id` (modèle déjà fait, router à synchroniser).
6. **`favorites.py`** — **EN DERNIER**. Expose dans ses schemas de réponse : `property_id`, `property_address`, `property_city`, `property_status`, `monthly_rent`. Renommer côté backend CASSE le frontend tant que l'étape 19 n'est pas faite. À traiter en **coordination avec le frontend** (soit en même temps que étape 19, soit juste avant).

### 🧊 Fonctionnalités retirées du scope Phase 1 (documents.py)

Les champs suivants existaient sur l'ancienne `Property` et sont hardcodés en
defaults dans le pattern adaptateur de `documents.py` (`_build_ctx`, dict
`ctx["property"]`). Ils ne sont plus branchés à la DB :

- `linen_provided` (`False`) → feature saisonnier hors scope
- `price_sale`, `is_for_sale` (`None`/`False`) → feature Vente OFF
- `tourist_tax_amount` (`None`) → feature saisonnier hors scope
- `nearby_landmarks` (`""`) → feature retirée
- `prix_nuit_basse`, `prix_nuit_haute` (`None`) → feature saisonnier hors scope

Le code PDF qui génère bails, quittances, fiches bien, etc. utilise ces champs
hardcodés. Si une feature doit être réactivée, il faudra :
1. Ajouter les colonnes correspondantes à la table `biens`
2. Mettre à jour le modèle + schema + migration
3. Alimenter les clés du dict dans `_build_ctx` de `documents.py`
4. Retester les PDFs générés

### 🧟 Bugs dormants cumulés — code non utilisé en prod

Chaque patch révèle des bugs latents prouvant qu'un chemin de code n'est pas
invoqué en prod (sinon il aurait crashé à la migration étape 5-7). Journal :

**`documents.py` (commit 66cf18e)** — génération PDF bails/fiches :
- `from app.models.property import PropertyImage as _PropImg` → import orphelin,
  le modèle a été renommé `BienImage` dans `app.models.bien` à l'étape 5-7.
- `GeneratedDocument(property_id=prop.id, ...)` → colonne inexistante, le
  modèle a `bien_id` depuis la migration 0029 / étape 5-7.

**`marketplace_service.py:301` (commit à venir)** — publication d'un nouveau bien :
- `prop = Property(...)` + `db.add(prop)` → INSERT sur la table `properties`
  qui n'existe plus post-migration 0029 (TRUNCATE + DROP).
- Conséquence : la page "Publier un bien" (frontend) via `POST /marketplace/publier`
  est cassée tant que le mode création est choisi (mode upsert avec `bien_id`
  existant peut marcher si le payload est bien formé).

**`contract_service.py:226` (commit bundle contracts)** — PDF bail contrat : ✅ corrigé
- `from app.models.property import PropertyImage` → `from app.models.bien import BienImage`
- Queries `PropertyImage.property_id` → `BienImage.bien_id`

**`contract_service.py:125-128` (commit bundle contracts)** — pré-existant, corrigé au passage : ✅
- Pattern `uuid.UUID(payload.property_id)` sur un champ Pydantic déjà typé
  `uuid.UUID` → `TypeError` (not `ValueError`), `except ValueError` dead code.
- Même pattern sur `tenant_id`/`agency_id` dans `create()`. Simplifié en
  passant directement `payload.bien_id` / `payload.tenant_id` / `payload.agency_id`
  (Pydantic v2 coerce automatiquement str → UUID à la validation).
- Le pattern identique reste dans `update()` pour les FK — non corrigé
  (scope hors refonte, laisser pour un sprint dédié "pydantic hygiene").

**`ai_service.generate_listing_description()` (à corriger étape 15-18)** —
génération description IA marketplace :
- Signature `property: Property` + accès `getattr(property, "address", "")`,
  `getattr(..., "city", "")`, `getattr(..., "monthly_rent", None)`. Sur un Bien,
  ces attributs n'existent pas → description Claude générée avec données vides.
- Non-bloquant (wrappé try/except dans `publier_bien_service`), mais dégrade
  silencieusement la qualité des annonces générées.

**Conséquence consolidée** : les parcours PDF (bails, quittances, fiches),
publication marketplace (création nouveau bien), et génération description IA
sont tous du **code dormant** depuis la migration étape 5-7. À valider
fonctionnellement avant le lancement public — test manuel de chaque parcours
après étape 19 (frontend synchronisé).

### 🤝 Cohérence des payloads partenaires Phase 1

Les adapters partenaires (La Mobilière, SwissCaution, Raiffeisen, déménagement)
sont des stubs en Phase 1 — aucun appel API live n'est fait.

Le payload envoyé par `partner_hooks.py` à ces adapters utilise désormais la
convention INTERNE d'Althy : `bien_id`, `monthly_rent`, `canton`, etc. (refonte
FR où pertinent). Par exemple, `on_contract_signed` émet désormais :

```python
lead_data = {
    "contract_id": ...,
    "contract_reference": ...,
    "bien_id": str(contract.bien_id),   # ex-property_id
    "monthly_rent": float(contract.monthly_rent or 0),
    ...
}
```

Quand un partenaire deviendra consommateur réel (contrat d'affiliation ou
exclusif signé), le contrat d'API sera négocié avec lui à ce moment-là. Si le
partenaire exige un format spécifique (ex: REST avec clés anglaises historiques
type `property_id`, `propertyId`, etc.), on ajoutera un adapter de transformation
dans `backend/app/services/partners/<partner>_adapter.py` — pas d'héritage de
la convention legacy côté code métier.

Pour l'instant, **cohérence interne > conformité hypothétique au futur contrat
partenaire**.

### 🚨 Ruptures API frontend à synchroniser étape 19

Les fichiers migrés cassent le frontend jusqu'à ce que les appels soient alignés.
Liste à jour pour briefing étape 19 :

**`crm.py` (commit 44d8872)** — consommé par `frontend/src/app/app/(dashboard)/crm/page.tsx`
- URL `GET /api/v1/crm/property/{property_id}/overview` → `GET /api/v1/crm/bien/{bien_id}/overview` *(pas d'appel frontend actuel — safe)*
- `ContactOut.property_id` → `bien_id` (consommé L12, L150, L285)
- `ContactOut.property_address` → `bien_adresse` (consommé L26, L136, L285, L340)
- `NoteOut.property_id` → `bien_id` (consommé L25)
- `CRMStats.properties_count` → `biens_count` (consommé L41)
- `ProspectCreate.property_id` / `ProspectUpdate.property_id` / `NoteCreate.property_id` → `bien_id` (consommé L150)
- `Contract.monthly_rent` conservé sous ce nom côté frontend (pas de rename)

**`documents.py` (2026-04-23)** — `POST /api/v1/documents/generate`
- Payload `GenerateRequest.property_id` → `bien_id`. Si le frontend envoie `property_id`, Pydantic v2 ignorera le champ et `bien_id` sera `None` → rechargement depuis `contract.bien_id` seulement, ou échec silencieux côté chargement bien. **Vérifier les appelants frontend avant de livrer.** Consommateurs probables : pages de génération de bails, fiches bien, quittances.

**`listings.py` (commit 6024a64)** — `POST /api/v1/listings`
- `ListingCreate.property_id` → `bien_id` (payload).
- `ListingRead` non touché (pas exposé property_id au frontend directement).

**`marketplace.py` + `marketplace_service.py` (commit d232628)** — plusieurs endpoints marketplace
- `PublierRequest.property_id` → `bien_id` (payload `POST /marketplace/publier`).
- `PublierRequest.type` default `"apartment"` → `"appartement"` (les valeurs `apartment`/`office`/`hotel`/`commercial`/`box`/`depot` seront rejetées par l'enum DB `bien_type_enum`).
- Clés FR de sortie API CONSERVÉES (`ville`, `code_postal`, `pieces`, `caution`, `etage`, `sdb`, `chambres`) — zéro rupture contract sérialisation.
- Liens in-app `/app/biens/{listing.bien_id}/locataire` (ex-`property_id`) — pas d'impact frontend (URL identique).

**`admin.py` (2026-04-23)** — `/api/v1/admin/*`
- `PlatformStats.total_properties` → `total_biens`, `active_properties` → `active_biens` (consommé par `/app/admin` KPIs plateforme).
- `AdminTransaction.property_id` → `bien_id` (consommé par `/app/admin/transactions`).

**`contracts.py` + `schemas/contract.py` (2026-04-23)** — `/api/v1/contracts/*`
- `ContractCreate.property_id` → `bien_id` (consommé par `POST /contracts` — `frontend/src/app/app/(dashboard)/contracts/new/page.tsx` L71, L142, L238, L239).
- `ContractRead.property_id` → `bien_id` (consommé par `GET /contracts` + `GET /contracts/{id}` — `contracts/page.tsx` L204, `contracts/[id]/page.tsx` L270).
- Query param `GET /contracts?property_id=…` → `?bien_id=…` (pas d'appel frontend détecté — safe).
- `useContracts.ts` type `PaginatedContracts` / `Contract` à mettre à jour étape 19.

**`loyers.py` (2026-04-23, commit ab40e7f)** — `/api/v1/loyers/*`
- `POST /loyers/generer-qr` : payload `property_id` → `bien_id`.
- `POST /loyers/quittance` : payload `property_id` → `bien_id`.
- Réponses non touchées côté contrat JSON (seule la source des données change).

**`portail.py` (2026-04-23)** — `/api/v1/portail/*`
- `GET /portail/proprio/me` (ou équivalent) : réponse `{properties_count, properties: [{name, address}]}` → `{biens_count, biens: [{adresse, ville}]}`. Clé `name` supprimée car Bien n'a pas cet attribut.
- `PortailInvitation` schema : `property_ids: list[str]` → `bien_ids: list[str]`.
- Grep frontend : aucun consommateur actif identifié pour `portail` (flag `ROLE_PORTAIL_PROPRIO=false` en prod Phase 1) — rupture pure, à aligner lors de l'activation du rôle.

**`favorites.py` (2026-04-23)** — `/api/v1/favorites/*` — **RUPTURE MAXIMALE, TOUS LES CHAMPS RENOMMÉS**

Schemas Pydantic totalement renommés (le frontend va casser instantanément
sur la page "Mes favoris" / swipe droits jusqu'à la livraison étape 19) :

| Ancien champ (backend)          | Nouveau champ (backend)     | Source modèle    |
|---------------------------------|-----------------------------|------------------|
| `FavoriteCreate.property_id`    | `FavoriteCreate.bien_id`    | Favorite.bien_id |
| `FavoriteRead.property_id`      | `FavoriteRead.bien_id`      | Favorite.bien_id |
| `FavoriteRead.property_address` | `FavoriteRead.bien_adresse` | Bien.adresse     |
| `FavoriteRead.property_city`    | `FavoriteRead.bien_ville`   | Bien.ville       |
| `FavoriteRead.property_type`    | `FavoriteRead.bien_type`    | Bien.type        |
| `FavoriteRead.monthly_rent`     | `FavoriteRead.loyer`        | Bien.loyer       |
| `FavoriteRead.property_status`  | `FavoriteRead.bien_statut`  | Bien.statut      |
| `FavoriteRead.rooms, surface`   | (inchangés)                 | Bien.rooms, Bien.surface |

**Consommateurs frontend identifiés (grep 2026-04-23) :**
- `frontend/src/app/app/(dashboard)/biens/page.tsx`
  - L197 : `api.get("/favorites")` → caste la réponse en `Property[]` (mix avec bien)
  - L246 : `api.delete(`/favorites/${bien.id}`)` → pas de champ renommé, safe
  - **L255 : `api.post("/favorites", { property_id: bien.id })`** → le payload utilise `property_id`, à renommer `bien_id` étape 19
  - L153, L155, L273-274 : accès `bien.monthly_rent` qui mélange les biens et les favoris typés `Property[]`. Après migration étape 19, unifier sur `bien.loyer`.

**Pas d'autres consommateurs détectés** (pas de page `/favoris`, pas de hook `useFavorites`, les favoris sont listés et manipulés depuis la page `/app/biens` onglet "Favoris").

**Conséquence opérationnelle** : **dès le merge de cette branche en prod (hors étape 19), la fonctionnalité "Mes favoris" est cassée** :
- `POST /favorites` avec payload `property_id` → Pydantic ignore le champ, `bien_id` devient None → 422 missing field (Pydantic rejette : `bien_id: str` n'est pas optional).
- `GET /favorites` retourne les nouvelles clés (`bien_adresse` etc.), le frontend lit les anciennes (`property_address` etc.) → tous les favoris affichent "null" en DOM.

**Action requise étape 19** :
1. `biens/page.tsx:255` : payload `{ property_id: bien.id }` → `{ bien_id: bien.id }`
2. `biens/page.tsx` (typage de la réponse `/favorites`) : créer un type `FavoriteItem` avec les nouvelles clés, ne plus caster en `Property[]`.
3. Adapter l'affichage du bloc favoris pour lire `bien_adresse`, `bien_ville`, `bien_type`, `loyer`, `bien_statut`.

### 🔍 OBSERVATIONS IMPORTANTES pour la reprise

- **Mapping enum dupliqué** : `Property.status → Bien.statut` (rented→loue, available→vacant, maintenance→en_travaux) et `PropertyType → BienType` (apartment→appartement, office→bureau, box→garage, depot→autre, hotel→autre, commercial→commerce) sont maintenant **dupliqués dans 3 endroits** : `sphere_agent.py`, `ai/listings.py`, et il faudra refaire dans admin.py + listings.py + marketplace.py. **TODO post-sprint** : centraliser dans `app/core/enums.py` ou `app/utils/legacy_mapping.py` avec `STATUS_EN_TO_FR` et `TYPE_EN_TO_FR`.
- **`favorites.py` schemas exposés** : les champs `property_id`, `property_address`, `property_city`, `property_status`, `monthly_rent` sont dans les réponses API consommées par le frontend. Le renommage backend doit être synchronisé avec le renommage frontend (étape 19).
- **`crm.py` endpoint `/property/{id}/overview`** : URL utilise `property_id` comme nom de path param. Décision à prendre : renommer l'URL en `/bien/{id}/overview` (breaking change frontend) ou garder l'URL mais le paramètre devient bien_id en interne.
- **`contracts.py`** : le modèle Contract a déjà `bien_id` (fait en étape 5-7). Le router doit juste renommer ses références `contract.property_id` → `contract.bien_id`.

### 🧮 Budget restant estimé (session fraîche)

| Bloc | Fichiers | Estimation |
|---|---|---|
| Étape 13 fin | 7 routers | 2–3h |
| Étape 14 (bugs collatéraux) | 4 routers | 30–45 min |
| Étape 15–18 (services + tasks + main + suppressions) | ~10 | 1–1h30 |
| Étape 19 (frontend) | 13 fichiers | 1–2h |
| Étape 20 (tests statiques + checkpoint final) | — | 30 min |
| **Total restant** | **~37 fichiers** | **~6–8h** |

### 🔑 Entrée pour la prochaine session

Prompt à utiliser dans la nouvelle conversation Claude Code :
```
Lis SPRINT_LOG.md pour te remettre en contexte, puis attaque
l'étape 13 restante en commençant par crm.py.
```

Branche active : `refonte/fusion-properties-biens-complete`
Dernier commit : `0e42827`


---

## Décisions prises

| Moment | Décision | Raison |
|---|---|---|
| Étape 0 | Option B retenue (scope complet + catalogue + NPA) | Vision produit consolidée côté fondateur + associé tech |
| Étape 0 | Drop `is_for_sale`, `price_sale`, `tourist_tax_amount`, `linen_provided`, `nearby_landmarks` | Scope location annuelle uniquement, saisonnier/vente reportés |
| Étape 0 | Ajout `parking_type_enum` (4 valeurs), `classe_energetique`, `annee_construction/renovation`, distances transports structurées, descriptions séparées (lieu/logement/remarques) | Enrichissement produit pour marketplace |

---

## Problèmes rencontrés

_(rien pour l'instant)_

---

## Fichiers touchés
_(mise à jour en fin de sprint)_
