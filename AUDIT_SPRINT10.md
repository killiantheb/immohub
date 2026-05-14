# Audit pré-Sprint 10 — Althy

**Date :** 2026-05-14
**Auditeur :** Claude Code (lecture seule, aucun commit pendant l'audit)
**Branch :** `main` (HEAD `13befc2`)
**Dernière migration appliquée :** `0050_unify_iban_sources` (50 fichiers `.py` dans `backend/alembic/versions/`, head = `0050`)
**Sprint cible :** Sprint 10 — Bail + CGUL + Skribble + EDL + Approbation propriétaire (Plan A)
**Note structure repo :** le brief mentionnait `apps/api/src/...` — la structure réelle est `backend/app/` + `frontend/src/`. Tous les chemins de ce rapport référencent la structure réelle.

---

## Synthèse exécutive

- **État global : 🟡 jaune** — fondations solides (Contract étoffé, EDL JSONB+PDF, magic_links réutilisables, palette Prussian+Or appliquée, doctrine §B.10/§B.12/§B.13 respectée Sprint 8). **Mais 3 chocs doctrinaux** à arbitrer avant de coder.
- **Refacto AVANT Sprint 10 ?** OUI partiellement. Pas une refonte mais 3 normalisations préalables (cf §Recommandations).
- **Risques top 3** :
  1. **🔴 Choc doctrinal Skribble Phase 1.0** — migration 0049 + countersign UI documentent EXPLICITEMENT « Skribble = Phase 1.1 ». Le brief Sprint 10 ramène Skribble à Phase 1.0. § B.15 STOP : confirmation Killian requise + entrée backlog doctrinal.
  2. **🔴 Choc doctrinal « mandat agence ↔ propriétaire »** — § B.7 dit Phase 1.0 = `proprio_solo + locataire + super_admin` uniquement. Le brief introduit `mandat_de_gestion` agence-propriétaire. § B.15 STOP : confirmation Killian.
  3. **🟡 Architecture SignableDocument polymorphe** vs existant non-polymorphe (signatures hardcodées sur `Contract`). Effort migration = L (300-500 LOC) + risque retro-compat sur baux Sunimmo déjà migrés.
- **Effort total estimé : L** — pas XL parce que ~60 % de l'infra est déjà là (PDF stack, palette, magic_links, EDL JSONB, RBAC, storage, Resend abstraction, role agence partiellement câblé).

---

## 1. Modèle Contract

### 1.1 Existant — `backend/app/models/contract.py`

**Table :** `contracts` (déclarée en migration `0001_initial_schema`, fortement étendue par `0005_document_generation_extended_fields` et `0049_contract_countersign_link`).

**Migrations touchant `contracts` :**
- `0001_initial_schema.py` — création initiale
- `0002_add_missing_columns.py`
- `0005_document_generation_extended_fields.py` — **30+ colonnes USPI/CO ajoutées** (cf détail ci-dessous)
- `0012_bp_missing_tables.py`
- `0029_fusion_properties_biens_complete.py` — fusion `properties` → `biens`, refs Contract maj
- `0049_contract_countersign_link.py` — `tenant_signed_at`, `tenant_signed_ip`, `locataires.current_contract_id` FK

**Colonnes existantes (extrait des plus pertinentes pour Sprint 10) :**

| Champ | Type | Source | Couvre cible Sprint 10 ? |
|---|---|---|---|
| `reference` | `String(50)` unique | 0001 | référence bail (CTR-202501-XXXX) |
| `owner_id`, `bien_id`, `tenant_id`, `agency_id` | UUID FK | 0001 + 0049 | relations |
| `type` | enum `long_term/seasonal/short_term/sale` | 0001 | ✓ |
| `status` | enum `draft/active/terminated/expired` | 0001 | ✓ |
| `start_date`, `end_date`, `terminated_at` | DateTime | 0001 | ✓ |
| `monthly_rent`, `charges`, `deposit` | Numeric | 0001 | ✓ |
| `signed_at` + `signed_ip` | DateTime + String | 0001 | bailleur (Sprint 8) |
| `tenant_signed_at` + `tenant_signed_ip` | DateTime + String | **0049** | locataire (Sprint 8) |
| `notice_period_months` | Integer (default 3) | 0005 | = `preavis_mois` ✓ |
| `notice_deadline_date` | DateTime | 0005→modèle | ⚠️ déclaré `String(50)` en 0005 mais typé `DateTime` en modèle — **incohérence type** |
| `cpi_index_ref` | Numeric(8,2) | 0005 | = `indice_ipc_base` ✓ |
| `mortgage_rate_ref` | Numeric(5,3) | 0005 | = `taux_hypothecaire_reference` ✓ |
| `deposit_type` | String(20) default `gocaution` | 0005 | partiellement = `garantie_type` (enum à étendre : `caution_bancaire`, `assurance`, `espèces`) |
| `bank_iban`, `bank_name`, `bank_bic` | String | 0005 | compte LOYER (≠ garantie_iban) |
| `occupants_count` | Integer | 0005 | = `nombre_occupants` ✓ (anti-doublon §C) |
| `tenant_nationality` | String(50) | 0005 | ✓ |
| `signed_at_city`, `canton` (default VS) | String | 0005 | ✓ |
| `subletting_allowed`, `animals_allowed`, `smoking_allowed`, `linen_fee_included`, `is_furnished`, `is_for_sale` | Boolean | 0005 | clauses ✓ |
| `cleaning_fee_hourly`, `reminder_fee`, `late_interest_rate`, `early_termination_fee`, `tourist_tax_amount`, `partial_period_days`, `partial_period_rent` | Numeric | 0005 | clauses CO ✓ |
| `payment_day` (default 5), `deposit_payment_deadline_days` (default 10), `payment_communication` | mixed | 0005 | ✓ |

**Indexes :** `reference`, `owner_id`, `bien_id`, `tenant_id`, `agency_id`, `status`, `type`, `start_date`.

**Hybrid property :** `Contract.fully_signed` → `bool(signed_at) and bool(tenant_signed_at)` (`contract.py:110-113`).

**Hooks Sprint 8 :**
- `backend/app/services/loyer_activation.py:activate_first_rent` posé après contre-signature → crée la 1re `LoyerTransaction` + lie `locataires.current_contract_id`.
- `backend/app/services/partner_hooks.py:on_contract_signed` (best-effort assurance partner).

**Workflow API :**
- `POST /contracts` (proprio_solo, agence, super_admin)
- `POST /contracts/{id}/sign` — bailleur
- `POST /contracts/{id}/countersign` — locataire (strict `tenant_id == current_user.id`)
- `GET /contracts/{id}/pdf` — fpdf2 + palette Prussian/Or, footer HBM Swiss Sàrl

**Tables existantes liées (héritage Sprint 5, dormantes ?) :**
- `document_templates` (migration 0005) — `template_type` + `content_html` + `variables_used` JSON + `agency_id` + `language`. **Statut Sprint 10 : à confirmer encore utilisée ou dormante** (cf `__init__` modèles : aucun fichier `document_template.py` → table sans modèle SQLAlchemy = legacy).
- `generated_documents` (migration 0005) — `template_type` + `contract_id` + `content_html`. Idem statut à confirmer.

### 1.2 Gaps vs cible Sprint 10

| Champ brief | Statut | Effort |
|---|---|---|
| `renouvellement_mois` | ❌ manquant | S |
| `preavis_mois` | ✅ = `notice_period_months` | — |
| `indice_ipc_base` | ✅ = `cpi_index_ref` | — |
| `taux_hypothecaire_reference` | ✅ = `mortgage_rate_ref` | — |
| `reserve_hausse_motif` (text) | ❌ manquant | S |
| `reserve_hausse_montant` (decimal) | ❌ manquant | S |
| `garantie_type` (enum 3 vals) | 🟡 `deposit_type` String(20) — **à convertir en enum strict + étendre** | M |
| `garantie_montant` | 🟡 `deposit` existe (Numeric(12,2)) — sémantique à clarifier (deposit ≠ garantie ?) | S |
| `garantie_iban` | ❌ manquant (≠ `bank_iban` qui est compte loyer) | S |
| `conditions_particulieres` | ❌ manquant (`Text`) | S |
| `locataire_etat_civil` (enum 5 vals) | ❌ manquant | S |
| `nombre_occupants` | ✅ = `occupants_count` (**ANTI-DOUBLON §C**, ne pas recréer) | — |
| `logement_familial_principal` | ❌ manquant (Boolean, important CO 266m-266n) | S |
| `ancien_locataire` (String) | ❌ manquant | S |
| `cgul_signed_at` | ❌ manquant | S |
| `template_type` (enum `sunimmo_v1`, `uspi_v1`) | ❌ manquant sur `contracts` — existe sur `document_templates` (legacy ?) | S |

**Migration 0052 cible :** ~10 colonnes neuves + 1 conversion enum `deposit_type` → 1 fichier `.py` Alembic. Effort migration = **M**.

### 1.3 Risques

- **Incohérence type `notice_deadline_date`** : 0005 le crée en `String(50)`, le modèle le déclare `DateTime`. Soit une migration intermédiaire l'a converti (à vérifier), soit le modèle ment au schema réel → bug latent au commit DB.
- **Sémantique `deposit` vs `garantie_*`** : le modèle a déjà `deposit` Numeric + `deposit_type` String + `deposit_payment_deadline_days`. Sprint 10 veut introduire `garantie_montant` + `garantie_iban` + `garantie_type` enum. Soit on RENOMME `deposit*` → `garantie*` (breaking, requiert update du PDF builder + du QR-facture), soit on ajoute en parallèle (doublon §C). **Décision à arbitrer** dans le sprint planning.
- **Tables `document_templates` / `generated_documents` dormantes** : créées migration 0005 mais aucun modèle SQLAlchemy ne les expose. Si Sprint 10 introduit un nouveau `signable_documents`, on cumule 3 tables document → **dette schema** sauf si on les drop/réutilise.

---

## 2. Génération PDF

### 2.1 Stack actuelle

- **Lib :** `fpdf2 >= 2.7.9` (cf `backend/requirements.txt:34`). **PAS WeasyPrint**, pas ReportLab, pas Jinja2 pour PDF.
- **Pas de templates HTML PDF** — tous les PDFs sont construits en Python pur (`pdf.cell()`, `pdf.multi_cell()`, `pdf.rect()`).
- **Police core :** `Helvetica` (latin-1 only, requiert `sanitize_for_pdf()` pour les caractères Unicode hors latin-1).
- **Helper partagé :** `backend/app/services/_pdf_utils.py` (`sanitize_for_pdf` aka `_s`).

### 2.2 Documents PDF actuellement générés

| Document | Service | Source de vérité | Palette §B.4 |
|---|---|---|---|
| Contrat de bail | `contract_service.py:_build_pdf` | `Contract` row | ✅ Prussian + Or |
| Quittance art. 88 CO | `quittance.py:generate_quittance_pdf` | params explicites | ⚠️ **violation §B.4** : `set_draw_color(232, 96, 44)` orange terracotta legacy (ligne 46) |
| QR-facture | `qr_facture.py:generate_qr_bill_pdf` | `LoyerTransaction` | ✓ |
| EDL entrée/sortie | `pdf_edl_service.py:render_edl_pdf` | JSONB `changements_locataire.edl_entree`/`edl_sortie` | ✓ (sobre, pas de palette pour l'instant) |
| Documents génériques | `documents.py` router | `document_templates` ? | à vérifier |

### 2.3 Réutilisabilité Sprint 10

- ✅ Pattern « builder Python » réplicable pour avenant, résiliation, mandat de gestion, CGUL.
- ✅ Footer HBM Swiss Sàrl via `settings.ALTHY_CREDITOR_*` (§B.3 respecté).
- ✅ Image cover bien intégrée (cf `contract_service.py:230-253`).
- ⚠️ **Photos EDL non embed** — actuellement référencées en texte seul (`pdf_edl_service.py:259-267`). Sprint 10 EDL avec photos par pièce nécessitera embed → fpdf2 sait gérer `pdf.image()` mais avec download HTTP timeout (cf pattern `contract_service.py:330-338`).
- ❌ **Pas de slot signature Skribble** dans aucun PDF — emplacement à introduire (page dédiée fin de PDF avec coordonnées Skribble pour overlay signature visuelle).

### 2.4 Gaps

| Item | Effort |
|---|---|
| Template `bail_uspi_v1` (6 pages CO) | L |
| Template `avenant_v1` | M |
| Template `resiliation_v1` (forme écrite CO 266l, SEQ slot) | M |
| Template `mandat_gestion_v1` | M (**§B.15 STOP — cf risque** ) |
| Template `cgul_v1` | S (texte légal stable) |
| EDL entrée/sortie : embed photos par pièce | M |
| Convergence Quittance vers palette Prussian/Or (§B.4) | S |
| Decision : factoriser un `_AlthyPdfBase(FPDF)` partagé (header/footer/palette) | M |

---

## 3. Signature existante (Sprint 8 Lot A)

### 3.1 Localisation

- Migration : `backend/alembic/versions/0049_contract_countersign_link.py`
- Modèle : `Contract.tenant_signed_at` + `tenant_signed_ip` + `Contract.fully_signed` hybrid (`backend/app/models/contract.py:64-65, 110-113`)
- Service : `backend/app/services/contract_service.py:sign` (bailleur), router countersign (locataire) `backend/app/routers/contracts.py:145-202`
- Hook post-signature : `backend/app/services/loyer_activation.py:activate_first_rent`
- UI locataire : `frontend/src/components/contracts/CountersignModal.tsx`
- UI bailleur : `frontend/src/app/app/(dashboard)/contracts/[id]/page.tsx`
- Hook React : `frontend/src/lib/hooks/useContracts.ts` (`useCountersignContract`)

### 3.2 Compatibilité avec `SignableDocument` polymorphe

**NON compatible en l'état.** Les preuves :

- `signed_at` / `signed_ip` / `tenant_signed_at` / `tenant_signed_ip` sont **des colonnes directes** sur `contracts` (pas une FK vers une table `signatures`).
- Aucune table `signatures` ou `signable_documents` n'existe (grep dans `models/` + migrations confirmé).
- L'endpoint `/countersign` mute directement `contract.tenant_signed_at` — un futur `SignableDocument` polymorphe devrait introduire une table `signatures(document_id, document_type, signer_id, signed_at, ip, ...)` puis dénormaliser un mirroir vers `Contract.fully_signed` ou bouger `fully_signed` côté `SignableDocument`.

### 3.3 Choc doctrinal explicite à arbitrer

🔴 **La migration 0049 dit textuellement** (lignes 12-14, 25-27) :

> « preuve d'acceptation contractuelle horodatée — §B.10 honnête, pas une signature électronique qualifiée Skribble qui est **Phase 1.1** »
>
> « champ « tenant_signed_at » et non « tenant_signed_es » — on ne prétend pas faire de signature électronique qualifiée en Phase 1.0. »

Le router countersign (`contracts.py:135, 157`) le redit, et `CountersignModal.tsx:15` aussi (« Skribble = Phase 2+ »).

**Le brief Sprint 10 introduit Skribble en Phase 1.0** — c'est un changement de doctrine non encore validé dans `docs/2-ROADMAP.md` §2.4.5. Procédure §B.15 STOP recommandée AVANT de coder le moindre webhook Skribble.

### 3.4 Effort migration si on bascule sur SignableDocument polymorphe

- **Backend :** introduire table `signable_documents` + `signatures` (M+M), migrer `Contract.signed_at`/`tenant_signed_at` → relation via Sql trigger ou backfill applicatif (M), refacto `loyer_activation` qui lit `contract.tenant_signed_at` (S), refacto `contract_service.sign` / `countersign` (M).
- **Frontend :** refacto `CountersignModal` pour POST `/signable-documents/{id}/sign` au lieu de `/contracts/{id}/countersign` (S).
- **Données prod :** combien de baux Sunimmo déjà migrés avec signed_at posé ? À vérifier via `SELECT count(*) FROM contracts WHERE signed_at IS NOT NULL` AVANT de coder le backfill. **Risque retro-compat S si N petit (<50), M si N > 200.**

**Effort total refacto polymorphe = L (300-500 LOC + tests).**

### 3.5 Recommandation §3

**Option pragmatique** : NE PAS migrer Sprint 8 vers polymorphe. Étendre `Contract` avec les nouveaux champs Skribble (`skribble_session_id`, `skribble_signed_at`, `skribble_signers JSONB`, `skribble_pdf_url`). Pour avenant/résiliation/mandat/EDL, dupliquer le pattern sur leurs tables respectives (Avenant nouvelle table M, Resiliation nouvelle table M, Mandat nouvelle table M, ChangementLocataire existant + champs M). C'est plus de schema mais zéro refacto Sprint 8 + zéro risque baux Sunimmo.

**Option polymorphe propre** : faire la refacto. Effort XL totalisé (refacto + 4 nouvelles tables + 6 templates + Skribble + approbation + tests). **Risque planning** vs gate Sunimmo 01/06/2026 (J-17 au moment de l'audit).

---

## 4. Candidature locataire + dossier + approbation propriétaire

### 4.1 Existant

**Table `candidatures`** (`backend/app/models/candidature.py`) :
- Liée à `listings` (marketplace publique Phase 2) + `users` (locataire)
- Statut : `en_attente`, `documents`, etc.
- `score_ia` + `score_details` JSONB → **§B.15 INTERDIT en écriture Phase 1.0**
- `owner_fee_amount` Decimal default `45.00` + `owner_fee_stripe_intent_id` → **§B.15 INTERDIT en écriture Phase 1.0** (frais CHF 45 = candidature marketplace)
- Champs `frais_payes`/`stripe_pi_id` legacy CHF 90 locataire (gelés)
- `visite_proposee_at` + `ouvreur_id` → workflow ouvreur Phase 2

**Statut Sprint 10 : `candidatures` = scope marketplace publique Phase 2.** Ne PAS toucher en écriture en Phase 1.0 (§B.15). Le flag backend `BACKEND_FLAG_CANDIDATURES` default `False`.

**Table `locataires` + `dossiers_locataires`** (`backend/app/models/locataire.py`) :
- ✓ Module Dossier Phase 1.0 livré Sprint 1-3 (cf migrations 0041 `documents_dossier`, 0042 `cosignataires`, 0043, 0046 `proposition`)
- `cosignataires` JSONB array (conjoint signataire, enfants occupants) — **important pour Sprint 10** : si bail signé par couple, cosignataires côté Skribble = `locataire.cosignataires`
- `renseignements_complets` boolean + completed_at — étape 1 dossier
- `loyer_caution_verses` boolean — étape 10 dossier
- `statut_proposition` enum (5 valeurs) — workflow back-and-forth **plafonné à 4 tours** (cf migration 0046)

**Workflow invitation locataire (Phase 1.0 valide §B.15) :**
- Pattern `magic_links` table (réutilisable !) — `backend/app/routers/biens_invitations.py`
- Token urlsafe 32 bytes, expires 7 jours, type=`invitation`, target_role=`locataire`, payload JSONB
- Endpoints : POST `/biens/{id}/inviter-locataire`, GET `/biens/{id}/invitations`, DELETE `/invitations/{id}`, GET `/invite/{token}/preview` (public no-auth)
- Idempotent (dedup sur email + bien_id pending)
- Email Resend via template `invitation_locataire.html`/.txt
- Sender name dynamique (option Z : `agency_settings.agency_name` > `first_name+last_name` > `Althy` fallback)

**Pas de table `proprios` distincte des `users`.** Tous les acteurs (proprio_solo, locataire, agence) sont dans `users` avec `role` enum (cf §5).

### 4.2 Gaps « approbation propriétaire » Sprint 10

| Cas | Existant Phase 1.0 ? | Effort |
|---|---|---|
| Locataire saisit son dossier complet (10 étapes) | ✅ existant Sprint 1-3 | — |
| Bailleur reçoit notif que dossier 100 % complet | partiel (étape 10 `mark_loyer_caution_verses`) — pas de notif email centralisée | S |
| Bailleur valide candidat (approbation) | ❌ pas d'endpoint dédié | M |
| Notification approbation propriétaire (si proprio ≠ agence) | ❌ inexistant | M |
| Magic link approbation (proprio sans compte) | 🟢 réutilisable depuis `magic_links` pattern → `type='approbation_dossier'` | S |
| Page publique `/approuver/{token}` (no-auth) | ❌ à créer côté frontend | M |
| Audit log approbation (qui, quand, IP) | ❌ à ajouter | S |

### 4.3 Question doctrine §B.15

Le brief mentionne « approbation propriétaire en amont via clic interne app, magic link ». **À CLARIFIER avec Killian** :

- **Interprétation A (OK §B.15) :** approbation propriétaire = workflow où le bailleur (`proprio_solo`) approuve un candidat **issu d'une invitation** (déjà rattaché au bien via `magic_links` `type='invitation'`). Pas de candidature spontanée. ✓
- **Interprétation B (INTERDIT §B.15) :** approbation propriétaire = candidat marketplace publique → bailleur valide → frais CHF 45 → bail. Tous les ingrédients de la marketplace Phase 2.

**Procédure §B.15 STOP recommandée : confirmer interprétation A avant de coder.**

### 4.4 Risques

- Si interprétation A : architecture solide, magic_links + Resend déjà là. Effort S+M.
- Si interprétation B : refacto majeure + obligations légales (LCD, RGPD prospects). Effort XL + dette compliance.
- Workflow `dossiers_locataires.statut_proposition` (4 tours plafond) déjà fournit un précédent de back-and-forth bailleur ↔ locataire — **pattern réutilisable pour Sprint 10 approbation**.

---

## 5. RBAC — rôles, permissions, mandat agence

### 5.1 Existant

**Enum `UserRole`** (`backend/app/models/user.py:13-25`) :
- 10 valeurs : `proprio_solo`, `agence`, `portail_proprio`, `opener`, `artisan`, `expert`, `hunter`, `locataire`, `acheteur_premium`, `super_admin`
- Default = `proprio_solo`

**Inscription publique** (`backend/app/core/config.py:178`) :
- `ALLOWED_SIGNUP_ROLES: list[str] = ["proprio_solo"]` — seul `proprio_solo` peut se créer un compte via `/auth/register`
- Locataire arrive via `/onboarding/rejoindre` (token magic_link)
- Autres rôles : Phase 2/3, liste d'attente

**Feature flags backend** (`config.py:183-208`) :
- `BACKEND_FLAG_CONTRACTS: bool = False` ← **gating /api/v1/contracts/* (= 503 si OFF)**
- `BACKEND_FLAG_AGENCE: bool = False` ← gating /api/v1/companies, /api/v1/agency
- `BACKEND_FLAG_CRM: bool = False`
- `BACKEND_FLAG_INTEGRATIONS: bool = False`
- `BACKEND_FLAG_CANDIDATURES: bool = False`
- `BACKEND_FLAG_AI_SCORING: bool = False`
- `BACKEND_FLAG_MATCHING: bool = False`
- `BACKEND_FLAG_MARKETPLACE: bool = False`
- … (12 flags Phase 2/3)

**Permission contracts** (`backend/app/routers/contracts.py:58`) :
- POST /contracts → `current_user.role in ("proprio_solo", "agence", "super_admin")` → **le rôle `agence` est ACCEPTÉ dans le code**, même si le flag `BACKEND_FLAG_AGENCE` est OFF par défaut.

**Permission invitation locataire** (`backend/app/routers/biens_invitations.py:50`) :
- `MANAGER_ROLES = {"super_admin", "proprio_solo", "agence"}`

### 5.2 Gap mandat de gestion agence-propriétaire (§B.7 conflict)

🔴 **§B.7 dit textuellement** :

> « Phase 1.0 = logiciel de gestion pure (doctrine 2026-05-09) — `proprio_solo` + `locataire` (via invitation uniquement) + `super_admin`. »

**Mais le code (§B.1 source de vérité) :**
- Accepte `agence` en POST /contracts
- Accepte `agence` en POST /biens/{id}/inviter-locataire
- Lit `agency_settings.agency_name` pour Sender name email (Sprint 9)
- `Contract.agency_id` FK existe sur le modèle
- Feature flag `BACKEND_FLAG_AGENCE = False` par défaut — mais activable côté env

**Lecture honnête : `agence` est un rôle « semi-Phase-1.0 » câblé mais pas signup-able publiquement.** La cible « migration Sunimmo Riviera » (§B.7) suggère que Sunimmo aura un compte `agence` provisionné en DB par super_admin → `agence` est implicitement Phase 1.0 pour Sunimmo seul.

**Sprint 10 « mandat de gestion » signaux à arbitrer :**
- Si « mandat de gestion » = document signé entre agence et propriétaire → introduit une nouvelle entité de signature → **conflict §B.15** (`Stripe Connect commission loyers (3-5%)` est explicitement interdit, et un mandat de gestion implique souvent commission).
- Si « mandat de gestion » = clause dans le bail Sunimmo (agence agit comme mandataire), sans nouveau document, sans commission tracking → potentiellement OK Phase 1.0.

**Procédure §B.15 STOP recommandée AVANT de coder le mandat de gestion.**

### 5.3 Permissions Sprint 10 à définir

| Action | Qui ? | Existant ? |
|---|---|---|
| Générer un bail | `proprio_solo`, `agence` (mandaté), `super_admin` | ✓ |
| Envoyer en signature Skribble | idem | ❌ |
| Contre-signer (locataire) | `tenant_id == current_user.id` | ✓ |
| Contre-signer (agence-mandataire) | nouveau | ❌ |
| Approuver candidature locataire | `proprio_solo` (owner du bien) | ❌ |
| Approuver via magic link (proprio sans compte) | token bearer | ❌ |
| Générer EDL | `proprio_solo`, `agence` | ✓ via changements_locataire |
| Vérifier mandat actif avant signature agence | nouveau | ❌ (pas de table `mandats`) |

### 5.4 Risques

- **Rôle `agence` n'a pas de gating de visibilité par défaut.** Si Sprint 10 active `BACKEND_FLAG_CONTRACTS=true` côté Railway sans activer aussi `BACKEND_FLAG_AGENCE=true`, des actions agence sur `/contracts` passeront mais des actions `/companies` retourneront 503. Cohérence à valider lors du déploiement.
- **Pas de table `mandats`** — Sprint 10 doit la créer si on accepte le mandat de gestion (effort M).
- **Magic link approbation propriétaire** : scope du bearer token à borner (lecture seule de la candidature visée + écriture statut approuvé/refusé/contre-proposé). Hardening à prévoir.

---

## 6. Notifications Resend

### 6.1 Existant

- Lib : `httpx` direct vers API Resend (pas SDK officiel)
- Service principal : `backend/app/services/email_service.py:send_email` — Resend prioritaire, fallback SMTP, fallback DEV log si pas de clé
- Service helper Resend audiences : `backend/app/services/resend_service.py` (audiences par rôle, contacts, transactional simple)
- Templates dir : `backend/app/templates/emails/`
- **§B.10 propre** : si Resend renvoie ≠ 2xx, on raise `EmailServiceError` → l'appelant fait 502, pas de silencieux
- Pas de queue Celery active pour emails (Celery installé en deps mais usage à vérifier sur `rent_tasks.py` cron)

**Templates existants :**
- `invitation_locataire.html` + `.txt` (Sprint 1B)
- `qr_facture_locataire.html` + `.txt` (Sprint 7)
- `contract_created.html` (Sprint 5 — statut d'usage à confirmer)
- `transaction_receipt.html`

**Sender name dynamique (§Z) :** `agency_settings.agency_name` → `first_name+last_name` → `Althy` (fallback `email_service.py:53-55`).

### 6.2 Templates à créer Sprint 10

| Template | Trigger | Effort |
|---|---|---|
| `approbation_proprietaire.html`/.txt | dossier locataire 100% → demande approbation owner | S |
| `signature_locataire.html`/.txt | bail prêt → lien Skribble pour locataire | S |
| `signature_agence.html`/.txt | bail prêt → lien Skribble pour agence-mandataire | S |
| `bail_signe.html`/.txt | tous signataires OK → notif locataire + bailleur | S |
| `bail_refuse_proprietaire.html`/.txt | proprio refuse candidat | S |
| `edl_a_remplir.html`/.txt | bail signé → locataire invité à co-remplir EDL entrée | S |
| `edl_sortie_a_planifier.html`/.txt | résiliation enregistrée → planning EDL sortie | S |
| `rappel_signature_pending.html`/.txt | J+3 sans signature | S |
| `resiliation_envoyee.html`/.txt | résiliation envoyée | S |

**Effort total templates = M** (9 templates × S unitaire).

### 6.3 Gaps infra

- **Pas de retry Celery sur send_email** — un échec ponctuel Resend 5xx fait remonter 502 au client. Pour les triggers async (post-signature webhook, post-EDL), il faudra wrapper l'envoi dans une task Celery avec retry. Effort = M.
- **Pas de gestion bounces** — Resend offre des webhooks bounce/delivered, non câblés. Sprint 10 peut s'en passer mais à ajouter au backlog post-Sunimmo.
- **Pas de unsubscribe transactionnel** — pas critique en B2B mais à anticiper pour les rappels.

---

## 7. Skribble — état zéro confirmé

### 7.1 Vérifications

- `grep -ri skribble` dans `backend/` → **zéro résultat code production**. Mentions uniquement dans :
  - `docs/4-PRODUIT.md`, `docs/2-ROADMAP.md`, `docs/6-LEGAL.md`, `docs/7-CATALOGUE-DONNEES-ALTHY.md` (documentation)
  - `backend/alembic/versions/0049_contract_countersign_link.py` (commentaire explicite « Phase 1.1 »)
  - `backend/app/services/contract_service.py:404` (commentaire « pas SES/QES, Skribble »)
  - `backend/app/routers/contracts.py:134, 157` (commentaires)
  - `frontend/src/components/contracts/CountersignModal.tsx:15` (commentaire « Phase 2+ »)
  - `frontend/src/app/app/(dashboard)/contracts/[id]/page.tsx` (commentaire)
- `grep SKRIBBLE` dans `backend/app/core/config.py` → **zéro variable env**
- `backend/requirements.txt` → **aucune lib signature** (`fpdf2` seulement)
- `.env.example` (à vérifier) → probablement aucune mention

### 7.2 Variables env à ajouter Sprint 10

```
SKRIBBLE_API_KEY=
SKRIBBLE_WEBHOOK_SECRET=
SKRIBBLE_ENVIRONMENT=sandbox  # sandbox | production
SKRIBBLE_RETURN_URL_BASE=https://althy.ch
SKRIBBLE_QUALITY_LEVEL=SES     # SES | AES | QES
```

### 7.3 Architecture à anticiper

- Auth Skribble : API key (HMAC sur certains endpoints). Pas OAuth2.
- Webhook endpoint : `POST /api/v1/webhooks/skribble` (à créer, similaire au pattern `stripe_webhooks.py` existant).
- États : `created` → `pending_signature` → `signed` (tous signataires) → `expired` ou `declined`.
- Skribble retourne le PDF signé (signature visuelle + cert horodatage) — à upload Supabase Storage en remplacement du PDF draft.

### 7.4 Gaps + effort

| Item | Effort |
|---|---|
| Variables env + config validation | S |
| Service `skribble_service.py` (create_session, get_status, download_signed_pdf) | M |
| Webhook receiver `/api/v1/webhooks/skribble` + verify HMAC | M |
| Mapping états Skribble → `Contract.status` / `SignableDocument.status` | M |
| Onboarding KYC Skribble (compte SES, dépend Skribble support time) | inconnu — **dépendance externe bloquante** |
| Tests sandbox Skribble | M |

**Total effort §7 = L.** Plan B essentiel (cf §Plan B).

---

## 8. Stockage PDF

### 8.1 Existant

- **Stack :** Supabase Storage via API REST (pas SDK Python). Service : `backend/app/services/storage.py`.
- **Buckets définis :**
  - `SUPABASE_BUCKET_BIEN_IMAGES = "property-images"` (legacy nom, biens.id)
  - `SUPABASE_BUCKET_BIEN_DOCUMENTS = "property-documents"`
  - `SUPABASE_BUCKET_EDL_PHOTOS = "edl-photos"` (privé, signed URLs)
  - **`storage.py:_BUCKET = "documents"` hardcodé** ← ⚠️ ne passe PAS par settings (anti-§C)
- **Structure clés :** `{user_id}/{bien_id}/{doc_type}_{mois}.pdf` (cf `storage.py:39`)
- **Permissions :** signed URLs via `/object/sign/{bucket}/{key}` (default 1h, customisé jusqu'à 14 jours pour QR-facture)

### 8.2 Gaps Sprint 10

| Item | Effort |
|---|---|
| Bucket dédié `signable-documents` (privé, signed URLs only) | S |
| Variabiliser `_BUCKET` via `settings.SUPABASE_BUCKET_SIGNABLE_DOCUMENTS` (§C anti-hardcode) | S |
| Structure clés : `{contract_id}/v1_draft.pdf`, `{contract_id}/v2_signed.pdf` (versioning) | S |
| Politique rétention 10 ans (CO art. 962) — pas de TTL auto Supabase Storage, à documenter | S |
| Permissions RLS sur bucket privé (qui peut lire la version signée) | M |
| Audit log accès PDF signé (qui a téléchargé quand) | M |

### 8.3 Risques

- **Pas de versioning auto** — si on régénère un PDF avant signature et qu'on upsert sur la même clé, on perd le brouillon. Naming explicite `v1_draft`, `v2_signed`, `v3_signed_skribble` recommandé.
- **Pas de quota visible** — Supabase Storage free tier = 1 GB. Avec 100 bails × 6 docs (bail + avenant éventuel + résiliation + mandat + EDL entrée + EDL sortie) × 2 MB en moyenne = ~1.2 GB. **À surveiller pour Sunimmo migration**.
- **Bucket public vs privé** — `property-documents` est probablement public (à confirmer). `signable-documents` DOIT être privé.

---

## 9. Cartographie d'impact §C — 8 surfaces

| Surface | Impact Sprint 10 |
|---|---|
| **UI Frontend** | Pages neuves : `/app/contracts/new` (wizard), `/app/contracts/[id]/sign` (préview + envoi Skribble), `/app/contracts/[id]/edl` (entrée + sortie), `/app/contracts/[id]/approuver-candidat`, page publique `/approuver/[token]`, page publique `/sign/[token]` (redirect Skribble). Refonte : `/app/contracts/[id]` (statuts Skribble, multi-signataires). Listes : `/app/contracts` (filtre statut signature). Mon Bien locataire : `/app/mon-bien` (bail + EDL à co-remplir). |
| **API** | Routes neuves : POST `/contracts/{id}/send-to-skribble`, POST `/webhooks/skribble`, POST `/contracts/{id}/approve-candidate`, POST `/contracts/{id}/edl/entree`, POST `/contracts/{id}/edl/sortie`, POST `/avenants`, POST `/resiliations`, POST `/mandats` (si §B.15 confirmé), POST `/cgul/accept`. Routes étendues : GET `/contracts/{id}` (champs Skribble), GET `/contracts/{id}/pdf` (version brouillon vs signée). |
| **PDF templates** | 6 nouveaux templates fpdf2 : `bail_uspi_v1` (6 pages), `avenant_v1`, `resiliation_v1` (forme écrite CO 266l + SEQ slot), `mandat_gestion_v1` (si §B.15 OK), `cgul_v1`, `edl_avec_photos_v1`. Factoriser `_AlthyPdfBase` partagé (header HBM, footer §B.3, palette Prussian/Or). |
| **Email Resend** | 9 nouveaux templates HTML+TXT (cf §6.2). Refonte `contract_created.html` si encore utilisé (statut à confirmer). |
| **Export CSV/Excel** | Ajouter colonnes `statut_signature_bailleur`, `statut_signature_locataire`, `statut_signature_agence`, `skribble_session_id` aux exports baux. Effort S. |
| **Stats Dashboard** | Widgets neufs : « Baux à signer (N) », « EDL en attente », « Taux signature 7j », « Approbations propriétaire pending ». Effort M sur dashboard cards. |
| **IA (sphère + Claude)** | Prompts à mettre à jour : `sphere_agent.py` doit savoir qu'un bail peut être en multi-statuts (`draft`, `pending_signature`, `signed_partial`, `fully_signed`, `expired_skribble`). Génération IA bail à partir du module dossier locataire complété (Sprint 10 ?). |
| **Cascades** | À auditer : `users` DELETE locataire → quid des `Contract.tenant_id` (`SET NULL` actuellement) + `SignableDocument` orphelin. `biens` DELETE → `Contract.bien_id RESTRICT` actuellement (bloque). `agencies` (users avec role=agence) DELETE → `Contract.agency_id SET NULL`. Vérifier qu'aucun bail signé Skribble n'orpheline un PDF Supabase. |

**Livrable §C recommandé :** `DATA_FLOW_SIGNABLE_DOCUMENTS.md` à rédiger dans le **Lot 7** du sprint (cf §Découpage), documentant les 8 surfaces avec détail action × état.

---

## 10. Dette technique bloquante / non-bloquante

### 10.1 Tests

- **Backend pytest** : 5 fichiers (`test_health`, `test_ai_service`, `test_flag_gating`, `test_intervention_service`, `test_payments`).
  - **Zéro test dédié `Contract` / signature / countersign / EDL / candidature.** Effort à ajouter = **M** (5-8 tests cibles : create, sign-bailleur, countersign-locataire, double-countersign-409, loyer_activation idempotent, PDF generation smoke).
- **Frontend E2E Playwright** : 6 specs (`autonomie-subscription`, `i18n`, `locataire-signalement`, `portail`, `proprio-onboarding`, `proprio-quittance`).
  - **Zéro E2E sur bail / signature.** Effort = **M** (1 spec end-to-end : proprio crée bail → invite locataire → locataire countersign → loyer généré).

### 10.2 Bugs / TODO connus liés au scope Sprint 10

| Item | Source | Effort |
|---|---|---|
| `notice_deadline_date` typage incohérent (String→DateTime) | §1.3 ci-dessus | S |
| Tables `document_templates` / `generated_documents` dormantes | §1.1 | S (drop ou réutiliser) |
| Quittance utilise orange terracotta `(232,96,44)` (§B.4 violation) | `quittance.py:46` | S |
| `storage._BUCKET = "documents"` hardcodé hors settings (§C) | `storage.py:12` | S |
| Pas de retry Celery sur emails | §6.3 | M |
| Migration `0030` chante des `.sql` historiques | `0030_changements_locataire.py:10` (« convertie depuis supabase/migrations/0028 ») — vérifier aucun reliquat `.sql` orphelin (§B.13) | S |
| Fichiers `.sql` à la racine `backend/` (`migration.sql`, `migration_0002*.sql`, `migration_crm.sql`, etc.) | racine `backend/` — **PAS dans `alembic/versions/`** donc §B.13 strict non violé, mais clutter | S (à archiver) |
| Backlog `« Althy SA »` hardcodés backend (§F CLAUDE.md) | 3 occurrences connues | S |

### 10.3 Alembic head

- ✅ `alembic head` = `0050` (50 fichiers `.py` dans `versions/`, dernier `0050_unify_iban_sources`)
- ✅ Aucun `.sql` dans `alembic/versions/` (§B.13 respecté)
- ✅ Aucune migration orpheline (chaîne 0001→0050 vérifiée à la liste)

### 10.4 GitHub Issues / bugs ouverts

- Non audité directement (no access GitHub). À demander à Killian si `gh issue list --label sprint-10` retourne quelque chose.

---

## Recommandations refacto AVANT Sprint 10

### Bloquant (à faire J-3 max)

- [ ] **🔴 §B.15 STOP doctrinal #1 — Skribble Phase 1.0** : demander confirmation explicite Killian que Skribble bascule en Phase 1.0 (vs migration 0049 + Sprint 8 = Phase 1.1). Si confirmé, créer entrée backlog doctrinal dans `docs/2-ROADMAP.md` §F + commit message dédié. (Effort confirmation = 0, validation business = bloquante)
- [ ] **🔴 §B.15 STOP doctrinal #2 — Mandat de gestion agence-propriétaire** : confirmer Killian que `agence` (Sunimmo) peut signer un mandat de gestion en Phase 1.0 sans déborder sur Stripe Connect commission loyers (§B.15 ligne « Stripe Connect commission loyers (3-5%) »). Si non confirmé, retirer du scope Sprint 10 (reporter Phase 1.1). (Idem)
- [ ] **🔴 §B.15 STOP doctrinal #3 — Approbation propriétaire** : clarifier interprétation A (approuver candidat issu d'invitation, OK Phase 1.0) vs B (approuver candidature spontanée marketplace, INTERDIT). (Idem)

### Recommandé (à faire dans la première semaine du sprint)

- [ ] **Décision architecture** : SignableDocument polymorphe vs extension par-table (cf §3.5). Recommandation Claude Code : **extension par-table** (moins risqué Sprint 10, ~J-17 Sunimmo). (Effort décision = 0, mais conditionne tout le reste) (effort S)
- [ ] **Choix de gestion `deposit*` vs `garantie_*`** (cf §1.3) — rename ou ajout parallèle ? (effort S)
- [ ] **Drop tables dormantes `document_templates` + `generated_documents`** OU les ré-engager officiellement. (effort S)
- [ ] **Fix `notice_deadline_date` typage String→DateTime** dans le schéma (migration 0051 préalable). (effort S)
- [ ] **Variabiliser `storage._BUCKET`** via `settings.SUPABASE_BUCKET_DOCUMENTS` (anti-hardcode §C). (effort S)
- [ ] **Fix palette quittance** (orange → Prussian) — §B.4. (effort S)

### Nice-to-have (peut attendre Sprint 11)

- [ ] Factoriser `_AlthyPdfBase(FPDF)` partagé. (effort M)
- [ ] Wrapper Celery retry sur `send_email`. (effort M)
- [ ] Webhooks Resend bounces. (effort M)

---

## Découpage Sprint 10 recommandé (8 lots)

```
Lot 0 — Doctrine + arbitrages §B.15 (Killian)          — bloquant
Lot 1 — Schéma DB                                     — bloque Lots 2,3,4,5
  • Migration 0051 : signatures Skribble sur Contract
                     + champs USPI manquants (renouvellement_mois,
                     reserve_hausse_*, garantie_*, etc.)
  • Migration 0052 : table `mandats` (si §B.15 OK)
  • Migration 0053 : table `avenants` (si extension par-table)
  • Migration 0054 : table `resiliations`
  • Drop/audit document_templates dormantes
Lot 2 — Skribble integration backend                  — dépend Lot 1
  • skribble_service.py + webhook
  • mapping états Skribble → Contract.status
  • Stockage PDF signé Supabase (bucket dédié)
Lot 3 — Templates PDF                                 — parallèle Lot 2
  • _AlthyPdfBase + 6 templates (bail USPI, avenant,
    résiliation, mandat, CGUL, EDL avec photos embed)
Lot 4 — Templates email                               — parallèle Lot 2
  • 9 templates Resend (cf §6.2)
Lot 5 — Approbation propriétaire                      — dépend Lot 1+4
  • Endpoint POST /contracts/{id}/approve-candidate
  • Magic link `type='approbation_dossier'` (réutilise pattern §4)
  • Page publique /approuver/[token]
Lot 6 — UI Frontend                                   — dépend Lots 2,3,5
  • Wizard /app/contracts/new (multi-step bail USPI)
  • /app/contracts/[id] refonte multi-signataires
  • Modale envoi Skribble + statut polling
  • Page EDL co-remplissage entrée/sortie
Lot 7 — Documentation                                 — fin de sprint
  • DATA_FLOW_SIGNABLE_DOCUMENTS.md (§C livrable)
  • Mise à jour docs/2-ROADMAP.md §2.4 (bascule Skribble P1)
  • Mise à jour docs/4-PRODUIT.md §4.X (workflows neufs)
Lot 8 — Tests + smoke prod                            — fin de sprint
  • Backend pytest : 5-8 tests Contract/signature/EDL
  • Frontend E2E Playwright : 1 spec bail end-to-end
  • Smoke test sandbox Skribble
  • Migration test bien Crans-Montana
```

**Lots parallélisables :** 2 + 3 + 4 (3 devs), 5 indépendant (1 dev), 6 en aval, 7+8 en fin.

**Chemin critique :** Lot 0 → Lot 1 → Lot 2 → Lot 6 → Lot 8.

---

## Plan B (si Skribble KYC traîne au-delà du 25/05)

**Bascule sur "Acceptation contractuelle horodatée renforcée" (extension Sprint 8) :**

1. Garder le flow Sprint 8 (`signed_at`/`tenant_signed_at` + IP + horodatage).
2. Ajouter une couche de **preuve renforcée** :
   - SMS OTP au signataire avant `POST /countersign` (Twilio existe en config, `TWILIO_ACCOUNT_SID` env vars présentes mais non utilisées).
   - Capture User-Agent + géolocalisation IP approximative.
   - Génération PDF avec page « Attestation d'acceptation » détaillée + QR vérification.
3. Documenter explicitement Sunimmo que c'est une **SES (Simple Electronic Signature) art. 14 al. 1 CO** — valable pour bail civil en droit suisse (vs QES nécessaire pour bail commercial > durée déterminée).
4. Conserver les colonnes Skribble (`skribble_session_id`, etc.) NULL — la table reste compatible pour réactivation Phase 1.1 sans nouvelle migration.

**Effort Plan B :** M (1 sprint de retard évité, migration Sunimmo non bloquée).

**Communication Sunimmo :** lettre formelle Killian expliquant que la version commerciale du 01/06/2026 utilise SES (légalement suffisant CO art. 14) et que la bascule vers AES/QES Skribble est planifiée Sprint 11 ou 12 sans migration de données.

---

## Annexe — Inventaire des fichiers consultés

**Modèles :**
- `backend/app/models/contract.py`
- `backend/app/models/candidature.py`
- `backend/app/models/locataire.py` (Locataire + DossierLocataire)
- `backend/app/models/document_dossier.py`
- `backend/app/models/user.py`

**Migrations :**
- `0001_initial_schema.py`, `0002_add_missing_columns.py`, `0005_document_generation_extended_fields.py`, `0029_fusion_properties_biens_complete.py`, `0030_changements_locataire.py`, `0046_dossier_proposition.py`, `0049_contract_countersign_link.py`, `0050_unify_iban_sources.py`

**Services :**
- `backend/app/services/contract_service.py`
- `backend/app/services/loyer_activation.py`
- `backend/app/services/pdf_edl_service.py`
- `backend/app/services/quittance.py`
- `backend/app/services/email_service.py`
- `backend/app/services/resend_service.py`
- `backend/app/services/storage.py`

**Routers :**
- `backend/app/routers/contracts.py`
- `backend/app/routers/biens_invitations.py`
- `backend/app/main.py`

**Frontend :**
- `frontend/src/components/contracts/CountersignModal.tsx`
- Liste contracts/[id]/page.tsx référencée

**Config + tests :**
- `backend/requirements.txt`
- `backend/app/core/config.py`
- `backend/tests/` (5 fichiers)
- `frontend/e2e/` (6 specs)

**FIN DU RAPPORT.**
