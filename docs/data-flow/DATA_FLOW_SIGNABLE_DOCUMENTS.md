# DATA_FLOW — Signable Documents Sprint 10

**Date :** 2026-05-14
**Sprint :** Sprint 10 — Bail + Skribble + Avenant + Résiliation + Mandat + EDL
**Doctrine §C cohérence transversale** : cartographie obligatoire des 8 surfaces
impactées par les nouvelles entités signables.

---

## 1. Entités touchées

| Entité | Table DB | Source migration | Colonnes neuves Sprint 10 |
|---|---|---|---|
| **Contract** | `contracts` (existant) | 0001 + 0005 + 0049 + **0051** | +17 cols (12 USPI + 5 Skribble : `renouvellement_mois`, `reserve_hausse_motif/montant`, `deposit_iban/deposit_bank_name`, `conditions_particulieres`, `locataire_etat_civil`, `logement_familial_principal`, `ancien_locataire`, `cgul_signed_at`, `cgul_signed_at_locataire`, `template_type`, `cgul_version`, `skribble_session_id`, `skribble_status`, `skribble_signed_pdf_url`, `skribble_signer_role_required` JSONB) |
| **Avenant** | `avenants` (NOUVEAU) | **0051 §E** | 17 cols dont `avenant_type` (9 valeurs CHECK), `data` JSONB typé selon type, `skribble_*` |
| **Resiliation** | `resiliations` (NOUVEAU) | **0051 §F** | 18 cols dont `initiateur` (3 valeurs), `respect_preavis`, workflow (`signed/envoyee/appliquee/annulee`), ON DELETE RESTRICT sur contract_id (CO 962 — 10 ans) |
| **MandatGestion** | `mandats_gestion` (NOUVEAU) | **0051 §D** | 25 cols dont `commission_pct_annee/saison/semaine` (**data pure §2.4.16, AUCUN tracking transactionnel**), `for_juridique` (default 'Sierre'), `notice_deadline_month_day` |
| **ChangementLocataire** | `changements_locataire` (existant) | 0030 + **0051 §G** | +1 col `convention_sortie` JSONB (structure : `description_defauts[]`, `inventaire_cles{}`, `total_estimation_chf`, `mode_indemnisation`, `skribble_session_id` dans JSONB) |
| **DossierLocataire** | `dossiers_locataires` (existant) | 0041 + 0046 + **0052** | +6 cols approbation propriétaire (`proprio_approbation_required/at/ip/by_user_id`, `proprio_refus_at/_reason`) |
| **MagicLink** | `magic_links` (existant) | 0027 | Nouveau `type='approbation_dossier'` (zéro migration — column `type` est String sans CHECK constraint) |

---

## 2. Surface UI (frontend pages)

| Path | Action | Champs lus | Champs mutés | Lot |
|---|---|---|---|---|
| `/app/contracts/[id]` (existant Sprint 8) | R | tous + skribble_* | (lecture seule côté locataire) | Sprint 8 + Lot 6 (extension Skribble button à ajouter en follow-up) |
| `/app/avenants` | R (liste) | tous (paginated) | — | **Lot 6** |
| `/app/avenants/new` | W | — | tous champs + `data` JSONB | **Lot 6** |
| `/app/avenants/[id]` | R+W | tous + `skribble_*` | actions send-to-skribble / cancel | **Lot 6** |
| `/app/resiliations` | R | tous | — | **Lot 6** |
| `/app/resiliations/new` | W | — | tous + warning CO 266l si bailleur+habitation | **Lot 6** |
| `/app/resiliations/[id]` | R+W | tous + `skribble_*` | send-skribble, marquer-envoyee, marquer-appliquee (→ Contract.status='terminated') | **Lot 6** |
| `/app/mandats` | R | tous | — | **Lot 6** |
| `/app/mandats/new` | W | — | tous + 3 commissions | **Lot 6** |
| `/app/mandats/[id]` | R+W | tous + `skribble_*` | send-skribble, terminer | **Lot 6** |
| `/approuver/[token]` (public no-auth) | R+W | synthèse anonymisée LPD | `proprio_approbation_at/ip/by_user_id` OU `proprio_refus_at/_reason` | **Lot 5** |
| `/app/contracts/new` (existant Sprint 5) | W | extension USPI Sprint 10 fields (à compléter Phase 1.1) | tous | Sprint 5 / extension Phase 1.1 |
| `/app/contracts/[id]/edl/entree` | NON LIVRÉ | — | Phase 1.1 (complexité photos/pièces) | reporté |
| `/app/contracts/[id]/edl/sortie` | NON LIVRÉ | — | Phase 1.1 | reporté |

