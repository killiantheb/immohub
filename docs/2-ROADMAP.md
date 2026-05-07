# 2. Roadmap Althy

> **Source de vérité unique** pour les phases produit + sprints.
> Remplace l'ancien `ROADMAP.md` (racine) et `SPRINT_LOG.md` (archivé).
> Last update : 2026-04-30 (v5)
> Audience : Killian, peer reviewer Claude Code, futurs collaborateurs.

---

## 2.1 Philosophie roadmap

**Gates durs entre phases.** Les critères de sortie de chaque phase sont des conditions binaires (atteint / pas atteint), pas des indicateurs. Pas de Phase N+1 avant que la Phase N ne soit validée. La tentation de « lancer la Phase 2 en parallèle » est explicitement refusée.

**Un sprint = un thème.** Pas de bundling de scopes (pas de « petit bug pendant qu'on y est »). Un sprint a un nom (« Bien complet », « Documents par bien »), un fichier de plan dans `docs/sessionN/`, et une liste d'étapes validées une par une avec checkpoint Killian.

**Phase 1 = location pure stricte.** Tout ce qui n'est pas Phase 1 (marketplace publique, agence, openers, hunters, ventes, etc.) n'est ni codé, ni roadmappé en détail. Les modules futurs ont leur place dans la vision long terme — ils n'encombrent pas le sprint en cours.

**Architecture pensée pour accueillir Phase 2-3 sans refonte.** Les fondations posées en Phase 1 (i18n-ready dès Phase 1, RBAC 9 rôles dès Phase 1, architecture multi-pays migration 0037) permettent l'activation progressive sans refactor lourd.

**La roadmap se met à jour uniquement quand un événement réel l'impose** (fin d'une phase, contrainte légale concrète, retour utilisateur critique). Pas de re-discussion « pour le fun ».

---

## 2.2 Synthèse visuelle

| Phase | Nom narratif | Période | Objectif | Gate dur de sortie | i18n | Statut |
|---|---|---|---|---|---|---|
| **0** | — | M-3 → M0 | Stabilisation fusion | Migration 0029 prod + 1 bien créé via UI | fr-CH | ✅ TERMINÉE 25/04/2026 |
| **1** | L'Assistant | M1 → M6 | Location pure | 3+ testeurs autonomes + Sunimmo migré | fr-CH | 🔄 EN COURS |
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

## 2.4 Phase 1 — Location pure (EN COURS) ⭐

**Période cible** : M1 → M6 (mai 2026 → septembre 2026).
**Objectif** : Althy permet à un propriétaire-bailleur suisse romand de gérer 1 à 15 biens en autonomie complète, du contrat à la quittance, sans assistance technique.

### 1.1 Périmètre inclus

**Rôles actifs** :
- `proprio_solo` — propriétaire-bailleur autogéré (cible Phase 1)
- `locataire` — destinataire des quittances, accès dossier locataire
- `super_admin` — Killian + admin technique (gestion partenaires, waitlist)

**Modules livrés / en cours** :
- Bien (création express ✅, fiche bien 🔄, modification/archivage à venir)
- Locataire (CRM basique, candidatures, dossier IA scoré)
- Finances (loyers QR-facture SPC 2.0, réconciliation CAMT.054)
- Documents (storage Supabase, génération PDF avec disclaimer IA)
- Interventions (signalement, suivi, devis basique)
- Changement de locataire ✅ TERMINÉ
- Sphère IA basique (briefing matinal, intents principaux)
- Compta basique (revenus, charges, OBLF règle de partage)

**Pages publiques actives** :
- `/` (landing avec Mapbox + sphère hero)
- `/estimation` (lead magnet IA gratuit)
- `/login` + `/register` (filtré sur rôles Phase 1 actifs)
- `/bientot/[role]` (waitlist pour rôles Phase 2-3)
- `/legal/*` (CGU, confidentialité, cookies, disclaimer-ia)

### 1.2 Périmètre exclu (reporté Phase 2+)

Ces périmètres sont **figés en exclusion Phase 1**. Toute tentation d'inclusion fait l'objet d'une décision documentée :

