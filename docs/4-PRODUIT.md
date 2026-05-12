# 4. Produit Althy

> **Source de vérité unique** pour la spec fonctionnelle.
> Last update : 2026-05-09 (v6 — refonte §4.7 Module Invitation Locataire + §4.13 Communication minimale Phase 1.0)
> Audience : Killian, équipe produit, designers, Claude Code.
> Entité opérationnelle : **HBM Swiss Sàrl** (CHE-179.984.757 TVA).

---

## 4.1 Les 9 rôles utilisateurs

| Rôle | Phase | Flag | Dashboard | Statut |
|---|---|---|---|---|
| `super_admin` | technique | toujours | DTopNav admin + admin pages | ✅ actif |
| `proprio_solo` | 1.0 | toujours | `DashboardProprioSolo` | ✅ actif |
| `locataire` | 1.0 | toujours (via invitation uniquement) | `DashboardLocataire` (espace dédié à SON bien) | ✅ actif (cf §4.7 doctrine v6) |
| `agence` | 2 | `NEXT_PUBLIC_FLAG_AGENCE` | `DashboardAgence` | 🔮 ComingSoon |
| `portail_proprio` | 2 | `NEXT_PUBLIC_FLAG_PORTAIL` | `DashboardPortailProprio` | 🔮 ComingSoon |
| `artisan` | 3 | `NEXT_PUBLIC_FLAG_ARTISAN` | `DashboardArtisan` | 🟡 partiel gelé (M1 GE+VD) |
| `opener` | 3 | `NEXT_PUBLIC_FLAG_OPENER` | `DashboardOpener` | 🔮 ComingSoon |
| `expert` | 3 | hardcoded `false` | `DashboardExpert` | 🔮 ComingSoon |
| `hunter` | post-3 | hardcoded `false` | `DashboardHunter` | 🔮 Phase 4 |
| `acheteur_premium` | post-5 | hardcoded `false` | `DashboardAcheteur` | 🔮 Phase 5+ |

