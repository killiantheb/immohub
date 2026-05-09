# 2. Roadmap Althy

> **Source de vérité unique** pour les phases produit + sprints.
> Remplace l'ancien `ROADMAP.md` (racine) et `SPRINT_LOG.md` (archivé).
> Last update : 2026-05-09 (v6 — refocus Phase 1.0 logiciel de gestion, marketplace publique reportée Phase 2)
> Audience : Killian, peer reviewer Claude Code, futurs collaborateurs.

---

## 2.1 Philosophie roadmap

**Gates durs entre phases.** Les critères de sortie de chaque phase sont des conditions binaires (atteint / pas atteint), pas des indicateurs. Pas de Phase N+1 avant que la Phase N ne soit validée. La tentation de « lancer la Phase 2 en parallèle » est explicitement refusée.

**Un sprint = un thème.** Pas de bundling de scopes (pas de « petit bug pendant qu'on y est »). Un sprint a un nom (« Bien complet », « Documents par bien »), un fichier de plan dans `docs/sessionN/`, et une liste d'étapes validées une par une avec checkpoint Killian.

**Phase 1.0 = logiciel de gestion pure (pas de marketplace publique).** Tout ce qui n'est pas Phase 1.0 (marketplace publique, candidature spontanée, scoring IA candidature, diffusion portails, agence, openers, hunters, ventes, etc.) n'est ni codé, ni roadmappé en détail. Les modules futurs ont leur place dans la vision long terme — ils n'encombrent pas le sprint en cours. Cf §2.10 Règle 10.

**Architecture pensée pour accueillir Phase 2-3 sans refonte.** Les fondations posées en Phase 1 (i18n-ready dès Phase 1, RBAC 9 rôles dès Phase 1, architecture multi-pays migration 0037) permettent l'activation progressive sans refactor lourd.

**La roadmap se met à jour uniquement quand un événement réel l'impose** (fin d'une phase, contrainte légale concrète, retour utilisateur critique). Pas de re-discussion « pour le fun ».

---

## 2.2 Synthèse visuelle

| Phase | Nom narratif | Période | Objectif | Gate dur de sortie | i18n | Statut |
|---|---|---|---|---|---|---|
| **0** | — | M-3 → M0 | Stabilisation fusion | Migration 0029 prod + 1 bien créé via UI | fr-CH | ✅ TERMINÉE 25/04/2026 |
| **1.0** | L'Assistant — Logiciel de gestion | M1 → M3 | Logiciel de gestion pure (Sunimmo test) | 10 biens Sunimmo migrés au 01/06/2026 + 0 bug bloquant 7j | fr-CH | 🔄 EN COURS |
| **1.1** | L'Assistant — Compléments | M3 → M6 | Signature électronique + relances auto + compta dynamique | 3+ testeurs alpha autonomes bout en bout | fr-CH | 🔮 PRÉVUE |
| **2** | L'Intelligence | M7 → M12 | Lancement public payant | 10+ payants + MRR ≥ CHF 500 + churn < 10 % | + de-CH | 🔮 PRÉVUE |
| **3** | L'Écosystème | M13 → M18 | Marketplace 3 acteurs | 10+ Openers + 10+ Artisans + 5+ Hunters actifs | fr-CH + de-CH | 🔮 PRÉVUE |
| **4** | Le Pilotage Patrimonial | M19 → M24 | Resales (vente immo) | 5+ ventes via Althy + module = 30 % MRR | fr-CH + de-CH | 🔮 PRÉVUE |
| **5+** | L'Agent Autonome | An 3+ | Expansion DACH + Hub IA | 1er client Zurich payant | + it-CH + en | 🔮 EXPLORATOIRE |

---

## 2.3 Phase 0 — Stabilisation fusion (TERMINÉE)

**Période** : début avril 2026 → 25 avril 2026.
**Objectif** : Fondation technique 100 % propre. Rien ne casse. 1 bien créable de bout en bout.

### Bilan synthétique