---

## 3. Surface API (endpoints backend)

| Endpoint | RBAC | Méthode | Lot |
|---|---|---|---|
| `GET /api/v1/contracts/{id}` (étendu) | proprio/agence/locataire/super_admin | existant | Sprint 8 |
| `POST /api/v1/contracts/{id}/send-to-skribble` | proprio/agence/super_admin | **NEW** | **Lot 2** |
| `POST /api/v1/contracts/{id}/sign` (Plan B SES) | proprio/agence/super_admin | existant | Sprint 8 (intact) |
| `POST /api/v1/contracts/{id}/countersign` (Plan B SES) | tenant uniquement | existant | Sprint 8 (intact) |
| `GET /api/v1/avenants` + CRUD | proprio/agence/super_admin (write), +tenant (read) | **NEW** | **Lot 2** |
| `POST /api/v1/avenants/{id}/send-to-skribble` | proprio/agence/super_admin | **NEW** | Lot 2 |
| `GET /api/v1/resiliations` + CRUD | idem + tenant peut initier sa résiliation | **NEW** | Lot 2 |
| `POST /api/v1/resiliations/{id}/marquer-envoyee` | proprio/agence | **NEW** | Lot 2 |
| `POST /api/v1/resiliations/{id}/marquer-appliquee` | proprio/agence | **NEW** | Lot 2 |
| `GET /api/v1/mandats` + CRUD | **agence ou super_admin uniquement pour create**, mandant peut lire | **NEW** | Lot 2 |
| `POST /api/v1/mandats/{id}/terminer` | mandant ou super_admin | **NEW** | Lot 2 |
| `POST /api/v1/webhooks/skribble` | no-auth (HMAC verify X-Skribble-Signature) | **NEW** | Lot 2 |
| `GET /api/v1/skribble/status/{type}/{id}` | RBAC light (owner/agency/tenant) | **NEW** | Lot 2 |
| `POST /api/v1/skribble/{type}/{id}/cancel` | proprio/agence/super_admin | **NEW** | Lot 2 |
| `POST /api/v1/skribble/edl/{id}/send` | proprio/agence/super_admin | **NEW** | Lot 2 |
| `POST /api/v1/agences/dossiers/{id}/pre-validate` | agence (mandataire) / super_admin | **NEW** | **Lot 5** |
| `GET /api/v1/public/approbation/{token}` | no-auth (bearer token) | **NEW** | Lot 5 |
| `POST /api/v1/public/approbation/{token}/approve` | no-auth scope strict | **NEW** | Lot 5 |
| `POST /api/v1/public/approbation/{token}/deny` | no-auth scope strict | **NEW** | Lot 5 |

**Mounting routers (cf `backend/app/main.py` après Lot 1.5 + Lot 5)** :
- `/api/v1/contracts/*` (existant, BACKEND_FLAG_CONTRACTS)
- `/api/v1/avenants/*`, `/api/v1/resiliations/*`, `/api/v1/mandats/*` (Lot 1.5, BACKEND_FLAG_CONTRACTS)
- `/api/v1/webhooks/skribble`, `/api/v1/skribble/*`, `/api/v1/public/approbation/*`, `/api/v1/agences/dossiers/*` (ungated)

---

## 4. Surface PDF