- **Marketplace publique** — routée mais masquée (cleanup PR #6 + #7 du 28/04/2026). Le SEO et le linking interne sont neutralisés. Réactivation Phase 2.
- **Module agence** (`agence`, `portail_proprio`) — flags `false`, écran « en préparation ».
- **Openers / Hunters / Experts / Artisans avancés** — flags `false`. Marketplace artisans M1 partielle déjà ouverte (GE + VD via 50 places fondateurs) mais reste expérimentale.
- **WhatsApp Business API** — Phase 5+ (Hub IA).
- **Sync Google Calendar / Outlook** — Phase 5+ (Hub IA).
- **PPE / copropriété** — backlog vision.
- **Module vente** (Resales) — Phase 4.

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

### 1.4 Module Documents par bien — Sprint 13

**Objectif** : automatiser toute la paperasse locative récurrente. Une régie classique facture CHF 50-150 par document généré ; Althy en propose autant que nécessaire dans l'abonnement CHF 29.

**Scope** :
- **Templates de baux par canton** — commencer par VD/GE/VS (90 % du marché romand). Étendre à FR/NE/JU avant fin Phase 1.
- **Quittances mensuelles automatiques** — déclenchées à la réconciliation du loyer (sprint 15). Format PDF avec QR-facture incluse pour le mois suivant.
- **États des lieux (EDL) entrée / sortie** — formulaire structuré (pièce par pièce, photos, état), génération PDF, signature électronique distancielle.
- **Relances loyers impayés** — séquence J+5 (rappel amical), J+15 (mise en demeure CO art. 257d), J+30 (préparation dossier expulsion). Templates par canton.
- **Attestations diverses** — attestation de bail, attestation de domicile pour le locataire, attestation IFD pour le proprio.

**Caution (CO art. 257e)** — module dédié au sprint 13. 3 modalités suisses :
- Cash / virement direct sur compte proprio (rare, légal mais déconseillé).
- **Compte bancaire bloqué au nom du locataire** (modalité standard, exigée par CO art. 257e).
- **Organisme de caution** (GoCaution, Swisscaution, Firstcaution) — partenariat à signer pour 10 % de commission sur la prime.

**OCR factures** — pré-remplissage des factures depuis scan ou photo mobile. Affectation IA proprio/locataire selon règle OBLF. Workflow validation humaine.

**Signature électronique conforme CH** — fournisseur à arbitrer (DocuSign, Skribble, ou solution Althy native). Valeur juridique de l'EDL signé électroniquement à confirmer avec avocat (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.9).

**Critères de sortie Sprint 13** :
- Bail standard généré automatiquement à partir du bien + locataire + montants.
- Quittance auto-générée à la réception du loyer.
- EDL avec photos sauvegardées dans Supabase Storage.
- Caution choisie via 1 dropdown puis suivi du dépôt en lecture sur la fiche du bail.

### 1.5 Module Comptabilité location — Sprint 14

**Objectif** : un propriétaire reçoit en avril son rapport annuel prêt à transmettre à son fiduciaire ou à intégrer directement à sa déclaration IFD.

**Scope** :
- **États locatifs annuels par bien** — revenus encaissés, charges payées, travaux déductibles. Format PDF + Excel/CSV.
- **Déclaration fiscale IFD assistée** — calcul revenus nets locatifs par bien, valeur fiscale du bien (selon règles cantonales), proposition de répartition des amortissements.
- **Réconciliation CAMT.054** — import du fichier bancaire suisse (XML CAMT.054), matching automatique paiements ↔ loyers attendus, alerte sur loyers impayés ou montants inattendus.
- **Application règle OBLF** (Ordonnance sur le bail à loyer) — règles codées : « gros entretien = proprio », « menu entretien = locataire ». Suggestion IA sur scan facture, validation humaine obligatoire.
- **Export fiduciaire** — format plan comptable suisse standard (PME OBA art. 957). Compatible Bexio, Banana, AbaWeb.

**Hors scope Phase 1** (reporté Phase 2 ou 4) :
- PPE / copropriété (gestion charges communes).
- Compta agence multi-mandats (à Phase 4 « EBITDA agence »).
- Multi-comptes bancaires par propriétaire (1 IBAN par bien minimum).

**Dépendance** : sprint 13 doit être terminé (les documents financiers viennent du module Documents).

**Critères de sortie Sprint 14** :
- Rapport annuel généré pour 3 biens fictifs (1 vacant, 1 loué, 1 en travaux).
- Réconciliation CAMT.054 fonctionnelle sur 1 fichier bancaire réel (UBS ou Raiffeisen).
- Export Excel ouvert sans erreur dans LibreOffice + Bexio.

### 1.6 Module Paiements loyers QR — Sprint 15

**Objectif** : remplacer Excel + virement manuel par un cycle automatique de génération QR-facture, encaissement direct sur l'IBAN du proprio, et quittance auto.

**Décision stratégique fondatrice** : **les loyers ne transitent jamais par un compte Althy.** Le QR-facture SPC 2.0 envoie directement le loyer sur l'IBAN du propriétaire. Cela évite l'enregistrement FINMA comme prestataire de services de paiement, simplifie la conformité, et réduit drastiquement le risque légal.

**Scope** :
- **Génération QR-facture SPC 2.0** — format SIX standard, conforme. Inclut référence structurée pour réconciliation automatique. Génération PDF + intégration dans la quittance.
- **Envoi automatique** — email Resend au locataire à J-7 du mois (configurable). Template par locale.
- **Réconciliation** — import CAMT.054 mensuel ou via OAuth bank sync (à arbitrer). Matching référence QR ↔ loyer attendu. Statut `pending` → `received`.
- **Dashboard « économies vs régie »** — calcul transparent : `loyers_annuels × 10 % régie − CHF 348 abo` = économies. Affiché en hero de la fiche bien.
- **Relances automatiques** — séquence J-3 (rappel doux), J0 (jour J), J+5 (relance), J+10 (relance ferme). Désactivables par locataire (ex. paiement par bulletin de versement papier).

**Modèle de revenus associé** :
- **Mode standard** : commission Althy 3 % sur loyer réconcilié via Althy (la réconciliation a une valeur — sans Althy, le proprio devrait pointer manuellement ses extraits de compte).
- **Mode dégradé QR direct** : si le proprio refuse le passage par Althy pour la réconciliation et utilise le QR-facture sans matching, **commission = 0 %**. Inciter à utiliser la réconciliation.

**Stripe = abonnements uniquement.** Jamais de loyers via Stripe en Phase 1.

**Critères de sortie Sprint 15** :
- 1 loyer généré → envoyé → reçu → quittance auto émise, end-to-end sans intervention manuelle.
- Dashboard « économies vs régie » correct sur 3 biens fictifs.
- 1 cycle de relance complet déclenché automatiquement sur loyer en retard simulé.

### 1.7 Module Changement de locataire ✅ TERMINÉ Sprint 12

**Objectif initial** : couvrir le cycle complet « locataire actuel donne préavis → recherche nouveau → checkout → checkin → terminé », avec audit complet et endpoints fiables.

**État livré au 27/04/2026** :
- 7 endpoints fonctionnels (`GET /changement/actif`, `POST /changement/creer`, `PATCH /changement/{id}`, etc.).
- 5 phases métier modélisées (`depart_annonce`, `recherche`, `checkout`, `checkin`, `termine`).
- **Migration 0030** enrichie avec 7 colonnes (5 types de résiliation suisse au sens du CO art. 266g et suivants).
- Cycle complet validé en prod sur le bien Crans-Montana (compte test Killian).
- PR #3 (fix bug 500), PR #4 (fix bug `creer`), PR #5 (cleanup branding) mergées.

**Backlog post-sprint** : refonte UX du module changement (tabs cohérents, édition inline) — reportée au sprint 16 ou 17.

### 1.8 Sphère IA basique

**Objectif Phase 1** : la sphère IA est utilisable pour les actions courantes Phase 1, sans agentivité autonome. Validation humaine obligatoire avant tout side effect (envoi email, modif DB, débit Stripe).

**Capacités Phase 1** :
- **Briefing matinal** — synthèse de l'état des biens (loyers attendus, alertes, signalements ouverts). Endpoint SSE `/sphere/briefing`.
- **Intents principaux** :
  - `creer_bien` — formulaire pré-rempli depuis description naturelle.
  - `lancer_changement_locataire` — déclenche le cycle (sprint 12 livré).
  - `relance_loyer` — propose le brouillon, demande validation envoi.
  - `generer_quittance` — propose le PDF, validation puis envoi.
  - `signaler_intervention` — crée la fiche intervention, demande détail catégorie.
  - `chat_compta` — questions simples sur la compta du proprio (« combien j'ai gagné en mars ? »).
- **OCR facture** — upload photo facture → extraction montant/date/fournisseur, proposition d'affectation OBLF.

**Garde-fous** :
- **Rate limiting** : 30 interactions/jour pour le plan starter, 100/jour pour proprio_pro.
- **Validation humaine obligatoire** avant toute action irréversible (envoi email, débit, suppression).
- **Disclaimer permanent** : la sphère propose, l'humain décide. Pas de mode autonome.
- **Pseudonymisation** des données personnelles avant envoi à Anthropic Claude (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.7).

**Hors scope Phase 1** (reporté Phase 2-3) :
- Sphère agentique (actions autonomes en chaîne).
- Voice (Web Speech API) — fallback texte uniquement Phase 1.
- Suggestions cross-bien proactives (« tu pourrais augmenter le loyer du bien X »).

### 1.9 Coming Soon + Alpha fermée

**Objectif** : avant l'ouverture publique Phase 2, valider le produit sur un panel restreint de testeurs alpha de confiance.

**Scope** :
- **Page Coming Soon** + waitlist email (bypass admin via `?beta=true` + `robots.txt noindex`).
- **Pages `/bientot/[role]`** — collecte email pour les rôles désactivés Phase 1 (artisan, opener, hunter, etc.). Table `waitlist` (migration 0034) backend, intégration Resend list.
- **Bascule Sunimmo Riviera** — migration des 130 biens existants de l'agence du fondateur vers Althy. 10 biens → check, 30 → check, 130 → check.
- **Tests E2E Playwright** sur flows critiques (inscription, création bien, contrat, quittance, QR-IBAN).
- **Monitoring** — Sentry frontend + backend, BetterStack uptime, alertes Discord ou email.
- **Email nurturing minimal** — séquence Welcome + Onboarding (Resend).
- **Onboarding wizard guidé 5 étapes** post-inscription — accueil, profil, premier bien, premier locataire, sphère IA.
- **CGU / CGV / RGPD / LPD minimales** — templates validés rapidement (cf [`6-LEGAL.md`](./6-LEGAL.md)).
- **Décision architecture i18n** — déjà actée. `next-intl` + champ `locale` sur `User`. fr-CH activée seule, autres locales en standby.

**Alpha fermée** :
- 5 testeurs sélectionnés (amis propriétaires + contacts Sunimmo + agents immo).
- Feedback loop serré (Discord ou Telegram dédié).
- Corrections ciblées avant ouverture Phase 2.

### 1.10 Critère de sortie Phase 1

**Gate dur Phase 1 → Phase 2** (toutes conditions cumulatives) :

- ✅ **3+ testeurs alpha autonomes** ont créé un bien complet, généré un contrat, généré une quittance, transité un loyer QR sans intervention de Killian.
- ✅ **Sunimmo Riviera tourne sur Althy en autonomie** (180 biens migrés et exploités).
- ✅ **0 bug bloquant remonté depuis 7 jours** consécutifs.
- ✅ **Documentation utilisateur complète** (guide proprio_solo, FAQ).
- ✅ **Conformité juridique validée** par avocat (CGU, registre de traitement nLPD, AIPD module IA — cf [`6-LEGAL.md`](./6-LEGAL.md)).

→ Une fois ces 5 conditions atteintes, **Phase 2 ouverte**.

---

## 2.5 Phase 2 — Lancement public payant

**Période cible** : M7 → M12.
**Objectif** : Althy vivant par lui-même avec premiers clients payants récurrents au-delà du fondateur.

**Gate de sortie** : **10+ clients payants récurrents** + **MRR ≥ CHF 500/mois** + **churn < 10 %/mois** + **support gérable** (Killian ne passe pas 100 % de son temps en SAV).

**Étapes principales** :
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

**Sprint suivant prévu** : sprint 13 (Documents par bien), conditionné à la clôture du sprint 12.

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

**Prochaine révision** : uniquement sur événement concret (clôture sprint 12, fin Phase 1, feedback alpha contradictoire).
