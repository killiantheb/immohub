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

### Étape 14 — Bugs collatéraux 🛑

- `loyers.py:105, 215, 253, 334, 359` — properties → biens, address → adresse, monthly_rent → loyer
- `interventions_althy.py:102-106` — properties → biens, address → adresse
- `rgpd.py:57, 60, 129` — type_bien → type, loyer_mensuel → loyer
- `portail.py:337, 446` — mêmes corrections

### Étape 15-18 — Services + tasks + main + suppressions 🛑

- 5 services : ai_service, contract_service, marketplace_service, transaction_service (+ supprimer property_service)
- 2 tasks Celery : rent_tasks.py (3 occurrences), notifications.py (2 occurrences)
- main.py : supprimer import properties + include_router, ajouter catalogue_router
- core/security.py:291 : import local Property
- 4 suppressions : models/property.py, routers/properties.py, services/property_service.py, schemas/property.py

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