| Template (Lot 3) | Service | Lit | Variables clés |
|---|---|---|---|
| Bail Sunimmo (4 variantes) | `pdf_bail_service.py` | Contract + Bien + User + Locataire | 17 nouveaux cols Lot 1 + cosignataires JSONB |
| Avenant (9 types) | `pdf_avenant_service.py` | Avenant + Contract + Bien + User | `avenant_type` + `data` JSONB |
| Résiliation (courrier formel) | `pdf_resiliation_service.py` | Resiliation + Contract + Bien + User | + warning CO 266l si bailleur+habitation |
| Mandat 4p (Articles 1-9) | `pdf_mandat_service.py` | MandatGestion + User mandant + User agence + Bien | `commission_pct_*` (data pure) |
| Convention sortie | `pdf_convention_sortie_service.py` | `changements_locataire.convention_sortie` JSONB | description_defauts, inventaire_cles, total_estimation_chf |
| EDL entrée/sortie (existant) | `pdf_edl_service.py` | `changements_locataire.edl_entree/sortie` JSONB | (extension photos embed = TODO Phase 1.1) |

**Tous les PDFs** utilisent `_althy_pdf_base.py` (Sprint 10 Lot 3) :
- Palette Prussian #0F2E4C + Or #C9A961
- Header `settings.ALTHY_CREDITOR_NAME` (jamais hardcoder HBM Swiss Sàrl)
- Footer `Document généré par Althy · Édité par {ALTHY_CREDITOR_NAME}`
- Disclaimer IA §4.9 si `emit_disclaimer_ia=True`

---

## 5. Surface Email Resend (Lot 4)

| Template | Trigger | Variables clés |
|---|---|---|
| `approbation_proprietaire.html/.txt` | Lot 5 — `pre_validate_dossier` | `owner_name`, `candidate_full_name`, `candidate_dossier_summary`, `bien_address`, `monthly_rent`, `approval_link`, `deny_link`, `expires_at_formatted` |
| `approbation_donnee.html/.txt` | Lot 5 — `approve_dossier` | `owner_name`, `candidate_name`, `next_steps`, `bien_address` |
| `candidat_refuse.html/.txt` | Lot 5 — `deny_dossier` | `candidate_name`, `bien_address`, `agency_name` |
| `signature_bail_locataire.html/.txt` | Lot 2 — orchestrator post-create bail | `tenant_name`, `contract_reference`, `skribble_signing_url`, `expires_at` |
| `signature_bail_agence.html/.txt` | Webhook Skribble — tenant signed | `agency_name`, `contract_reference`, `signed_by_summary` |
| `bail_signe_tous.html/.txt` | Webhook — completed | tenant + bailleur (2 emails) |
| `avenant_a_signer.html/.txt` | Lot 2 — send_avenant_to_skribble | `avenant_type_label`, `avenant_objet` |
| `resiliation_envoyee.html/.txt` | Lot 2 / Lot 6 — send + marquer-envoyee | + warning CO 266l si applicable |
| `edl_a_planifier.html/.txt` | À câbler (post-bail signé + post-résiliation appliquée) | `phase`, `date_suggestion`, `planning_link` |
| `rappel_signature_pending.html/.txt` | Cron `sprint10_reminders.py` J+3 | `recipient_name`, `document_type`, `days_since_sent` |

**Sender name dynamique §Z** : `agency_settings.agency_name` → `first_name + last_name` → `"Althy"` fallback (logique existante `email_service.py:53-55`).

**Idempotence rappels** : Set in-memory process-local `(doc_type, doc_id, day_bucket)` — réinit à minuit UTC. Migration vers table dédiée prévue Phase 2 multi-worker (TODO Lot 4 documenté).

---

## 6. Surface Export CSV / Excel

**État actuel** : aucune extension explicite Sprint 10. Le module `documents.py` peut générer des exports baux, mais les nouveaux champs (skribble_*, avenants, résiliations, mandats) **n'apparaissent pas encore dans les exports CSV** existants.