- ✅ Bundles P1/P2/P3 finalisés (refonte fusion `properties` → `biens`).
- ✅ Création environnement staging Supabase + backup manuel prod.
- ✅ **Migration 0029 prod** appliquée le 25/04/2026 14:34 GMT (durée 4 sec, exit 0). TRUNCATE `biens`, schéma fusion, parité staging 5/5.
- ✅ Merge `refonte/fusion-properties-biens-complete` → `main` le 25/04/2026 18:41 GMT+2 (61 commits, +7652/−2579 lignes).
- ✅ Smoke test post-migration : endpoints critiques 200, login UI fonctionnel, pattern auth H3 validé.
- ✅ **Étape 10** atteinte le 26/04/2026 (session 11) : premier bien créé via UI en prod (`e074ae1d-3ded-…`). Deux bugs P0 fixés en cours de route — crash dashboard `E.filter is not a function` (PR #2) + audit log Decimal serializer (PR #1).
- ✅ Sprint 12 « Bien complet » ouvert le 26/04/2026 → 5 PRs mergées (PR #3 à #7) clôturant les étapes 1, 2, 2bis, 2ter du sprint.

**Référence détaillée** : `docs/archive/sessions/HANDOFF-cloture-bug-P0-pagination.md` + `docs/archive/sessions/HANDOFF-fin-soir2-victoire.md`.

---

## 2.4 Phase 1.0 — Logiciel de gestion (Sunimmo test) ⭐

**Période cible** : M1 → M3 (mai 2026 → juillet 2026).
**Objectif** : Althy est un **logiciel de gestion locative pure** utilisé en interne par Sunimmo Riviera pour piloter ses biens. Aucune marketplace publique, aucune candidature spontanée, aucune diffusion portail. Le bailleur invite manuellement chaque locataire ; chaque locataire a un espace dédié à SON bien.

> **Réorientation stratégique 2026-05-09** : la Phase 1 historique (« Location pure » avec marketplace masquée tactiquement) a été restructurée en **Phase 1.0 (logiciel de gestion)** + **Phase 1.1 (compléments)**. La marketplace publique, le scoring IA candidature, les frais propriétaire CHF 45, les Hunters/Openers/Artisans étendus, la diffusion portails (Homegate, ImmoScout24, Flatfox, immobilier.ch), l'acquisition publique et les réseaux sociaux **sont tous reportés en Phase 2 ou ultérieur**. Cf §2.10 Règle 10.

### 2.4.1 Cible commerciale immédiate

**Migration progressive Sunimmo Riviera** :
- **01/06/2026** : 10 biens Sunimmo Riviera migrés depuis l'outil legacy → Althy. Cible binaire (10/10 ou rebranchement legacy).
- **M2-M3** : montée en charge progressive (30 → 60 → 130 biens) en fonction du retour terrain.
- **Pas de clients tiers Phase 1.0**. Zéro acquisition externe. Sunimmo est le client zéro et le terrain de validation.

**Pourquoi Sunimmo en premier** : (1) feedback en boucle courte (Killian = bailleur + dev + ops), (2) volume réel sans risque commercial, (3) doctrine « si Sunimmo n'utilise pas Althy en autonomie, aucun client tiers ne le fera ».

### 2.4.2 Rôles actifs Phase 1.0

- `proprio_solo` — propriétaire-bailleur autogéré (cible Phase 1.0).
- `locataire` — accès **dédié à SON bien** (lecture seule sur bail, paiements, documents, messagerie 1:1 avec bailleur). PAS d'accès à une marketplace ni à d'autres biens.
- `super_admin` — Killian + admin technique (gestion partenaires, waitlist).

Tous les autres rôles (`agence`, `portail_proprio`, `artisan`, `opener`, `expert`, `hunter`, `acheteur_premium`) restent en `ComingSoon` Phase 2+.

### 2.4.3 Les 5 modules Phase 1.0

| # | Module | Statut | Référence sprint |
|---|---|---|---|
| 1 | **Bien** (création express + fiche complète + modif/archivage) | 🔄 EN COURS (sprint 12) | §2.4.7 + `docs/session12/SPRINT-bien-complet.md` |
| 2 | **Invitation Locataire** (lien/QR/email → compte locataire auto-link bien) | 🆕 NOUVEAU | Sprint 13 (à ouvrir post-sprint 12) |
| 3 | **Espace Locataire** (vue dédiée à SON bien, SES paiements, SES docs) | 🆕 NOUVEAU | Sprint 13 |
| 4 | **Bail** (upload PDF Phase 1.0 + signature Skribble Phase 1.1) | 🆕 NOUVEAU | Sprint 14 |
| 5 | **Communication minimale** (messagerie interne 1:1 + email Resend) | 🟡 partiel | Sprint 13 (refonte minimale) |
| 6 | **Loyer minimal** (suivi mensuel + statut payé/impayé manuel) | 🆕 NOUVEAU | Sprint 14 |

> **Note** : le module EDL (état des lieux) existe déjà dans le code (sprint 11-12) mais sa refonte produit complète est reportée Phase 2. Le code actuel reste **gelé** en Phase 1.0 (utilisable tel quel par Sunimmo, pas d'évolution UX).

### 2.4.4 Pages publiques actives Phase 1.0

- `/` (landing Althy avec Mapbox + sphère hero — sans cards reco marketplace).
- `/estimation` (lead magnet IA gratuit — conservé, alimente le pipeline Phase 2).
- `/login` + `/register` (filtré sur rôles Phase 1.0 actifs).
- `/invite/[token]` 🆕 (acceptation invitation locataire — création compte auto-linkée au bien).
- `/bientot/[role]` (waitlist pour rôles Phase 2-3+).
- `/legal/*` (CGU, confidentialité, cookies, disclaimer-ia).

### 2.4.5 Périmètre exclu Phase 1.0 (reporté Phase 2+)

Ces périmètres sont **figés en exclusion Phase 1.0**. Toute demande utilisateur ou prompt qui implique l'un de ces périmètres déclenche un STOP (cf [`CLAUDE.md`](../CLAUDE.md) §B.15) :

- **Marketplace publique** — routes `/biens` (publique), `/biens/[id]`, `/biens/swipe`, pages SEO villes (`/biens/lausanne`, `/geneve`, `/fribourg`, `/neuchatel`, `/sion`, `/valais`, `/vaud`). Code conservé, désactivé dans la nav (cf §2.4.6).
- **Candidature spontanée** — soumission de dossier locataire sans invitation préalable du bailleur.
- **Scoring IA candidature** (`tenants.ai_score` + `ai_score_detail`) — code modèle conservé, endpoint `POST /candidatures` désactivé Phase 1.0.
- **Frais propriétaire CHF 45 à l'acceptation** (migration 0033, colonnes `owner_fee_*` sur `candidatures`) — colonnes conservées, pas de prélèvement Phase 1.0.
- **Diffusion portails** — Homegate, ImmoScout24, Flatfox, immobilier.ch.
- **4 packs diffusion** (Découverte/Standard/Pro/Premium) — Phase 2.
- **Acquisition publique** — réseaux sociaux, SEO marketplace, viralité externe.
- **Stripe Connect** (commission Althy 3-5 % loyers) — Phase 2.
- **QR-facture SPC 2.0 automatique** — Phase 1.1 (Phase 1.0 = saisie manuelle statut payé/impayé).
- **Relances loyers automatiques** (J-3 / J0 / J+5 / J+10 / mise en demeure CO 257d) — Phase 1.1.
- **OAuth Gmail/Outlook + WhatsApp Business API** — Phase 2 (Phase 1.0 = email Resend uniquement).
- **SMS Twilio** — Phase 1.1+.
- **Module Comptabilité dynamique** (transactions live, OCR factures avancé, export Bexio/Banana, déclaration IFD) — Phase 1.1 / Phase 2.
- **Module agence** (`agence`, `portail_proprio`) — Phase 2.
- **Openers / Hunters / Experts / Artisans étendus** — Phase 2-3. Marketplace artisans M1 partielle (GE + VD via 50 places fondateurs) reste **gelée en l'état**, pas d'évolution Phase 1.0.
- **PPE / copropriété** — backlog vision.
- **Module vente** (Resales) — Phase 4.

### 2.4.6 Code dormant Phase 2 (présent en repo, désactivé en nav)

Plutôt que de supprimer du code écrit, on le **conserve dormant** pour réactivation Phase 2 sans refonte. Inventaire exhaustif au 2026-05-09 :

| Périmètre | Fichiers / routes | État Phase 1.0 | Réactivation |
|---|---|---|---|
| Pages marketplace publique | `frontend/src/app/biens/page.tsx` + `[id]/page.tsx` + `swipe/page.tsx` + `lausanne/`, `geneve/`, `fribourg/`, `neuchatel/`, `sion/`, `valais/`, `vaud/` | Code en repo, accessible si URL tapée → middleware redirect (cf §2.4.6 ci-dessous) | Phase 2 |
| Composants landing marketplace | `frontend/src/components/landing/LandingBiens.tsx`, `BiensRecoCards.tsx` | Composants en repo, **non importés** par la landing principale | Phase 2 |
| Endpoints marketplace API | `backend/app/routers/marketplace*.py`, `candidatures*.py` (si existants) | Code conservé, endpoints non documentés client | Phase 2 |
| Modèle `Candidature` + scoring IA | `backend/app/models/candidature.py`, `tenants.ai_score`, `ai_score_detail`, migration 0033 colonnes `owner_fee_*` | Schéma DB conservé, écriture désactivée Phase 1.0 | Phase 2 |
| Marketplace artisans M1 (GE+VD) | flag `NEXT_PUBLIC_FLAG_ARTISAN`, dashboard `DashboardArtisan` | Statut partiel maintenu en l'état (50 places fondateurs gelées) | Phase 2-3 généralisation |

**Stratégie de désactivation nav** :
- Liens supprimés des composants landing publics (`LandingBiens.tsx`, `BiensRecoCards.tsx` non importés).
- Middleware Next.js redirige `/biens*` (publique) → `/app` si user authentifié, → `/` si non authentifié.
- Aucune suppression de fichier — code traité comme **dormant Phase 2**.
- Commentaire `DORMANT Phase 2` en tête des pages concernées (référence : `2-ROADMAP §2.4.6`).

### 2.4.7 Module Bien — Sprint 12 (EN COURS)

**Objectif sprint** : transformer « 1 bien créable via UI » (acquis Phase 0 / session 11) en « 1 bien complet pilotable » — toutes les données métier accessibles à la saisie, modifiables après création, archivables, prêtes pour exploitation par une IA agentique future.

**Référence détaillée** : [`docs/session12/SPRINT-bien-complet.md`](./session12/SPRINT-bien-complet.md).

**État des étapes au 29/04/2026** :

| Étape | Description | Statut | Livrable |
|---|---|---|---|
| 1.A | Audit cohérence front ↔ back | ✅ TERMINÉ | tableau 4 colonnes, 30 gaps identifiés |
| 1.B | Priorisation gaps P1/P2/P3 | ✅ TERMINÉ | décisions cadrage 26/04/2026 |
| 2 | Fix bug 500 `/changement/actif` | ✅ TERMINÉ | PR #3 — migration 0030 enrichie |
| 2bis | Fix bug `POST /changement/creer` + cleanup branding | ✅ TERMINÉ | PR #4 + PR #5 |
| 2ter | Cleanup DA bleu+or + masquage Phase 1 | ✅ TERMINÉ | PR #6 + PR #7 |
| 3 | Refonte création bien (express, 5-10 champs) | ✅ TERMINÉ | branche `feat/biens-nouveau-creation-express` (commit `0da0848`) |
| 4 | Refonte fiche bien (cards vue d'ensemble) | ⏭️ À FAIRE | sessions suivantes |
| 5 | Modification / suppression bien (soft delete + audit) | ⏭️ À FAIRE | sessions suivantes |

**Décisions cadrage figées** (26/04/2026, confirmées 09/05/2026 doctrine Phase 1.0) :
- Phase 1.0 = logiciel de gestion pure (le reste reporté Phase 2+).
- Pas de Stripe Connect 4 % loyers Phase 1.0. **Suivi manuel statut payé/impayé**, QR-facture auto reportée Phase 1.1.
- Pas de PPE / copropriété en Phase 1.
- Ordre des sprints macro : 12 → 13 (Invitation Locataire + Espace Locataire) → 14 (Bail upload + Loyer minimal) → 15+.

### 2.4.8 Sprint 13 — Invitation Locataire + Espace Locataire (À OUVRIR)

**Objectif** : permettre au bailleur d'inviter un locataire en 1 clic depuis la fiche bien et donner au locataire un espace dédié à SON bien.

**Scope** :
- **Module Invitation Locataire** :
  - Bouton « Inviter le locataire » sur la fiche bien.
  - 3 vecteurs au choix : lien magique, QR code imprimable (à coller sur l'EDL), email pré-rempli via Resend.
  - Token signé (JWT court ou table `invitations`), TTL 30 jours, usage unique.
  - Page publique `/invite/[token]` → création compte (email + mot de passe) → auto-link `User.bien_id` ou table `bien_locataires`.
  - **Multi-locataires (colocation)** : 1 invitation par coloc, 1 compte distinct par coloc (politique « max comptes utilisateurs » pour traçabilité audit + facturation futures).
- **Module Espace Locataire** :
  - Dashboard locataire restreint à SON bien (RLS strict).
  - Vue lecture seule : adresse, bail (PDF), paiements (historique + statut courant), documents (quittances, EDL), messagerie 1:1 avec bailleur.
  - Pas d'accès à une marketplace, pas d'accès à d'autres biens, pas de candidature spontanée.

**Critères de sortie Sprint 13** :
- 1 bailleur invite 1 locataire via lien magique → locataire crée son compte → voit la fiche bien restreinte → envoie un message au bailleur. End-to-end sans intervention manuelle.
- 1 colocation 2 locataires : 2 invitations distinctes, 2 comptes distincts, chacun voit le même bien mais avec son propre fil de messagerie.

### 2.4.9 Sprint 14 — Bail upload + Loyer minimal (À OUVRIR)

**Objectif** : permettre au bailleur d'uploader un PDF de bail signé physiquement et de suivre les loyers mensuels en mode manuel.

**Scope** :
- **Module Bail** :
  - Upload PDF du bail signé physiquement (storage Supabase bucket `documents`, type `bail`).
  - Champs structurés : date entrée, date sortie (si CDD), montant loyer + charges, fréquence, IBAN proprio.
  - Visible par le locataire dans son espace.
  - **Signature électronique Skribble = Phase 1.1** (juin/juillet 2026).
- **Module Loyer minimal** :
  - Génération automatique des échéances mensuelles à partir du bail.
  - Statut manuel : `pending` → `paid` (clic 1 bouton bailleur) ou `late`.
  - Historique paiements visible bailleur + locataire.
  - **Pas de Stripe Connect, pas de QR-facture auto, pas de relances auto** (tout reporté Phase 1.1+).

**Critères de sortie Sprint 14** :
- 1 bail uploadé sur 1 bien → 12 échéances mensuelles générées → bailleur peut marquer 1 échéance comme payée → locataire voit le statut mis à jour.

### 2.4.10 Module Changement de locataire ✅ TERMINÉ Sprint 12

**Objectif initial** : couvrir le cycle complet « locataire actuel donne préavis → recherche nouveau → checkout → checkin → terminé », avec audit complet et endpoints fiables.

**État livré au 27/04/2026** :
- 7 endpoints fonctionnels (`GET /changement/actif`, `POST /changement/creer`, `PATCH /changement/{id}`, etc.).
- 5 phases métier modélisées (`depart_annonce`, `recherche`, `checkout`, `checkin`, `termine`).
- **Migration 0030** enrichie avec 7 colonnes (5 types de résiliation suisse au sens du CO art. 266g et suivants).
- Cycle complet validé en prod sur le bien Crans-Montana (compte test Killian).
- PR #3 (fix bug 500), PR #4 (fix bug `creer`), PR #5 (cleanup branding) mergées.

**Backlog post-sprint** : refonte UX du module changement (tabs cohérents, édition inline) — reportée au sprint 16 ou 17.

### 2.4.11 Sphère IA basique

**Objectif Phase 1.0** : la sphère IA est utilisable pour les actions courantes Phase 1.0, sans agentivité autonome. Validation humaine obligatoire avant tout side effect (envoi email, modif DB, débit Stripe).

**Capacités Phase 1.0** :
- **Briefing matinal** — synthèse de l'état des biens (loyers attendus, alertes, signalements ouverts). Endpoint SSE `/sphere/briefing`.
- **Intents principaux** :
  - `creer_bien` — formulaire pré-rempli depuis description naturelle.
  - `inviter_locataire` 🆕 — déclenche le flux invitation (sprint 13).
  - `lancer_changement_locataire` — déclenche le cycle (sprint 12 livré).
  - `marquer_loyer_paye` 🆕 — bascule statut paiement (sprint 14).
  - `signaler_intervention` — crée la fiche intervention, demande détail catégorie.
  - `chat_compta` — questions simples sur la compta du proprio (« combien j'ai gagné en mars ? »).
- **OCR facture** — upload photo facture → extraction montant/date/fournisseur, proposition d'affectation OBLF.

**Garde-fous** :
- **Rate limiting** : 30 interactions/jour pour le plan starter, 100/jour pour proprio_pro.
- **Validation humaine obligatoire** avant toute action irréversible (envoi email, débit, suppression).
- **Disclaimer permanent** : la sphère propose, l'humain décide. Pas de mode autonome.
- **Pseudonymisation** des données personnelles avant envoi à Anthropic Claude (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.7).

**Hors scope Phase 1.0** (reporté Phase 1.1 / Phase 2-3) :
- Intent `relance_loyer` — reporté Phase 1.1 (relances auto).
- Intent `generer_quittance` — reporté Phase 1.1 (QR-facture auto).
- Sphère agentique (actions autonomes en chaîne) — Phase 3.
- Voice (Web Speech API) — fallback texte uniquement Phase 1.
- Suggestions cross-bien proactives — Phase 2.

### 2.4.12 Critère de sortie Phase 1.0 → Phase 1.1

**Gate dur Phase 1.0 → Phase 1.1** (toutes conditions cumulatives) :

- ✅ **10 biens Sunimmo Riviera migrés et pilotés via Althy** au 01/06/2026 (gate binaire).
- ✅ **0 bug bloquant remonté depuis 7 jours consécutifs**.
- ✅ **3+ locataires Sunimmo invités, comptes créés, accédant à leur espace dédié**.
- ✅ **1 cycle complet bail upload → 12 échéances → 1 paiement marqué payé** validé end-to-end.

### 2.4.13 Critère de sortie Phase 1.1 → Phase 2

**Gate dur Phase 1.1 → Phase 2** (toutes conditions cumulatives) :

- ✅ **130 biens Sunimmo migrés et exploités en autonomie** par Killian sans assistance technique externe.
- ✅ **Signature électronique Skribble** opérationnelle sur 1 bail réel signé.
- ✅ **QR-facture SPC 2.0 + relances automatiques** opérationnelles sur 3+ biens.
- ✅ **Compta dynamique** (transactions live, OCR factures, export Bexio/Banana) validée sur 1 cycle annuel.
- ✅ **3+ testeurs alpha externes autonomes** (au-delà de Sunimmo) ont créé un bien complet, généré un bail, suivi un loyer end-to-end.
- ✅ **Documentation utilisateur complète** (guide proprio_solo, FAQ).
- ✅ **Conformité juridique validée** par avocat (CGU, registre de traitement nLPD, AIPD module IA — cf [`6-LEGAL.md`](./6-LEGAL.md)).

→ Une fois ces 7 conditions atteintes, **Phase 2 ouverte** (lancement public payant + activation marketplace).

### 1.3 Module Bien — Sprint 12 (EN COURS)

**Objectif sprint** : transformer « 1 bien créable via UI » (acquis Phase 0 / session 11) en « 1 bien complet pilotable » — toutes les données métier accessibles à la saisie, modifiables après création, archivables, prêtes pour exploitation par une IA agentique future.

**Référence détaillée** : [`docs/session12/SPRINT-bien-complet.md`](./session12/SPRINT-bien-complet.md).

**État des étapes au 29/04/2026** :

| Étape | Description | Statut | Livrable |
|---|---|---|---|
| 1.A | Audit cohérence front ↔ back | ✅ TERMINÉ | tableau 4 colonnes, 30 gaps identifiés |
| 1.B | Priorisation gaps P1/P2/P3 | ✅ TERMINÉ | décisions cadrage 26/04/2026 |
| 2 | Fix bug 500 `/changement/actif` | ✅ TERMINÉ | PR #3 — migration 0030 enrichie |
| 2bis | Fix bug `POST /changement/creer` + cleanup branding | ✅ TERMINÉ | PR #4 + PR #5 |
| 2ter | Cleanup DA bleu+or + masquage Phase 1 | ✅ TERMINÉ | PR #6 + PR #7 |
| 3 | Refonte création bien (express, 5-10 champs) | ✅ TERMINÉ | branche `feat/biens-nouveau-creation-express` (commit `0da0848`) |
| 4 | Refonte fiche bien (cards vue d'ensemble) | ⏭️ À FAIRE | sessions suivantes |
| 5 | Modification / suppression bien (soft delete + audit) | ⏭️ À FAIRE | sessions suivantes |

**Décisions cadrage figées** (26/04/2026) :
- Phase 1 = location pure (le reste reporté).
- Pas de Stripe Connect 4 % loyers. **Paiement QR direct** (SPC 2.0). Stripe garde uniquement les abonnements (CHF 29).
- Pas de PPE / copropriété en Phase 1.
- Ordre des sprints macro : 12 → 13 → 14 → 15.

### 2.4.14 Modules reportés Phase 1.1 / Phase 2

Les modules suivants étaient initialement scopés Phase 1 (« location pure ») dans la version v5 de la roadmap. Ils sont **reportés** suite à la doctrine Phase 1.0 du 2026-05-09 :

- **Templates de baux par canton + génération auto** (VD/GE/VS puis FR/NE/JU) → **Phase 1.1**.
- **Quittances mensuelles automatiques** → **Phase 1.1** (Phase 1.0 = quittance manuelle si demandée).
- **États des lieux (EDL) refonte produit** → **Phase 2** (code actuel gelé, utilisable Phase 1.0 par Sunimmo).
- **Relances loyers impayés automatiques** (J+5 / J+15 / J+30) → **Phase 1.1**.
- **Caution (CO art. 257e)** module dédié → **Phase 1.1**.
- **OCR factures avancé + affectation IA OBLF** → **Phase 2**.
- **Signature électronique Skribble** → **Phase 1.1**.
- **Compta location annuelle + IFD assistée** → **Phase 1.1 / Phase 2**.
- **Réconciliation CAMT.054** → **Phase 1.1**.
- **Export plan comptable suisse standard** (Bexio, Banana, AbaWeb) → **Phase 2**.
- **QR-facture SPC 2.0 + génération + envoi auto + dashboard économies** → **Phase 1.1**.
- **Stripe Connect commission 3 %** → **Phase 2**.
- **Coming Soon public + alpha fermée externe** → **Phase 1.1** (Phase 1.0 = Sunimmo only, pas d'externe).

---

## 2.5 Phase 2 — Lancement public payant

**Période cible** : M7 → M12.
**Objectif** : Althy vivant par lui-même avec premiers clients payants récurrents au-delà du fondateur.

**Gate de sortie** : **10+ clients payants récurrents** + **MRR ≥ CHF 500/mois** + **churn < 10 %/mois** + **support gérable** (Killian ne passe pas 100 % de son temps en SAV).

**Étapes principales** :
- 🆕 **Activation Marketplace publique Althy** — réactivation des routes `/biens` (publique), `/biens/[id]`, `/biens/swipe` + pages SEO villes (`/lausanne`, `/geneve`, `/fribourg`, `/neuchatel`, `/sion`, `/valais`, `/vaud`). Suppression du middleware redirect Phase 1.0. Réactivation des composants `LandingBiens.tsx` + `BiensRecoCards.tsx` dans la landing.
- 🆕 **Candidature spontanée + scoring IA candidature** — réactivation du modèle `Candidature`, du scoring `tenants.ai_score` (0-100), du dossier IA détaillé. Endpoint `POST /candidatures` réouvert.
- 🆕 **Frais propriétaire CHF 45 à l'acceptation** (migration 0033 déjà en place, colonnes `owner_fee_*` sur `candidatures`) — réactivation du prélèvement Stripe off-session.
- 🆕 **Diffusion portails externes** — Homegate, ImmoScout24, Flatfox, immobilier.ch. Stratégie : Althy = distributeur low-cost négocié en volume avec SMG/Homegate.
- 🆕 **Réseaux sociaux + acquisition virale** — campagnes Instagram/LinkedIn, référencement SEO marketplace, programme parrainage public.
- **Activation rôles agence + portail_proprio** — flags `true`, ajout à `ALLOWED_SIGNUP_ROLES`. Dashboard agence (Scénario B : comptes agence séparés avec vue multi-propriétaires + permissions + facturation agence).
- **Compta dynamique** — transactions live mettent à jour le rendement net en temps réel. Comparaison vs marché via estim IA (« vous êtes 8 % en dessous du marché à Lausanne »).
- **Architecture unifiée** — refactor vers modules globaux filtrés (`/app/locataires?bien_id=…` au lieu de `/app/biens/[id]/locataire`). Cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md) §3.11.
- **Tunnel Stripe complet** — abo CHF 29 + 4 packs diffusion (cf [`5-FINANCES.md`](./5-FINANCES.md#53-sources-de-revenus-par-phase) §5.3). Trial 14 jours sans carte → CHF 29 au M15.
  - **Découverte** (CHF 0, inclus abo) — Althy + Flatfox.
  - **Standard** (CHF 9/mois) — + 1 canal au choix (Homegate OU ImmoScout24).
  - **Pro** (CHF 19/mois) — + Homegate + ImmoScout24 + immobilier.ch.
  - **Premium** (CHF 29/mois) — tous canaux + boost IA fiche annonce + remontée prioritaire.
  - Stratégie portails : Althy = distributeur low-cost, pas concurrent. Négociation volume avec SMG/Homegate. Cf [`1-VISION.md`](./1-VISION.md#16-stratégie-agences-et-portails) §1.6.
- **Activation i18n DE** — traduction complète UI + templates emails DE + templates baux/quittances DE. CH alémanique ouverte (`LOCALES_ENABLED += 'de-CH'`).
- **Email nurturing 5 séquences** — Welcome / Onboarding / Re-engagement / Churn prevention / Upsell.
- **Programme parrainage** — crédit 1 mois gratuit parrain + filleul.
- **Juridique pro** — CGU / CGV validés par avocat CH. Dépôt marque EUIPO (CHF 1100). Export RGPD / droit à l'oubli.
- **Mode démo public `/demo`** — compte démo pré-rempli pour prospect agence.
- **Centre comptable agrégateur intelligent** — collecte automatique des écritures (Transaction + Invoice + ChargeLine + WorkOrder.cout + commissions) + catégorisation client/mandat/bien + KPI efficacité (« 94% sur ce bien, 76% sur celui-là ») + insights IA d'amélioration. Export 1 clic vers Bexio API / Banana XML / AbaWeb / Excel / PDF récap. Pour proprio_solo et agence. Pas un ERP type SAP — un agrégateur qui prépare le terrain pour le fiduciaire externe.
- **Module Locataire idéal IA** — profil cible auto-généré pour chaque bien vacant + matching candidatures + détection risques. Cf [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md).
- **Module Marché local** — tension locative ville/canton + comparables + recommandations IA prix optimal (DB Althy propriétaire en construction).
- **Module Optimisation fiscale IA** — suggestions travaux à déduire selon barème AFC + plafonds non utilisés + simulations N+1.
- **Communication multi-canaux** — WhatsApp Business intégré + email centralisé + SMS Twilio + traduction auto FR/DE/IT/EN.
- **Intégrations partenaires P2** — Caution électronique (FirstCaution / GoCaution / Swisscaution API) + Assurance RC ménage (La Mobilière / Generali API) + Déménagement (Movu / MoveAgain API).
- **TVA module light** — assujetti / numéro / méthode / fréquence / taux par défaut. Décompte trimestriel auto.

---

## 2.6 Phase 3 — Marketplace 3 acteurs

**Période cible** : M13 → M18.
**Objectif** : Althy devient un écosystème professionnel avec 3 nouveaux flux de revenus via commissions marketplaces.

**Gate de sortie** : **10+ Openers actifs** + **10+ Artisans actifs** + **5+ Hunters actifs avec transactions conclues** + **commissions marketplaces = 20 % du MRR total**.

**Étapes principales** :
- **Marketplace Openers** — inscription + profil + zone + tarif → mission visite/EDL/check-in → commission Althy 10-15 %. Notation bidirectionnelle.
- **Marketplace Artisans** (généralisation au-delà de M1) — match IA → devis comparé → exécution → commission Althy 5 % via Stripe Connect.
- **Audit IA matériaux** sur devis interventions — comparaison prix marchés, conseils, alerte si surfacturation.
- **Fonction Hunters cross-produit** — n'importe quel utilisateur active « mode Hunter » sur un bien avec accord proprio. Champs `hunter_id` + `hunter_commission_rate` sur `Bien`. Split commission à la conclusion. Slogan UX intégré : « finance ton réseau ». Applicable location (Phase 3) + vente (Phase 4).
- **IA de matching transversal** — Opener / Artisan / agence partenaire le plus pertinent selon bien + localisation + historique + disponibilités.
- **Conformité légale CH** — cadrer avec avocat spécialisé la conformité de l'activité d'apport d'affaires immobilier (réglementation cantonale).
- **Module Valorisation du bien** — DB Althy cadastre VSGIS + couches risques + COS restant constructible + comparables vendus + estimation 2030 + score d'opportunité (vendre / garder / valoriser). Cf [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md).
- **Module Maintenance prédictive** — pannes anticipées (chaudière / toiture) + calendrier entretien + budget travaux 5 ans + subventions cantonales applicables.
- **Module Assistant vocal** — commande vocale (« Althy, mon locataire Crans n'a pas payé, prépare une relance ») + briefing audio + intégration Siri / Google Assistant + multimodal photo+description.
- **Agent IA autonome niveau 1** — mode suggérer / agir avec confirmation. 4 niveaux d'autonomie configurables : jamais / suggérer / agir avec confirmation / agir librement. Limites monétaires + actions autorisées.
- **Communauté proprios** — forum + avis artisans communautaires + bons plans + webinaires (taxes / juridique / IA) + référencement Hunters.
- **Intégrations partenaires P3** — Internet (Salt / Sunrise / Swisscom API) + Énergie (BKW / Romande Energie) + Travaux d'urgence 24/7 (Easyfix / réseau artisans).
- **TVA module medium** — prorata + correction préalable + surface commerciale/habitation.
- **Centre comptable agence version full** — multi-mandat + bilan simplifié + insights IA cross-mandats.

---

## 2.7 Phase 4 — Resales (vente immobilière)

**Période cible** : M19 → M24.
**Objectif** : Althy couvre le 2e pilier produit — la vente immobilière. Même logique que la location, adaptée à la vente.

**Gate de sortie** : **5+ ventes effectuées via Althy** + **module vente = 30 % du MRR total** + **Hunters actifs sur ventes** (pas juste locations).

**Étapes principales** :
- **Bascule mode vente** sur le modèle `Bien` (location ↔ vente, historique préservé).
- **Calcul automatique impôts / taxes / plus-values / déductions** adapté au canton CH.
- **Potentiel constructible** — cadastre suisse + réglementation communale.
- **Diffusion vente sur portails** — Homegate, ImmoScout24, immobilier.ch en mode vente.
- **Marketplace agences immo partenaires** — directory + matching + commission Althy sur mandats.
- **Accompagnement démarches IA** — notaire / architecte / expert immobilier / banque (partenariats).
- **Marketplace Openers vente** — visites vente avec pro dédié, pricing différent (engagement plus lourd).
- **Compta agence complète** (déclenchée Phase 4) — EBITDA live, charges, salaires, audit IA rentabilité par mandat.
- **Agent IA autonome niveau 2** — limites monétaires élargies + actions complexes + audit complet.
- **TVA module full** — TVA sur vente + saisonnier + parking commercial + option TVA volontaire.
- **Centre comptable agence enterprise** — audit forensique + clôtures + multi-société.

---

## 2.8 Phase 5+ — Expansion DACH + Hub IA (EXPLORATOIRE)

**Période cible** : An 3+. Détails non figés — re-priorisation selon les retours produit réels et les données d'usage.

**Pistes principales** :
- **Activation locales** — `it-CH` (Tessin) + `en` (expatriés + communication internationale).
- **DACH** — Zurich early adopters → Munich → Berne. Potentiellement France voisine (Annemasse, Thonon, bassin emploi CH).
- **Hub conversationnel IA** (vision long terme Killian) :
  - WhatsApp Cloud API (Meta) — lecture messages propriétaire + IA propose actions contextuelles.
  - Microsoft Graph (Azure/Outlook) — lecture boîte mail + calendrier.
  - Infomaniak kMail API — pour utilisateurs Infomaniak.
  - Pattern unifié `InboxParser` backend + UX conversation dans Althy avec suggestions d'action IA.
- **App mobile** — PWA installable (couvre 80 % des cas pour 5 % du coût). App native iOS/Android si demande prouvée.
- **Channel manager Airbnb / Booking nuitée** — uniquement si demande utilisateur prouvée. Module PMS-hôtelier complet (calendrier disponibilités, prix dynamique, codes serrure temporaires, taxe séjour). Saisonnier 4 mois mensualisé (saison hiver Crans/Verbier/Zermatt) reste géré dès Phase 1 via `Contract.type = "seasonal"` — pas de PMS, simple variante de bail.
- **Agent IA autonome niveau 3** — autonomie quasi totale dans limites définies. Vision long terme.
- **Extensions exploratoires NON figées** :
  - Gestion de copropriété (PPE).
  - Gestion portefeuille investisseur (ROI, cashflow, benchmarks).
  - Intégrations bancaires CH (UBS, Raiffeisen, PostFinance APIs).
  - Indice Althy des loyers romands (revente données aux banques).
  - API B2B données marché.
  - Abonnement acheteur premium.

---

## 2.9 Sprint en cours

**Sprint 12 — Bien complet** (ouvert le 26/04/2026).

Objectif : 1 bien créable + complet + modifiable + archivable, avec triple test « 1 clic » passé sur tout le flow.

État au 29/04/2026 : étapes 1-3 terminées (5 PRs mergées + 1 PR ouverte), étapes 4-5 à venir.

Détail complet : [`docs/session12/SPRINT-bien-complet.md`](./session12/SPRINT-bien-complet.md).

**Sprint suivant prévu** : **Sprint 13 — Invitation Locataire + Espace Locataire** (cf §2.4.8), conditionné à la clôture du sprint 12. Note doctrine 2026-05-09 : l'ancien plan « Sprint 13 Documents par bien » est reporté Phase 1.1 (cf §2.4.14).

---

## 2.10 Règles transverses (toute la durée du projet)

**Règle 1 — Pas de phase N+1 avant phase N validée.** Les critères de sortie sont des gates durs, pas des indicateurs.

**Règle 2 — Discipline technique inchangée.** Tout chantier suit la méthode : cartographie → cross-check backend → patch atomique → peer review → STOP+remontée si anomalie.

**Règle 3 — Dette technique acceptée mais tracée.** Chaque compromis = ligne dans la doc avec échéance et priorité.

**Règle 4 — Jalons business = jalons techniques.** Chaque fin de phase = push stable + tag git + section roadmap fermée + backup Supabase manuel.

**Règle 5 — Pas d'intégration nouvelle parallèle à un chantier incomplet.** Le hub IA, on y pense, on ne l'ouvre pas tant que Phase 3 n'est pas bouclée. Même si ça brûle.

**Règle 6 — La roadmap se met à jour uniquement sur événement réel.** Pas de re-discussion « pour le fun ».

**Règle 7 — i18n-ready dès Phase 1.** Aucune string UI hardcodée en FR. Tout passe par le système i18n. Aucun template backend (email, PDF, bail, quittance) hardcodé en FR. Tout templatisé par locale. Cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md) §3.7.

**Règle 8 — Interaction directe « 1 clic » sur chaque carré.** Depuis n'importe quelle entité parente (fiche bien, fiche locataire, fiche mandat), on accède et modifie ses entités liées sans changer de page. Chaque carré dans une fiche doit permettre 3 capacités minimales : (1) voir le détail (clic ligne → modale ou side panel), (2) créer un nouveau (bouton + dans le carré), (3) modifier l'existant (clic ligne → mode édition). Les sections globales (`/app/interventions`, `/app/locataires`, `/app/documents`) sont des vues consolidées multi-biens, jamais le seul point d'accès à une entité. Cf [`4-PRODUIT.md`](./4-PRODUIT.md) + [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md).

**Règle 9 — Discipline `.env`.** Un seul `.env` actif par environnement. Noms autorisés figés dans `backend/` et `frontend/` : `.env`, `.env.example`, `.env.local`, `.env.staging`, `.env.production`. Tout suffixe exotique (`.env.backup`, `.env.migration`, `.env.prod-*`, `.env.temp`…) est interdit — risque de switch accidentel sur des secrets périmés. Pour un preset temporaire (variant DB pour migration, etc.), créer le fichier hors du repo dans `~/althy-archives/env-historiques-YYYY-MM/`. Sprint dédié « Séparation dev/staging/prod » à programmer pré-clients payants Phase 2 (livrables : script `switch-env.sh`, cleanup `.env.*`, régénération clés staging). Cf [`CLAUDE.md`](../CLAUDE.md) §B.14 + §F.

**Règle 10 — Discipline scope Phase 1.** Phase 1 = logiciel de gestion pure. Toute feature qui touche à l'acquisition publique (marketplace publique, candidature spontanée, scoring IA candidature, frais propriétaire CHF 45, diffusion portails Homegate/ImmoScout24/Flatfox/immobilier.ch, SEO marketplace, réseaux sociaux, viralité externe) est **interdite en Phase 1**, même si techniquement faisable. Cas exceptionnels : demande Killian explicite + entrée backlog documentée. Toute prompt utilisateur ou demande qui implique l'un de ces périmètres déclenche un STOP (cf [`CLAUDE.md`](../CLAUDE.md) §B.15). Inventaire exhaustif périmètre interdit Phase 1.0 + code dormant : §2.4.5 + §2.4.6.

---

## 2.11 Backlog vision long terme (post-Phase 5)

Modules mentionnés ici pour ne pas les oublier — **pas roadmappés** :

- **Compta agence complète** — EBITDA live, charges, salaires, audit IA rentabilité par mandat.
- **Sphère IA agentique** — actions autonomes avec validation post-hoc plutôt que pré-action.
- **Mobile native** — vraie app iOS/Android si demande prouvée.
- **Channel manager Airbnb / Booking nuitée** — uniquement si demande utilisateur prouvée. À ne pas confondre avec saisonnier 4 mois mensualisé qui est déjà géré dès Phase 1 via `Contract.type = "seasonal"`.
- **PPE / copropriété** — gestion charges communes, AG, décisions.
- **Compta avancée multi-comptes** — multi-IBAN par bien, rapprochement multi-banques.
- **Accompagnement démarches IA** — notaire, architecte, expert immobilier, banque.

Ces modules font partie de la vision Althy validée. Ils ne sont **pas abandonnés**. Ils sont reportés post-Phase 5 pour éviter la dispersion. La doctrine reste : excellence Phase N avant d'élargir Phase N+1.

---

## 2.12 Historique des versions

- **v1** (24 avril 2026, matinée) — draft initial après brainstorm vision.
- **v2** (24 avril 2026, après-midi) — correction Hunters (rôle ouvert à tous, pas phase à part, slogan « finance ton réseau »).
- **v3** (24 avril 2026, après-midi) — ajout i18n complet (FR → DE → IT + EN) + Règle 7. Version figée.
- **v3.1** (25 avril 2026) — MAJ État actuel post-merge fusion + post-migration 0029 prod.
- **v3.2** (26 avril 2026) — Session 11 clôturée VERT + sprint 12 ouvert.
- **v4** (29 avril 2026) — **Refonte documentaire complète**. `ROADMAP.md` racine archivé. Nouveau format en 6 docs vivants (1-VISION + 2-ROADMAP + 3-ARCHITECTURE + 4-PRODUIT + 5-FINANCES + 6-LEGAL). Phase 0 marquée terminée. Sprint 12 référencé court avec lien vers détail. Phases 2-5 condensées en Style B.
- **v5** (30 avril 2026) — MAJ post-sprint refonte stratégique : renommage narratif phases (Assistant/Intelligence/Écosystème/Pilotage Patrimonial/Agent Autonome). Ajout Règle 8 « 1 clic interaction directe ». 4 packs diffusion P2 (au lieu de canaux 9 CHF). Ajout Centre comptable P2-3. Ajout 10 modules IA premium (Valorisation, Marché local, Optimisation fiscale, Maintenance prédictive, Locataire idéal IA, Communication multi-canaux, Assistant vocal, Intégrations partenaires, Agent IA autonome, Communauté proprios) répartis P2-P5+. Précision saisonnier 4 mois P1 vs nuitée P5+. Référence à 7-CATALOGUE-DONNEES-ALTHY.md ajoutée.
- **v6** (9 mai 2026) — **Refonte stratégique Phase 1 → Phase 1.0 (logiciel de gestion) + Phase 1.1 (compléments)**. Marketplace publique, candidature spontanée, scoring IA candidature, frais propriétaire CHF 45, diffusion portails (Homegate/ImmoScout24/Flatfox/immobilier.ch), 4 packs diffusion, acquisition publique = **tous reportés Phase 2** (cf §2.5). Cible commerciale immédiate Phase 1.0 = migration progressive Sunimmo Riviera (10 biens au 01/06/2026). 5 modules Phase 1.0 : Bien, Invitation Locataire 🆕, Espace Locataire 🆕, Bail (upload PDF), Communication minimale, Loyer minimal. Code marketplace + scoring conservé **dormant** (cf §2.4.6). Ajout Règle 10 « Discipline scope Phase 1 » §2.10. SMS Twilio reporté Phase 1.1+. EDL refonte produit reportée Phase 2 (code actuel gelé).

**Prochaine révision** : uniquement sur événement concret (clôture sprint 12, livraison Sprint 13 Invitation Locataire, gate 10 biens Sunimmo migrés au 01/06/2026, feedback alpha contradictoire).