**Mapping phases narratives** (cf [`1-VISION.md`](./1-VISION.md#111-vision-long-terme) §1.11 + [`2-ROADMAP.md`](./2-ROADMAP.md#22-synthèse-visuelle) §2.2) :

| Phase | Nom narratif | Rôles activés |
|---|---|---|
| 1 | L'Assistant | `proprio_solo`, `locataire`, `super_admin` (+ `artisan` partiel M1 GE+VD) |
| 2 | L'Intelligence | + `agence`, `portail_proprio` |
| 3 | L'Écosystème | + `opener` (full), `artisan` (généralisé), `expert` |
| 4 | Le Pilotage Patrimonial | + `hunter` cross-produit (location + vente) |
| 5+ | L'Agent Autonome | + `acheteur_premium` |

Le rôle `hunter` est **transversal** : tout user Althy (proprio, agence, voisin, ami) peut activer « mode Hunter » sur un bien avec accord du proprio. Slogan : *« Finance ton réseau »*.

> **Note de comptage** : 9 rôles techniques dans le code (10 si on compte `acheteur_premium`) = **8 profils utilisateurs métier** + `super_admin` (rôle technique). Les 8 profils métier reflètent les 8 personas business du BP. Le rôle `super_admin` est technique (Killian + futurs admins ops).

**Mappings legacy** : `owner` → `proprio_solo`, `agency` → `agence`, `tenant` → `locataire`, `company` → `artisan`. Source : `frontend/src/lib/hooks/useRole.ts`.

**Source code** : `frontend/src/lib/hooks/useRole.ts` (`ROLE_SECTIONS`) + `frontend/src/lib/flags.ts` (`FLAGS`) + `backend/app/core/config.py` (`ALLOWED_SIGNUP_ROLES`).

**Plan d'activation détaillé** : §4.14 + [`2-ROADMAP.md`](./2-ROADMAP.md).

---

## 4.2 Mot d'ordre « 1 clic » + triple test

Toute décision design — UI, schéma DB, endpoint, naming — passe un **triple test obligatoire** :

✅ **Simple pour l'utilisateur** — 1 clic, vocabulaire clair (« loyer mensuel » et pas `rent_amount_monthly`), pas de jargon brutal, pas de friction inutile. Le grand-père doit comprendre.

✅ **Complet pour le pro** — aucun champ métier sacrifié, aucun écran amputé sous prétexte de simplicité. Une régie qui regarde Althy doit y voir tout ce qu'elle a dans son logiciel actuel — plus l'intelligence en plus.

✅ **Lisible pour une IA agent future** — structure sémantique forte (champs nommés explicitement, enums plutôt que strings libres), events traçables (`audit_log` à jour), état du bien introspectable depuis n'importe quel point du code (pas de state caché en mémoire React).

Si une livraison échoue **un seul** des trois critères → retour à la planche à dessin.

### Règle 8 — Interaction directe « 1 clic » sur chaque carré

Doctrine architecturale figée v5 (cf [`2-ROADMAP.md`](./2-ROADMAP.md#210-règles-transverses-toute-la-durée-du-projet) §2.10 + [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md#312-conventions-code) §3.12) :

> Depuis n'importe quelle entité parente (fiche bien, fiche locataire, fiche mandat), l'utilisateur accède et modifie ses entités liées **sans changer de page**.

**Application produit** :
- Chaque carré (`DCard`) dans une fiche entité expose **3 capacités** : (1) **voir le détail** (clic ligne → modale ou side panel), (2) **créer un nouveau** (bouton `+` dans le header du carré), (3) **modifier l'existant** (clic ligne → mode édition inline ou modale).
- Les sections globales (`/app/interventions`, `/app/locataires`, `/app/documents`) sont des **vues consolidées multi-biens**, jamais le seul point d'accès à une entité.
- **3 patterns de modale** :
  - **Fullscreen** : édition de l'entité elle-même (caractéristiques bien, profil utilisateur).
  - **Side panel droit 50%** : pilotage sous-entité liée (intervention, devis, paiement, candidature).
  - **Modale rapide** (max 480px) : actions ponctuelles (confirmation, note rapide).
- **Source de vérité granulaire** : [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) — pour chaque carré de chaque rôle, le catalogue liste les données affichées et les actions 1 clic accessibles.

### Patterns appliqués

- **Création bien express** (sprint 12 ✅) — 8 champs au lieu de 30+. Auto-fill canton depuis NPA. Titre auto-généré « Type, Adresse, Ville ».
- **Édition inline** (sprint 12 étape 4 🔄) — pas de modal pour modifier un champ unique. Double-click → édition → auto-save avec optimistic update.
- **Cards interactives** (sprint 12 étape 4) — pas de menus imbriqués. Click sur la card « Locataire » → navigation directe vers la sous-page (Phase 1) ou le module global filtré (Phase 2-3).
- **Pas de hard delete** — toute action irréversible nécessite un double clic + confirmation explicite.

### Direction artistique scientifique

Doctrine v5 figée (cf [`1-VISION.md`](./1-VISION.md#11-le-concept-en-1-phrase) §1.1 + [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md#36-direction-artistique) §3.6) : esthétique scientifique (discipline, rigueur, ordre). Les UI métier suivent le pattern **carrés (cards) avec données majeures + clic pour le détail**. Graphiques (courbes rendement, barres comparatives, donuts répartition), organigrammes (workflows interventions, pipelines candidatures), tableaux structurés (configurables tri/filtre/colonnes), timelines (audit log, historique bien), cartes interactives (vue géographique, cadastre VSGIS).

**Sentiment cible** : *« on a l'impression de jouer quand on gère son bien »* — gamification subtile par la donnée. KPI gros chiffres avec variations colorées. Badges sémantiques (vert/ambre/rouge/or).

**Cible UX double** : grand-père qui gère 1 appartement à Lausanne ↔ Bernard Nicod qui pilote 5000 lots. Le même produit doit servir les deux sans compromis. Toggle vue (cartes/table/carte interactive) selon volume.

---

## 4.3 La Sphère IA

**Concept** : interface conversationnelle principale, accessible depuis tout l'app via la sphère flottante (`SphereWidget`). L'utilisateur écrit (ou dit, plus tard) en langage naturel. La sphère comprend l'intent, propose une action, demande validation.

**Implémentation visuelle par phase** : **Phase 1** = gradient CSS sobre (composant `AlthySphere.tsx` actuel). **Phase 2+** = remplacement par asset designer externe premium (Lottie / Three.js / WebGL animation) pour atteindre le niveau de finition cible Anthropic / Apple Siri. Décision figée 30/04/2026 : on ne lance pas l'option designer externe avant que Phase 1 soit fonctionnelle (priorité = produit qui marche, pas wow effect prématuré).

**Source code** : `backend/app/routers/sphere_agent.py` + `backend/app/services/ai_service.py` + `frontend/src/components/sphere/AlthySphere.tsx`.

### Capacités v1 (Phase 1)

| Capacité | Endpoint backend | Statut |
|---|---|---|
| Briefing matinal | `GET /sphere/briefing` (SSE) | ✅ Active |
| Chat conversationnel | `POST /sphere/chat` (SSE) | ✅ Active |
| Création bien depuis description | `POST /sphere/parse-location` | ✅ Active |
| Génération description bien | `POST /sphere/rediger-description` | ✅ Active |
| OCR facture | `POST /sphere/ocr-facture` | 🟡 Partiel |
| Voice action | `POST /sphere/voice-action` | 🔮 Phase 2 |

### Intents principaux Phase 1

- `creer_bien` — formulaire pré-rempli depuis description naturelle
- `lancer_changement_locataire` — déclenche le cycle (sprint 12 livré)
- `relance_loyer` — propose le brouillon, demande validation envoi
- `generer_quittance` — propose le PDF, validation puis envoi
- `signaler_intervention` — crée la fiche intervention, demande détail catégorie
- `chat_compta` — questions simples sur la compta du proprio

### Garde-fous

- **Validation humaine obligatoire** avant toute action irréversible (envoi email, débit, suppression, génération document signé).
- **Disclaimer permanent** : « Réponses IA à titre indicatif, validation utilisateur requise ».
- **Pseudonymisation** des données personnelles avant envoi à Anthropic Claude (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.7).
- **Rate limiting** : 30 interactions/jour pour `starter`, 100/jour pour `proprio_pro`. Au-delà : réponse simplifiée (fewer tokens).
- **Audit log** : toute interaction sphère + action proposée + validation user → tracée dans `ai_sessions`.

### Hors scope Phase 1 (reporté)

- Sphère agentique (actions autonomes en chaîne) → Phase 3.
- Voice (Web Speech API) — fallback texte uniquement Phase 1.
- Suggestions cross-bien proactives (« tu pourrais augmenter le loyer du bien X ») → Phase 2.

---

## 4.4 Pages publiques

Source : `frontend/src/app/(landing)/`.

| Page | Route | Rôle |
|---|---|---|
| Landing principale | `/` | Hero + sphère + features + témoignages + CTA inscription |
| Estimation IA | `/estimation` | Lead magnet acquisition (sans inscription) |
| Inscription | `/register` | Filtrée par `LOCALES_ENABLED` + flags Phase 1 |
| Connexion | `/login` | Supabase Auth |
| Reset mot de passe | `/reset-password` | Supabase Auth |
| Coming Soon par rôle | `/bientot/[role]` | Waitlist email pour rôles désactivés Phase 1 |
| Mentions légales | `/legal` | Source : `lib/legal-entity.ts` (HBM Swiss Sàrl, IDE) |
| CGU | `/legal/cgu` | Markdown rendered depuis `frontend/src/legal/CH/cgu.md` |
| Confidentialité | `/legal/confidentialite` | Markdown depuis `frontend/src/legal/CH/confidentialite.md` |
| Cookies | `/legal/cookies` | Markdown depuis `frontend/src/legal/CH/cookies.md` |
| Disclaimer IA | `/legal/disclaimer-ia` | Markdown depuis `frontend/src/legal/CH/disclaimer-ia.md` |
| Acceptation invitation locataire 🆕 | `/invite/[token]` | Création compte locataire auto-linké au bien (sprint 13, cf §4.7) |
| Marketplace publique | `/biens` + villes (`/lausanne`, `/geneve`, `/fribourg`, `/neuchatel`, `/sion`, `/valais`, `/vaud`) + `/biens/[id]` + `/biens/swipe` | 🚫 **CODE DORMANT Phase 2 (doctrine v6 — 2026-05-09)** — pages présentes en repo, accessibles via middleware redirect (`/biens*` → `/app` si auth, → `/` sinon). Réactivation Phase 2. Cf [`2-ROADMAP.md`](./2-ROADMAP.md) §2.4.6. |

### Règle absolue témoignages

- Tout témoignage = **sourçable, daté, vérifiable**.
- Témoignage "Patrick M." (130 biens fondateur) : **RETIRÉ** de la landing (LCD art. 3 al. 1 let. b).
- "2 847 estimations réalisées" : **RETIRÉ** (non vérifiable).
- "130 biens gérés" : à clarifier (= biens Sunimmo, séparation marque).

Détail : [`6-LEGAL.md`](./6-LEGAL.md) §6.8.

---

## 4.5 Pages dashboard

**Source** : `frontend/src/app/app/(dashboard)/` — **61 pages routées par rôle**.

**Layout** :
- `DashboardLayoutClient` (auth guard + role guard + écran « en préparation » pour rôles désactivés)
- `DTopNav` (header avec breadcrumb + recherche + sphère + profil)
- Sidebar dynamique selon `useRole()` → `ROLE_SECTIONS`

**Pages clés Phase 1** :
- `/app` — dashboard principal (KPIs + actions du jour)
- `/app/biens` — liste biens
- `/app/biens/[id]` — fiche bien (vue cards refonte sprint 12 étape 4 🔄)
- `/app/biens/nouveau` — création express ✅ (sprint 12 étape 3, branche `feat/biens-nouveau-creation-express`)
- `/app/locataires` — CRM locataires
- `/app/finances` — loyers + revenus + charges
- `/app/documents` — bibliothèque documents
- `/app/interventions` — signalements
- `/app/sphere` — sphère IA plein écran
- `/app/settings` — préférences + abonnement + paiement

---

## 4.6 Module Bien

### Création express (sprint 12 étape 3 ✅)

**Branche** : `feat/biens-nouveau-creation-express` (commit `0da0848`).

**8 champs Phase 1 critiques** :
1. `type_bien` (enum : appartement, maison, etc.)
2. `titre` (auto-généré « Type, Adresse, Ville », modifiable)
3. `adresse` — rue
4. `adresse` — ville
5. `adresse` — npa (4 chiffres CH)
6. `adresse` — canton (auto-fill depuis NPA via `swiss-postal-codes.ts`)
7. `surface_habitable` (m², obligatoire)
8. `loyer_charges_inclus` (CHF, optionnel)
+ `nb_pieces` (optionnel, step 0.5 pour pièces 1/2 CH)

**UX** : 1 page, 3 sections (Titre / Localisation / Caractéristiques + Loyer), 1 clic submit, toast succès, redirect vers fiche bien.

**Auto-fill canton** : helper `frontend/src/lib/swiss-postal-codes.ts` couvre les 26 cantons CH par plages NPA officielles La Poste Suisse. Couverture ~90 %, fallback manuel pour les 10 % restants.

**Aucun champ obligatoire au-delà de ces 8** — politique « backend permissif, UX discipline » alignée avec backend `BienCreate` (3 obligatoires : adresse, ville, cp).

### Fiche Bien (sprint 12 étape 4 🔄 EN COURS)

**Vision** : vue d'ensemble en **cards** (pas tabs). Hiérarchie visuelle :

```
┌─────────────────────────────────────────────────┐
│ Header bien : titre + adresse + statut + photo │
└─────────────────────────────────────────────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
│ Card     │ │ Card     │ │ Card     │ │ Card    │
│ Loca-    │ │ Finance  │ │ Estim    │ │ Inter-  │
│ taire    │ │          │ │ IA       │ │ ventions│
└──────────┘ └──────────┘ └──────────┘ └─────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
│ Card     │ │ Card     │ │ Card     │ │ Card    │
│ Documents│ │ Histo-   │ │ Change-  │ │ Poten-  │
│          │ │ rique    │ │ ment     │ │ tiel IA │
└──────────┘ └──────────┘ └──────────┘ └─────────┘
```

**Source de vérité granulaire** : pour chaque carré de la fiche bien, voir [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) — la rubrique « Rôle 1 — proprio_solo / SECTION UI : Fiche bien » liste exhaustivement (1) les ~30 champs du header (identité, caractéristiques techniques, équipements, distances, conditions location, description publique, fiscalité), (2) les 6 carrés (Locataire, Finances, Estimation IA, Interventions, Documents, Historique) avec les données affichées + actions 1 clic, (3) les modales associées (gestion photos, caractéristiques lecture/édition, side panel intervention), (4) les sous-sections enrichies P2-P4 (Valorisation IA, Maintenance prédictive, Marché local, Optimisation fiscale IA).

Chaque card affiche un résumé (3-5 lignes), une action principale (1 clic), et un lien vers la sous-page complète. Click sur la card → navigation vers la sous-page existante (Phase 1) ou le module global filtré (Phase 2-3 — cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md) §3.11).

### Édition inline + optimistic update

**Pattern Notion** : double-click sur un champ → édition inline → blur ou Enter → save backend. Optimistic update frontend, rollback visuel + toast erreur si backend rejette.

**Source code** : `frontend/src/lib/useBiens.ts` → `useUpdateBien` (déjà en place ligne 271).

### Modification / archivage soft delete (sprint 12 étape 5 ⏭️)

- **Pas de hard delete** (préservation audit nLPD — cf [`6-LEGAL.md`](./6-LEGAL.md) §6.12).
- `is_active = false` pour archive.
- Filtre par défaut : `WHERE is_active = true` partout.
- Bouton « Archiver » 1 clic + écran de confirmation (action irréversible-ish).
- Audit log capture l'action (`audit_log.action = "archive"`, `old_values` / `new_values`).

---

## 4.7 Module Invitation Locataire + Espace Locataire

> **Doctrine Phase 1.0 (figée 2026-05-09)** : pas de marketplace publique, pas de candidature spontanée, pas de scoring IA candidature. Le bailleur **invite manuellement** chaque locataire ; chaque locataire a un **espace dédié à SON bien** (pas d'accès à une marketplace ni à d'autres biens). Cf [`2-ROADMAP.md`](./2-ROADMAP.md#24-phase-10--logiciel-de-gestion-sunimmo-test-) §2.4.

### Module Invitation Locataire (Phase 1.0 🆕 — Sprint 13)

**Flux nominal** :

1. Bailleur sur la fiche bien → bouton « **Inviter le locataire** ».
2. Choix du vecteur (1 sur 3) :
   - **Lien magique** — URL signée, copier/coller, transmissible WhatsApp / SMS / mail perso.
   - **QR code imprimable** — à coller sur l'EDL papier ou sur la porte.
   - **Email pré-rempli via Resend** — saisie email locataire → envoi automatique avec template `invite_locataire`.
3. Token : table `invitations` (à créer migration sprint 13) ou JWT court signé. Champs minimaux : `id`, `bien_id`, `email_destinataire?`, `created_at`, `expires_at` (TTL 30 jours), `used_at?`, `used_by_user_id?`.
4. Page publique `/invite/[token]` :
   - Validation token (non expiré, non utilisé, bien actif).
   - Création compte locataire (email + mot de passe Supabase Auth).
   - Auto-link `User.bien_id` ou écriture dans table de jointure `bien_locataires`.
   - Marquage `invitations.used_at` + `used_by_user_id`.
5. Redirect vers `/app` → dashboard locataire restreint.

**Multi-locataires (colocation)** :

Politique « **max comptes utilisateurs** » figée 2026-05-09 :
- Chaque colocataire reçoit **son propre lien d'invitation**.
- Chaque colocataire crée **son propre compte** distinct (1 user = 1 personne physique).
- Tous voient le même bien dans leur espace, mais avec leur propre fil de messagerie 1:1 avec le bailleur.
- Pourquoi : (1) traçabilité audit nLPD (qui a vu quoi quand), (2) facturation futures Phase 2+ par tête, (3) départ d'un coloc = invalidation de SON compte sans toucher les autres.

**Anti-pattern interdit** : compte « partagé colocation » avec un seul login pour 4 personnes — refusé Phase 1.0 et au-delà.

### Module Espace Locataire (Phase 1.0 🆕 — Sprint 13)

**Vue dédiée à SON bien uniquement** (RLS Postgres strict — un locataire ne peut JAMAIS lire les données d'un autre bien).

**Sections** :

| Section | Contenu Phase 1.0 | Évolutions Phase 1.1+ |
|---|---|---|
| Mon bien | Adresse, photo, type, surface, contact bailleur | Documents communs (règlement immeuble, etc.) |
| Mon bail | PDF du bail uploadé par le bailleur, dates, montants | Bail signé électroniquement Skribble (Phase 1.1) |
| Mes paiements | Historique mensuel + statut (`pending` / `paid` / `late`) en mode manuel | QR-facture auto + paiement direct (Phase 1.1) |
| Mes documents | Quittances reçues, EDL entrée, autres docs envoyés par le bailleur | Documents générés auto (attestations, etc.) |
| Messagerie | Fil 1:1 bailleur ↔ locataire (cf §4.13) | Pièces jointes, threads par sujet |

**Anti-pattern interdit** :
- Pas de page « marketplace » dans l'espace locataire.
- Pas de page « tous mes biens » (un locataire ne voit jamais qu'un seul bien à la fois Phase 1.0).
- Pas d'accès aux données d'autres locataires (même en colocation : chaque coloc voit le bail commun + ses propres paiements).

### Code dormant Phase 2 (conservé en l'état)

> Toute la mécanique candidature spontanée + scoring IA candidature + frais propriétaire CHF 45 est **reportée Phase 2**. Le code et le schéma DB existent mais ne sont **plus accessibles** Phase 1.0. Cf [`2-ROADMAP.md`](./2-ROADMAP.md) §2.4.6.

**Inventaire dormant Phase 1.0** :

- **Dossier IA scoré 0-100** — `tenants.ai_score` (int 0-100) + `tenants.ai_score_detail` (JSONB). Modèle conservé. Endpoint scoring désactivé.
  - Critères historiques : revenus (ratio loyer/salaire < 33 %), stabilité emploi, garants, antécédents OPF, cohérence dossier.
  - Réactivation Phase 2 avec disclaimer obligatoire (estimation IA, pas une décision).
- **Candidature spontanée gratuite** — Soumission nom + email + téléphone + dossier (CV bail, fiches salaire, extrait poursuites, attestation RC) via bucket Supabase `candidatures`. Endpoint `POST /candidatures` désactivé Phase 1.0.
- **Frais propriétaire CHF 45 (migration 0033)** — colonnes `owner_fee_amount`, `owner_fee_paid_at`, `owner_fee_stripe_intent_id`, `owner_fee_failed_at` sur table `candidatures`. Migration appliquée mais **aucune écriture Phase 1.0**. Stripe off-session non déclenché.
- **CRM contacts** (filtres actuel / ancien / candidat / refusé) — `frontend/src/app/app/(dashboard)/crm/page.tsx`. Vue conservée mais sans onglet « candidat » Phase 1.0.

**Règle absolue conservée** : le locataire ne paie **JAMAIS** rien à Althy. Ni inscription, ni acceptation, ni frais cachés. Tout endpoint qui facturerait un locataire est un **bug à corriger immédiatement**. Cette règle reste valide en Phase 2 lors de la réactivation marketplace.

**Source de vérité granulaire TenantFile + scoring IA** : voir [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) — la rubrique « Rôle 3 — locataire » liste les ~80 champs du dossier locataire complet (Phase 2 cible). Phase 1.0 = sous-ensemble minimal (identité, lien bail, lien paiements, lien messagerie).

---

## 4.7bis Limitation Phase 1.0 — single-role par email

> **Doctrine figée 2026-05-13** (post bug-invitation-001).

**Règle** : en Phase 1.0, **1 email = 1 compte Supabase Auth = 1 rôle principal**. Pas de cumul `proprio_solo + locataire` ni `proprio_solo + artisan` sur le même email.

**Conséquence opérationnelle** :

- Si un bailleur invite un locataire dont l'email a déjà un compte Althy (peu importe le rôle), `POST /onboarding/rejoindre` retourne **`409 Conflict`** avec message :
  > « Cet email a déjà un compte Althy. Pour l'utiliser comme locataire de ce bien, contactez le support althy.ch. »
- Le bailleur reçoit le retour côté UI invite et doit contacter `support@althy.ch` pour activation manuelle (Killian fait la liaison `Locataire ↔ bien` en SQL le temps que Phase 1.1 livre le multi-rôles).
- **Pas de fallback silencieux** côté backend : le compte n'est jamais réutilisé aveuglément (cf incident bug-invitation-001 du 2026-05-12 où le fallback `users[0]` non filtré réutilisait un `auth.users` orphelin).

**Pourquoi cette discipline** :

- **Risque #1 mismatch identité** : sans filtrage strict, deux invitations différentes peuvent pointer vers le même `auth.users.id` mais avec des `users.email` différents → corruption identitaire RLS + impossibilité de se reconnecter.
- **Risque #2 RLS** : un compte multi-rôles non encadré côté DB peut voir des biens d'un autre rôle (fuite cross-tenant Sunimmo).
- **Risque #3 sécurité magic_links** : un cumul de rôles via le même email peut être exploité pour escalader vers proprio_solo via une invitation locataire (Phase 2 quand le code marketplace sera réactivé).

**Évolution Phase 1.1 (post-migration Sunimmo)** : refacto `users` → table de jointure `user_roles` N-N + switch top-right UI à la Airbnb. Cf [`2-ROADMAP.md`](./2-ROADMAP.md) §F backlog « Sprint Multi-rôles Phase 1.1 ».

**Référence code** :

- Backend rejet 409 : `backend/app/routers/onboarding.py:_rejoindre_locataire` (branche `except HTTPException` post-POST admin/users).
- Backend rejet 409 : `backend/app/routers/onboarding.py:creer_compte` (même pattern, flow agence/portail).
- Frontend gestion 409 : `frontend/src/app/invite/[token]/page.tsx:handleSubmit` (lien `/contact`).

---

## 4.8 Module Finances

### Loyers QR-facture SPC 2.0 (sprint 15)

- **Génération automatique** mensuelle (J-3 du mois).
- Norme suisse SPC 2.0 (compatible toutes banques CH).
- **Émetteur** : HBM Swiss Sàrl (source `legal-entity.ts` + `backend/app/core/config.py`).
- Référence structurée pour réconciliation automatique.
- Endpoint : `POST /loyers/generer-qr`.

### Réconciliation CAMT.054

- Import du fichier bancaire suisse (XML CAMT.054).
- Matching automatique paiements ↔ loyers attendus via référence QR.
- Statut : `pending` → `received` → `late` → `partial` → `disputed`.
- Endpoint : `POST /loyers/reconcilier`.
- Parser : `backend/app/services/bank_parsers/camt054.py`.

### Quittances automatiques

- Générées à la réconciliation du loyer.
- PDF avec disclaimer IA (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.14).
- Endpoint : `POST /loyers/quittance`.
- Émetteur : HBM Swiss Sàrl (source `config.py` → `ALTHY_CREDITOR_NAME`).

### Relances automatiques

- **J-3** : rappel doux avant échéance.
- **J0** : échéance dépassée — premier rappel.
- **J+5** : relance ferme.
- **J+10** : mise en demeure CO art. 257d (juridique).
- Désactivables par locataire (paiement bulletin de versement papier, etc.).

### Rendement net

- **Phase 1 basique** : loyer brut annuel - interventions année civile.
- **Phase 2 dynamique** : enrichi avec commission Althy 3 % + comparaison marché (estim IA) en temps réel.

### 4 packs de diffusion annonce (Phase 2)

Cf [`2-ROADMAP.md`](./2-ROADMAP.md#25-phase-2--lancement-public-payant) §2.5 + [`5-FINANCES.md`](./5-FINANCES.md#53-sources-de-revenus-par-phase) §5.3. Stratégie : Althy = distributeur low-cost négocié en volume avec SMG/Homegate, redistribué aux proprios à fraction du prix unitaire portail (cf [`1-VISION.md`](./1-VISION.md#16-stratégie-agences-et-portails) §1.6).

| Pack | Prix mensuel | Canaux inclus |
|---|---|---|
| Découverte | CHF 0 (inclus abo) | Althy + Flatfox |
| Standard | CHF 9 | + 1 canal au choix (Homegate OU ImmoScout24) |
| Pro | CHF 19 | + Homegate + ImmoScout24 + immobilier.ch |
| Premium | CHF 29 | Tous canaux + boost IA fiche annonce + remontée prioritaire |

### Centre comptable (Phase 2-3)

Cf [`2-ROADMAP.md`](./2-ROADMAP.md#25-phase-2--lancement-public-payant) §2.5 + [`5-FINANCES.md`](./5-FINANCES.md#53-sources-de-revenus-par-phase) §5.3. Pas un ERP type SAP — un **agrégateur intelligent** :

- **Phase 2** (proprio_solo + agence) : collecte automatique des écritures (Transaction + Invoice + ChargeLine + WorkOrder.cout + commissions) + catégorisation client/mandat/bien + KPI efficacité (« 94 % sur ce bien, 76 % sur celui-là ») + insights IA d'amélioration. Export 1 clic vers Bexio API / Banana XML / AbaWeb / Excel / PDF récapitulatif.
- **Phase 3** (agence full) : multi-mandat + bilan simplifié + insights IA cross-mandats + détection anomalies + benchmarking anonymisé.
- **Phase 4** (agence enterprise) : audit forensique + clôtures + multi-société.

### Nouveaux domaines Phase 1 (sprints 13-14)

Détail exhaustif : [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A3.

- `OwnerStatement` — décompte propriétaire automatique (mensuel/trimestriel/annuel) avec PDF + validation 1 clic.
- `Caution` (refacto `Contract.deposit`) + `CautionRetenue` — restitution avec retenues motivées (dégâts/impayés/charges/nettoyage/clés).
- `ChargeLine` + `ChargeStatement` — charges détaillées qui-paie-quoi (proprio/locataire/partagé) + décompte annuel.
- `IndexationEvent` — workflow indexation IPC structuré (préparée → envoyée → acceptée/contestée) avec formule officielle PDF cantonal.
- `Reminder` — relances structurées (R1 / R2 / mise en demeure CO art. 257d) avec frais + intérêts moratoires.
- `BankAccount` (refacto `User.iban`) — multi-comptes par usage (régie / cautions / charges / travaux), IBAN chiffré at-rest.

---

## 4.9 Module Documents

### Storage Supabase

- Bucket `documents` (migration 0030) — PDFs générés.
- Bucket `biens-images` — photos de biens.
- Bucket `candidatures` — dossiers locataires.
- RLS strict (chaque user = ses docs).

### 10 types de documents

1. `bail` — contrat de bail signé
2. `quittance` — quittance mensuelle
3. `edl_entree` — état des lieux entrée
4. `edl_sortie` — état des lieux sortie
5. `relance` — courrier de relance
6. `attestation` — attestation diverse (domicile, IFD, etc.)
7. `courrier` — courrier libre généré IA
8. `facture` — facture de charge ou d'intervention
9. `devis` — devis artisan
10. `rapport` — rapport de visite, EDL, audit
+ `autre` (catch-all)

### OCR factures

- **Phase 1** : Tesseract (basique) — extraction montant/date/fournisseur.
- **Phase 2** : Anthropic Vision API + affectation IA OBLF (« cette facture concerne le bien X — proprio ou locataire ? »).
- Endpoint : `POST /sphere/ocr-facture`.

### Disclaimer IA obligatoire

- Champ `documents.disclaimer_included` (bool).
- Si `generated_by_ai = true` → `disclaimer_included` doit être `true`.
- Pied de page automatique avec disclaimer.
- Source texte : `frontend/src/legal/CH/disclaimer-ia.md`.

**Source de vérité granulaire templates** : la liste actuelle des 10 types ci-dessus est l'inventaire Phase 1 minimal. Pour la liste exhaustive des templates générés par IA (incluant Phase 2-4 : décompte propriétaire, décompte de charges, formule officielle indexation par canton, mandat de vente, acte vente, etc.), voir [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) — rubrique « SECTION UI : Documents » du proprio_solo. Doctrine : tout document généré par Claude porte le flag `documents.disclaimer_included = true`.

### Templates par canton

- **Phase 1** : VD, GE, VS (90 % du marché romand).
- **Phase 2** : autres cantons romands (FR, NE, JU).
- **Phase 2** : ZH, BE, BS (suite activation `de-CH`).
- Source : `backend/templates/baux/{canton}/` (à créer sprint 13).

---

## 4.10 Module Interventions

### Signalement proprio/locataire

- Formulaire : titre, description, photos, urgence (low / normal / high / urgent).
- Notification proprio (Phase 1) + match artisan (Phase 3).
- Endpoint : `POST /interventions`.
- Photos uploadées avec UUID randomisés.

### Devis comparé IA (Phase 3)

- 3 artisans matchés par `(canton + specialty)`.
- IA compare : prix, matériaux, délais, notation client.
- Recommandation IA + alerte si surfacturation détectée.
- Endpoint : `POST /interventions/{id}/request-quotes`.

### Stripe Connect (Phase 2-3)

- Split 95/5 (artisan reçoit 95 %, Althy 5 %).
- Frais Stripe (~2.9 %) à la charge de l'artisan.
- Onboarding Stripe Connect Express (KYC + IBAN).
- Endpoint : `POST /profiles-artisans/stripe-connect/onboard`.

### Audit IA matériaux (Phase 3-4)

- Détection prix anormaux (vs benchmark régional).
- Recommandation matériaux alternatifs.
- Conseil sur durée travaux probable.

---

## 4.11 Module Changement de locataire ✅ TERMINÉ Sprint 12

**Statut** : TERMINÉ (PR #4, commit `ca13842`).

- **7 endpoints** fonctionnels :
  - `GET /biens/{id}/changement/actif`
  - `POST /biens/{id}/changement/creer`
  - `PATCH /biens/{id}/changement/{cid}`
  - `POST /biens/{id}/changement/{cid}/checkout`
  - `POST /biens/{id}/changement/{cid}/checkin`
  - `POST /biens/{id}/changement/{cid}/edl/upload`
  - `DELETE /biens/{id}/changement/{cid}` (annulation)
- **5 phases métier** : `depart_annonce` → `recherche` → `checkout` → `checkin` → `termine`.
- **Migration 0030** enrichie 7 colonnes (5 types résiliation suisse au sens du CO art. 266g et suivants).
- Cycle complet validé en prod sur le bien Crans-Montana (compte test).

**Backlog** : refonte UX du module changement (tabs cohérents, édition inline) → reportée sprint 16-17.

---

## 4.12 Compta intégrée

### Phase 1 (basique)

- Revenus / charges par bien.
- Catégorisation simple : loyer, intervention, charge, taxe, autre.
- Export CSV mensuel (1 clic depuis `/app/comptabilite`).

### Phase 2 (dynamique — sprint 14)

- Transactions live (rendement net mis à jour temps réel).
- OCR factures + affectation IA OBLF (proprio vs locataire — Ordonnance sur le bail à loyer).
- Réconciliation CAMT.054 enrichie.
- Export plan comptable suisse standard (PME OBA art. 957) — compatible Bexio, Banana, AbaWeb.
- Déclaration fiscale IFD assistée (calcul revenus nets locatifs par bien).

### Phase 4 (compta agence)

- EBITDA live agence.
- Charges, salaires, impôts intégrés.
- Audit IA rentabilité par mandat (« seuil rentabilité loyer pour conserver le mandat »).

---

## 4.13 Communication

> **Doctrine Phase 1.0 (figée 2026-05-09)** : strict minimum nécessaire à la migration Sunimmo. Messagerie interne 1:1 bailleur ↔ locataire + notifications email transactionnelles via Resend. **Aucun canal externe** (pas d'OAuth Gmail/Outlook, pas de WhatsApp API, pas de SMS Twilio). Cf [`2-ROADMAP.md`](./2-ROADMAP.md#24-phase-10--logiciel-de-gestion-sunimmo-test-) §2.4.

### Phase 1.0 — Messagerie interne + email transactionnel

**Messagerie interne in-app** :
- Table `bien_messages` (migration **0040** — sprint Module Communication PR-1, 2026-05-12). Rectification doctrine du 2026-05-11 : la mention historique « table `messages` migration 004 déjà en place » était erronée (table jamais créée, audit pré-PR confirmé). Naming aligné sur les autres tables filles de `biens` (`bien_annexes`, `bien_contacts`, etc.).
- Canal **1:1 bailleur ↔ locataire** lié à un bail (chaque thread = `(bien_id, user_id_bailleur, user_id_locataire)`).
- Multi-locataires (colocation) : 1 fil distinct par coloc (cf §4.7 politique max comptes).
- Notifications email Resend si message non lu après 24h (PR-4 à venir).
- Realtime Supabase configuré mais **pas branché en Phase 1.0** (refresh manuel suffisant pour Sunimmo).
- **Pas de pièces jointes Phase 1.0** (ajout Phase 1.1 si besoin terrain).

**Email transactionnel via Resend** :
- Émetteur : `noreply@althy.ch` (SPF/DKIM configurés).
- Templates Phase 1.0 :
  - `signup_bailleur` — confirmation inscription bailleur.
  - `reset_password` — réinitialisation mot de passe.
  - `invite_locataire` 🆕 — invitation locataire envoyée par le bailleur (cf §4.7 module Invitation).
  - `nouveau_message` — notification message non lu après 24h.
  - `loyer_marque_paye` — confirmation au locataire quand le bailleur marque un loyer comme payé.
- Templates par locale (Phase 1.0 : `fr-CH` seul).

### Phase 1.1 — Compléments

- **Signature électronique Skribble** intégrée au workflow bail (juin/juillet 2026).
- **QR-facture SPC 2.0** envoyée automatiquement au locataire via Resend (template `loyer_qr_facture`).
- **Relances loyers automatiques** par email (J-3 / J0 / J+5 / J+10 / mise en demeure CO art. 257d).
- **Quittances mensuelles automatiques** (template `quittance_mensuelle`).

### Phase 2 — Multi-canaux + sync externes

> Cf [`2-ROADMAP.md`](./2-ROADMAP.md#25-phase-2--lancement-public-payant) §2.5 — **Communication multi-canaux** (Phase 2).

- **OAuth Gmail / Outlook** — Microsoft Graph API + Google Workspace API + Infomaniak kMail API. Lecture mails + calendrier + IA propose actions contextuelles. OAuth2 (jamais de mot de passe stocké).
- **WhatsApp Business API** (Meta Cloud API) — opt-out par message obligatoire (LCD). Pattern unifié `InboxParser` côté backend.
- **SMS Twilio** — notifications critiques (paiement réussi, échec relance, alertes). Numéro identifiable Althy (Sender ID). Configuration code-side prête depuis Phase 0 mais **désactivée Phase 1.0 et 1.1**.
- **Traduction auto FR/DE/IT/EN** des messages entrants/sortants (utilité multi-locale Phase 2 post-activation `de-CH`).
- **Email nurturing 5 séquences** — Welcome / Onboarding / Re-engagement / Churn prevention / Upsell.

### Anti-pattern interdit Phase 1.0

- ❌ Pas de message broadcast bailleur → tous les locataires (Phase 2+).
- ❌ Pas de notification SMS (Phase 2).
- ❌ Pas d'OAuth Gmail/Outlook (Phase 2).
- ❌ Pas de WhatsApp API (Phase 2).
- ❌ Pas de chatbot IA proactif côté locataire (le locataire reste passif sur la communication, c'est le bailleur qui pilote).

---

## 4.14 Plan d'activation des rôles

### Phase 1.0 (active maintenant — doctrine 2026-05-09)

- `proprio_solo` — propriétaire-bailleur autogéré (cible Sunimmo).
- `locataire` — **ACTIF Phase 1.0**, mais accès **dédié à SON bien uniquement** via flux Invitation (cf §4.7). Pas d'accès à une marketplace, pas d'accès à d'autres biens, pas de candidature spontanée.
- `super_admin` — Killian + admin technique (gestion partenaires, waitlist).
- + `artisan` partiellement (M1 — 50 places fondateurs par canton GE+VD) — **gelé en l'état** Phase 1.0, pas d'évolution.
- Backend : `ALLOWED_SIGNUP_ROLES = ["proprio_solo", "locataire", "super_admin", "artisan"]`.
- Frontend : flags `false` pour les autres rôles → écran « en préparation ».

> **Différence clé doctrine v6** : le rôle `locataire` reste actif Phase 1.0 mais **uniquement via invitation bailleur**. L'inscription publique d'un locataire sans invitation n'est pas exposée Phase 1.0 (le formulaire `/register` ne propose plus le rôle locataire en self-service ; le compte est créé via `/invite/[token]`). Le rôle `acheteur` et `hunter` restent en `ComingSoon` Phase 2-4.

### Phase 2 (gated par flags)

- Activer `NEXT_PUBLIC_FLAG_AGENCE = true` + `NEXT_PUBLIC_FLAG_PORTAIL = true`.
- Ajouter `"agence"` et `"portail_proprio"` à `ALLOWED_SIGNUP_ROLES`.
- Dashboard agence (Scénario B : comptes agence séparés avec vue multi-propriétaires).

### Phase 3 (gated par flags)

- Activer `NEXT_PUBLIC_FLAG_OPENER = true`.
- Généralisation `NEXT_PUBLIC_FLAG_ARTISAN` à toute la Suisse.
- Ajouter `"opener"` à `ALLOWED_SIGNUP_ROLES`.

### Phases 4-5 (hardcoded)

- `expert`, `hunter`, `acheteur_premium` → modifier les flags hardcodés `false` dans `flags.ts`.

### Communication aux users existants

Pour les utilisateurs qui se sont inscrits avec un rôle désactivé Phase 1 (artisan, opener, agence déjà inscrits avant) :

- **Écran in-app** : « Votre espace est en préparation » avec CTA Sphère IA + contact.
- **Email** : « Votre espace Althy arrive bientôt » via Resend.
- **Page publique** : `/bientot/[role]` avec formulaire waitlist (table `waitlist`, migration 0034).

Détail historique : `docs/plan-communication-roles-phase1.md` (à intégrer ou archiver Prompt 3).

---

## 4.15 Triple test appliqué — exemples concrets

### Création bien (sprint 12 étape 3 ✅)

| Critère | Application |
|---|---|
| Simple | 8 champs, 1 page, 1 clic submit. Auto-fill canton. Titre auto-généré. |
| Complet | `type_bien`, `surface_habitable`, `nb_pieces` (avec step 0.5 pour les 3.5 / 4.5 pièces CH). Tous les champs `BienCreate` backend optionnels accessibles plus tard via édition. |
| IA-ready | Titre auto-généré au format `"Type, Adresse, Ville"` (parsable). Enum `type_bien` (pas string libre). Audit log de la création (`action = "create"`). |

### Édition loyer (sprint 12 étape 4 🔄)

| Critère | Application |
|---|---|
| Simple | Double-click sur la card Finance → édition inline → save auto. Pas de modal. |
| Complet | Montant + charges détaillées + index IPC + date prochaine indexation. |
| IA-ready | Event `loyer_updated` traçable dans `audit_log`. `old_values` / `new_values` JSON. |

### Archivage bien (sprint 12 étape 5 ⏭️)

| Critère | Application |
|---|---|
| Simple | 1 clic « Archiver » + écran de confirmation. |
| Complet | `is_active = false`. Conserve historique complet (changements, paiements, documents). Audit conservé indéfiniment. |
| IA-ready | Query `WHERE is_active = true` partout. État archivé introspectable via `bien.is_active`. Soft delete préserve l'audit nLPD ([`6-LEGAL.md`](./6-LEGAL.md) §6.12). |

---

## 4.16 10 modules IA premium (Phases 2-4)

Différenciateurs majeurs Althy vs concurrents (Garaio, IAZI, ImmoTop). Détails granulaires : [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md). Roadmap : [`2-ROADMAP.md`](./2-ROADMAP.md) §2.5 (Phase 2), §2.6 (Phase 3), §2.7 (Phase 4).

| # | Module | Phase | Différenciateur |
|---|---|---|---|
| 1 | Valorisation du bien | P3-4 | Cadastre VSGIS + COS + comparables + projections 2030 + score d'opportunité |
| 2 | Marché local | P2 | Tension locative + comparables IA + recommandations prix optimal |
| 3 | Optimisation fiscale IA | P2 | Travaux à déduire + plafonds non utilisés + simulations N+1 |
| 4 | Maintenance prédictive | P3 | Pannes anticipées + budget 5 ans + subventions cantonales |
| 5 | Locataire idéal IA | P2 | Profil cible auto-généré + matching candidatures + détection risques |
| 6 | Communication multi-canaux | P2 | WhatsApp + email centralisé + SMS + traduction auto FR/DE/IT/EN |
| 7 | Sphère IA mobile / vocal | P3 | Commande vocale + briefing audio + multimodal photo+description |
| 8 | Intégrations partenaires | P2-3 | Caution / assurance / déménagement / internet / énergie / SOS travaux |
| 9 | Agent IA autonome | P3-4 | 4 niveaux d'autonomie + limites monétaires + actions autorisées |
| 10 | Communauté proprios | P3 | Forum + avis artisans communautaires + webinaires + référencement Hunters |

**Doctrine** : Althy n'est pas un logiciel de gestion locative. C'est un **agent intelligent** qui fait à ta place dans les limites définies. Cf [`1-VISION.md`](./1-VISION.md#11-le-concept-en-1-phrase) §1.1.

---

## Annexes

- [1-VISION.md](./1-VISION.md) — Vision macro Althy
- [2-ROADMAP.md](./2-ROADMAP.md) — Phases produit + sprints
- [3-ARCHITECTURE.md](./3-ARCHITECTURE.md) — Stack technique, DA, intégrations
- [5-FINANCES.md](./5-FINANCES.md) — Modèle économique
- [6-LEGAL.md](./6-LEGAL.md) — Conformité juridique
- [7-CATALOGUE-DONNEES-ALTHY.md](./7-CATALOGUE-DONNEES-ALTHY.md) — Source de vérité granulaire (données par rôle, acquisition, phases, sections UI)
- [`docs/session12/SPRINT-bien-complet.md`](./session12/SPRINT-bien-complet.md) — Sprint en cours détaillé