**TODO post-Sunimmo (Phase 1.1)** :
- [ ] Ajouter colonnes `skribble_session_id`, `skribble_status`, `signed_at_locataire`, `signed_at_agence`, `fully_signed` à l'export Contract CSV
- [ ] Créer endpoints export `/avenants/export.csv`, `/resiliations/export.csv`, `/mandats/export.csv`
- [ ] Export annexe : décompte commissions data pure pour mandats (visualisation uniquement, pas de calcul transactionnel)

---

## 7. Surface Stats / Dashboard

**État actuel** : aucun widget Sprint 10 ajouté au dashboard `/app/dashboard`. Reporté à itération post-Sunimmo.

**TODO Phase 1.1 (rapide — ~1h)** :
- [ ] Widget "Baux à signer (N)" — count `contracts WHERE status='draft' AND created_at < now() - 1 day`
- [ ] Widget "Documents en attente de signature" — sum sur `(contracts, avenants, resiliations, mandats) WHERE skribble_status IN ('pending_signatures', 'partial_signed')`
- [ ] Widget "Approbations propriétaire pending" — count `dossiers_locataires WHERE proprio_approbation_required AND NOT proprio_approbation_at AND NOT proprio_refus_at`
- [ ] Widget "EDL en attente" — count `changements_locataire WHERE edl_entree IS NULL OR edl_sortie IS NULL`
- [ ] Widget "Taux signature 7j" — `signed/sent` ratio sur fenêtre 7 jours

---

## 8. Surface IA (Claude prompts, sphère)

**État actuel** : aucun prompt Claude mis à jour automatiquement pour Sprint 10. La sphère IA et l'agent conversationnel (`sphere_agent.py`) **ne savent pas encore** :
- Que `Contract.skribble_status` peut prendre 5 nouvelles valeurs
- Que `Avenant`, `Resiliation`, `MandatGestion` existent comme entités SQLAlchemy
- Que le workflow de signature peut passer par Plan A (Skribble) ou Plan B (Sprint 8)

**TODO Phase 1.1** :
- [ ] Mettre à jour le system prompt sphère pour inclure les 3 nouvelles entités + skribble_* sur Contract
- [ ] Ajouter les schemas Pydantic correspondants au contexte tool-use de Claude (si tool-use exposé)
- [ ] Vérifier que les prompts `ai/documents.py` (génération IA documents) tiennent compte des champs USPI Sprint 10 (template_type, locataire_etat_civil, logement_familial_principal)

---

## 9. Cascade DELETE / SET NULL — politique par entité

| User supprimé | Côté DB | Politique | Justification |
|---|---|---|---|
| `user.role='locataire'` | `Contract.tenant_id` | **SET NULL** | Permet conservation historique du bail (CO 962, 10 ans). `Locataire.user_id` SET NULL aussi. |
| `user.role='locataire'` | `Avenant` | (via Contract.tenant_id SET NULL) | Avenant conservé, signataire devient anonyme |
| `user.role='locataire'` | `Resiliation` | (idem) | Résiliation conservée |
| `user.role='proprio_solo'` | `Contract.owner_id` | **RESTRICT** | Impossible de supprimer un proprio qui a des baux actifs ou archivés — protection juridique CO 962 |
| `user.role='proprio_solo'` | `MandatGestion.mandant_id` | **RESTRICT** | Idem — mandat = engagement contractuel agence ↔ propriétaire |
| `user.role='agence'` | `Contract.agency_id` | **SET NULL** | Bail peut perdurer même si l'agence cesse son mandat (le bailleur reprend la gestion) |
| `user.role='agence'` | `MandatGestion.agence_id` | **RESTRICT** | Le mandat est l'objet du contrat lui-même |
| `Bien` supprimé | `Contract.bien_id` | **RESTRICT** | Bail ne peut exister sans bien |
| `Bien` supprimé | `MandatGestion.bien_id` | **SET NULL** | Mandat peut couvrir d'autres biens du mandant (bien_id NULL = mandat global) |
| `Contract` supprimé | `Avenant.contract_id` | **CASCADE** | Avenant n'a pas de sens sans bail parent |
| `Contract` supprimé | `Resiliation.contract_id` | **RESTRICT** | Résiliation = preuve historique CO 962 |
| `Contract` supprimé | `Locataire.current_contract_id` | **SET NULL** | Locataire peut enchaîner d'autres baux |
| `changements_locataire` supprimé | (aucune FK sortante vers signables) | — | Convention sortie dans JSONB, suit la suppression |

**⚠️ Risque identifié** : actuellement aucune contrainte ne **bloque la suppression** d'un Contract qui a un `Avenant signed` ou un `Resiliation signed`. La règle CASCADE sur Avenant signifie que supprimer un Contract supprime aussi les avenants associés — **perte de données légales potentielle**.

**Mitigation recommandée Phase 1.1** :
- [ ] Audit applicatif côté `ContractService.delete` : refuser si `Avenant.status IN ('signed', 'envoyee', 'appliquee')` exists
- [ ] Politique conservation 10 ans (CO 962) via soft delete uniquement (`is_active=FALSE`), jamais DELETE physique sur les 4 entités signables

---

## 10. Migration data Sunimmo

**Volumes prod estimés au 14/05/2026** :
- Baux existants Sunimmo : ~30 baux (estimation avant migration formelle)
- Mandats à créer : ~30 (1 par bailleur-propriétaire Sunimmo)
- Avenants historiques : 0 (Phase 1.0 démarre fresh)
- Résiliations historiques : 0 (idem)

**Plan de migration Sunimmo Lot 8 (`scripts/migrate_sunimmo_dry_run.py`)** :
1. SELECT baux prod actuels (Contract WHERE owner_id IN (Sunimmo clients))
2. Pour chaque bail : enrichir `template_type='sunimmo_annee'` (défaut, à confirmer per-bail), `cgul_version='althy_v1_2026'`, `cgul_signed_at=NOW()` si bail actif
3. Backfill `notice_period_months=3` si NULL
4. Créer 1 `MandatGestion` per bailleur Sunimmo avec `mandant_id=owner.id`, `agence_id=sunimmo_user.id`, `commission_pct_*` défauts 10/15/20, `start_date=earliest bail`
5. **Aucune migration `Avenant`/`Resiliation` historiques** — Sunimmo démarre Phase 1.0 sans historique signé
6. Output report : champs manquants, conflits, doublons

**Dry-run obligatoire** avant prod (cf Lot 8).

---

## 11. Risques cohérence identifiés

### 11.1 Plan A Skribble vs Plan B SES renforcée — coexistence

**Risque** : 2 sources de vérité possibles pour "le bail est signé" :
- Plan B (Sprint 8) : `Contract.signed_at IS NOT NULL AND tenant_signed_at IS NOT NULL` → `fully_signed=True` hybrid property
- Plan A (Sprint 10) : `Contract.skribble_status='completed'` AND `skribble_signed_pdf_url IS NOT NULL`

**Règle de priorité** :
1. Si `skribble_session_id IS NOT NULL` → Plan A en cours/terminé. Le PDF source de vérité = `skribble_signed_pdf_url` (Supabase bucket signable-documents).
2. Sinon → Plan B Sprint 8. Pas de PDF Skribble disponible.

**Garde-fou implémenté Lot 2** : `POST /contracts/{id}/send-to-skribble` refuse si `signed_at IS NOT NULL OR tenant_signed_at IS NOT NULL` (409 — bail déjà signé via Plan B).

### 11.2 `Contract.deposit` vs nouveau `deposit_iban` / `deposit_bank_name`

**Audit §1.3** avait soulevé : `Contract.deposit` (Numeric depuis 0001) sert au "montant de la caution". Sprint 10 a ajouté `deposit_iban` et `deposit_bank_name` pour le compte épargne caution (mode `compte_epargne` du deposit_type). Aucun conflit — sémantique cohérente.

### 11.3 EDL JSONB vs convention_sortie JSONB — relation 1-1 ?

`changements_locataire.edl_sortie` (JSONB) et `convention_sortie` (JSONB) sont 2 colonnes distinctes mais sémantiquement liées : la convention de sortie est l'aboutissement de l'EDL sortie. Aujourd'hui le code ne force pas l'un sans l'autre (l'EDL sortie peut exister sans convention, et vice-versa).

**Recommandation Phase 1.1** : ajouter un CHECK constraint applicatif "si `convention_sortie IS NOT NULL` alors `edl_sortie IS NOT NULL`" (ou laisser libre — selon décision produit).

### 11.4 Mandat actif requis avant Contract.agency_id ?

**Risque** : un Contract peut être créé avec `agency_id=X` même si aucun `MandatGestion ACTIVE` n'existe entre `Contract.owner_id` et `agency_id=X`. Cela permettrait à n'importe quel user `role=agence` d'apparaître comme mandataire d'un bail sans contrat signé.

**Mitigation recommandée** :
- Lot 8 ajouter test backend : `test_contract_create_requires_active_mandat_if_agency_id_set`
- Phase 1.1 : check applicatif dans `ContractService.create` — si `payload.agency_id` est fourni, vérifier `SELECT count(*) FROM mandats_gestion WHERE mandant_id=owner_id AND agence_id=agency_id AND status='active'` > 0

### 11.5 Magic link `type='approbation_dossier'` — pas de CHECK constraint DB

**État actuel** : la column `magic_links.type` est `String` libre (pas de CHECK constraint). On peut donc créer n'importe quelle valeur. Sprint 10 utilise `'approbation_dossier'` mais rien ne l'enforce côté DB.

**Mitigation Phase 1.1** : ajouter un CHECK constraint `magic_links_type_check` qui liste les valeurs actuelles (`'invitation'`, `'reset_password'`, `'approbation_dossier'`, etc.). Migration séparée Phase 1.1.

---

## 12. Checklist mise en cohérence (avant merge Sprint 10 → main)

- [ ] `alembic upgrade head` passe sur DB clean → 0052 appliquée
- [ ] `alembic downgrade -2` puis `upgrade head` → idempotent
- [ ] `python -c "from app.main import app; print(len(app.routes))"` → tous routers montés (avenants, resiliations, mandats, skribble_webhooks, public_approbation, agences_dossiers)
- [ ] pytest passes (au moins : `test_health`, `test_flag_gating`, `test_skribble_service`, `test_signature_orchestrator`, `test_sprint10_emails`, `test_pdf_templates`)
- [ ] Smoke Skribble sandbox : 1 bail créé → /send-to-skribble → webhook completed reçu → `Contract.status='active'` + `loyer_transaction` créée (Lot 8)
- [ ] Dry-run migration Sunimmo : aucun bail orphelin, mandats créables sans conflit (Lot 8)
- [ ] Frontend : pages avenants/resiliations/mandats accessibles + créer un avenant fictif fonctionne end-to-end
- [ ] Doctrine §B.15 + §2.4.16 respectée : `commission_pct_*` mandat = data pure (aucun side-effect financier en code)
- [ ] Plan B Sprint 8 INTACT : `/sign` + `/countersign` toujours fonctionnels
- [ ] §B.4 palette Prussian/Or partout (aucune référence orange terracotta)
- [ ] Items nav sidebar à ajouter (`/app/avenants`, `/app/resiliations`, `/app/mandats`) — TODO follow-up rapide
- [ ] Bouton "Envoyer Skribble" sur `/app/contracts/[id]` — TODO follow-up rapide
- [ ] Provisionner bucket Supabase Storage `signable-documents` (privé, signed URLs, retention 10 ans) — **action ops manuelle**
- [ ] KYC Skribble compte HBM Swiss Sàrl finalisé — **action externe Killian**
- [ ] `SKRIBBLE_ENABLED=True` côté env Railway une fois Skribble prêt — sinon Plan B reste actif par défaut

---

**FIN DU DOCUMENT.**

Pour toute question sur l'impact d'un nouveau champ ou d'une modification schema Sprint 10, ce document est la **source de vérité §C**. Mettre à jour la section appropriée + la checklist §12 lors de toute évolution.
