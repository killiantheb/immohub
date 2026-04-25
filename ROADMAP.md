# ROADMAP ALTHY

**Version** : v3 — 24 avril 2026
**Philosophie directrice** : zéro échec, que des réussites. Chaque phase validée avant la suivante. Produit focus et parfait > produit étalé et moyen.

---

## Vision produit cœur

**Althy = plateforme de gestion immobilière IA bienveillante, qui donne le choix au propriétaire.**

Althy n'est pas un remplaçant d'agence. C'est un outil qui s'adapte au mode de fonctionnement de chacun : propriétaire DIY, propriétaire qui délègue à une agence, propriétaire hybride. Les agences peuvent aussi utiliser Althy comme logiciel métier.

### 2 piliers majeurs

- **Pilier 1 — Gestion locative** : location annuelle (≥ 1 an) + saisonnière (30 jours à 1 an). Scope Phase 1-3.
- **Pilier 2 — Ventes immobilières (Resales Suisse)**. Scope Phase 4.

**Hors scope permanent** : location court terme (nuitée/semaine type Airbnb). Pas de dev tant que pas de demande réelle prouvée par les utilisateurs.

### 3 types d'acteurs professionnels dans l'écosystème

- **Openers** : agents de visite professionnels (pour propriétaires ou agences).
- **Artisans** : professionnels d'interventions (plombier, électricien, peintre, chauffagiste, etc.).
- **Hunters** : apporteurs de mandats. **N'importe quel utilisateur Althy** peut activer "mode Hunter" sur un bien pour lequel il a l'accord du propriétaire. Une agence, un propriétaire, un ami, un voisin — tout le monde peut apporter un mandat et être rémunéré à la conclusion.

**Slogan Hunters** : *"Finance ton réseau"*.

### Modèle de revenu

- **Base SaaS** : CHF 29/mois (propriétaire / agence).
- **Canaux diffusion** : CHF 9/mois par canal activé (Homegate, ImmoScout24, immobilier.ch, ImmoStreet).
- **Inclus gratuit** : Flatfox + althy.ch.
- **Commission transit loyer** : 3% sur chaque loyer transité via Althy.
- **Commissions marketplaces** : 10-15% sur missions Opener / Artisan / conclusion Hunter.

### Internationalisation (i18n)

Althy sera disponible en **4 langues** :

- **Français** : langue primaire, CH romande. Phase 1-2.
- **Allemand** : CH alémanique. Expansion critique. Phase 2 ou 3.
- **Italien** : Tessin. Phase 4-5.
- **Anglais** : expatriés + communication internationale. Phase 4-5.

**Implication technique dès Phase 0-1** : intégrer un système i18n (type `next-intl`) avant de scaler le frontend, sinon refactor lourd plus tard. Backend doit supporter le multi-locale dès Phase 1 (champ `locale` sur User, templates de baux/quittances par langue, propagation locale dans emails et docs PDF).

---

## État actuel (25 avril 2026)

- **Migration 0029 prod** : appliquée 25 avril 2026 14:34 GMT (TRUNCATE biens, schéma fusion Property→Bien, parité staging session 8 validée 5/5).
- **Merge `refonte/fusion-properties-biens-complete` → `main`** : déployé prod 25 avril 2026 18:41 GMT+2 (61 commits, +7652/−2579 lignes, refonte backend + frontend).
- **Backend Railway** : 200 sur tous endpoints critiques (`/api/health`, `marketplace/biens`, `marketplace/stats`).
- **Frontend Vercel** : déployé sur la même branche, login UI fonctionnel (pattern auth H3 validé en conditions réelles).
- **Coming Soon landing** : non fait.
- **Utilisateurs en production** : 0 utilisateur réel (4 comptes de test du fondateur).
- **Marketplace prod** : vide (`total: 0`) — TRUNCATE migration 0029, peuplement à arbitrer (130 biens Sunimmo).
- **Test E2E "créer un bien A à Z" via UI** : ⚠️ JAMAIS effectué. Bloquant pour Phase 1.
- **Audit visuel post-refonte** : ⚠️ non fait. Refonte touche dashboard (biens, contracts, crm, admin, portail) + landing (publier, bienvenue, estimation, BiensRecoCards) — cohérence design + régressions visuelles non validées.

---

## Phase 0 — Stabilisation sprint fusion

**Durée estimée** : 3-5 jours.
**Objectif** : Fondation technique 100% propre. Rien ne casse. 1 bien créable de bout en bout.

**Critère de sortie (gate dur)** :
- TSC vert sur tout le frontend.
- `npm run build` vert.
- Migration 0029 exécutée en staging puis en prod.
- Test manuel "créer 1 bien A à Z" complet OK avec 3 fiches de test (minimaliste / standard / edge cases).
- Sunimmo Riviera (130 biens) migré et affiché sans bug.
- 0 bug bloquant connu.

**Étapes** :
1. ✅ Finir bundle P1 runtime (`crm`, `biens/[id]`, `biens/[id]/_shared`, `publier`, `DocumentQuickGenerator`).
2. ✅ Bundle P2 (`portail`, `bienvenue`, `estimation` + sélecteurs Playwright).
3. ✅ Bundle P3 (`BiensRecoCards` cosmétique).
4. ✅ Clôture sprint fusion : merge `refonte/fusion-properties-biens-complete` → `main` le 25/04/2026 18:41 GMT+2 (61 commits, +7652/−2579).
5. ✅ Création env staging Supabase (Restore to new project).
6. ✅ Backup manuel Supabase prod juste avant migration.
7. ✅ Migration 0029 en staging → validation (parité 5/5 session 8).
8. ✅ Migration 0029 en prod (T0 = 25/04/2026 14:34 GMT, durée 4 sec, exit 0).
9. ✅ Smoke test post-migration : endpoints critiques 200, login UI fonctionnel, pattern auth H3 validé.
10. ⚠️ **Test manuel "créer 1 bien A à Z" via UI** : non effectué. **Bloquant pour Phase 1.** À faire prioritairement avant tout autre chantier.
10bis. ⚠️ **Audit visuel post-refonte** : parcours manuel dashboard (biens, contracts, crm, admin, portail) + landing (publier, bienvenue, estimation) pour vérifier cohérence design + régressions. À faire conjointement avec étape 10.
11. Correction ciblée des bugs découverts en étapes 10 / 10bis.
12. Re-test → zéro régression.
13. Bascule Sunimmo Riviera progressive : 10 biens → check, 30 → check, 130 → check. **Reportée après étape 10 validée.**

---

## Phase 1 — Coming Soon + Alpha fermée

**Durée estimée** : 1-2 semaines.
**Objectif** : MVP pour 5-20 testeurs de confiance. Première validation externe.

**Critère de sortie (gate dur)** :
- 3+ testeurs alpha ont créé un bien complet, généré un contrat, généré une quittance, transité un loyer QR-IBAN sans intervention de Killian.
- Sunimmo Riviera tourne sur Althy en autonomie.
- 0 bug bloquant remonté depuis 7 jours.

**Étapes** :
1. Coming Soon landing + waitlist email (bypass admin + bypass `?beta=true` + robots.txt noindex).
2. Bascule Sunimmo Riviera complète (sortir du système actuel).
3. Tests E2E Playwright sur flows critiques (inscription, création bien, contrat, quittance, QR-IBAN).
4. Monitoring Sentry frontend + backend.
5. Email nurturing minimal (Welcome + Onboarding).
6. Onboarding wizard guidé 5 étapes post-inscription.
7. CGU / CGV / RGPD / LPD minimales (templates validés rapidement).
8. **Décision architecture i18n** : intégration `next-intl` (ou équivalent) + champ `locale` sur `User` backend. FR seul côté traductions pour l'instant, mais archi prête pour DE/IT/EN.
9. Alpha fermée : 5 testeurs sélectionnés (amis propriétaires + contacts Sunimmo + agents immo).
10. Feedback loop serré, corrections ciblées.

---

## Phase 2 — Lancement public payant

**Durée estimée** : 3-6 semaines.
**Objectif** : Althy vivant par lui-même avec premiers clients payants récurrents.

**Critère de sortie (gate dur)** :
- 10+ clients payants récurrents.
- MRR ≥ 500 CHF/mois.
- Churn < 10%/mois.
- Support gérable sans monopoliser 100% du temps de Killian.

**Étapes** :
1. Landing page publique finale (hero / problème-solution / features / pricing / témoignages alpha / FAQ).
2. Pages villes SEO (Genève, Lausanne, Vevey, Montreux, Fribourg, Sion).
3. Landing Mapbox + contour Suisse + topographie (existant à finaliser).
4. Endpoint SSE `/api/v1/landing/ask` (IA conversationnelle sur landing).
5. Pricing + Stripe activation complète (CHF 29 + CHF 9/canal + commission 3%).
6. Tunnel d'achat + facture automatique.
7. Dashboard agence (Scénario B : comptes agence séparés avec vue multi-propriétaires + permissions + facturation agence).
8. Intégrations canaux diffusion : **Flatfox d'abord** → **SMG (Homegate + ImmoScout24)** → **immobilier.ch**.
9. Email nurturing 5 séquences (Welcome / Onboarding / Re-engagement / Churn prevention / Upsell).
10. Programme parrainage (crédit 1 mois gratuit parrain + filleul).
11. Juridique pro (CGU / CGV validés par avocat CH).
12. Dépôt marque EUIPO (1100 CHF).
13. Export RGPD / droit à l'oubli.
14. Mode démo public `/demo` (compte démo pré-rempli).
15. **Marketplace locataire** complète (vue côté locataire : voir biens, candidater, alertes IA, dossier locataire premium).
16. **Activation i18n allemand (DE)** : traduction complète UI + templates emails DE + templates baux/quittances DE. CH alémanique ouverte.

**Note** : la "marketplace côté locataire" n'est pas un pilier à part, c'est la face locataire du produit qu'on construit déjà.

---

## Phase 3 — Écosystème marketplace 3 acteurs

**Durée estimée** : 6-10 semaines.
**Objectif** : Althy devient un écosystème professionnel. 3 nouveaux flux de revenus via commissions marketplaces.

**Critère de sortie (gate dur)** :
- 10+ Openers actifs.
- 10+ Artisans actifs.
- 5+ Hunters actifs avec transactions conclues.
- Commissions marketplaces = 20%+ du MRR total.

**Étapes** :
1. **Marketplace Openers** : inscription + profil + zone + tarif → mission visite → commission Althy 10-15%. Notation bidirectionnelle.
2. **Marketplace Artisans** : inscription + compétences + RC pro → intervention locataire → match IA → devis → exécution → commission Althy 10%.
3. **Fonction Hunters** (cross-produit, pas rôle utilisateur séparé) :
   - N'importe quel utilisateur Althy peut activer "mode Hunter" sur un bien.
   - Apport mandat → mail automatique au propriétaire avec mandat à signer (DocuSign ou espace Althy).
   - Champs `hunter_id` + `hunter_commission_rate` sur `Bien`.
   - Split commission à la conclusion : Hunter X% / agence partenaire Y% / Althy Z%.
   - Slogan UX intégré : "finance ton réseau".
   - Applicable location (Phase 3) + vente (Phase 4).
4. IA de matching transversal (Opener / Artisan / agence partenaire le plus pertinent selon bien + localisation + historique + disponibilités).
5. Tableau de bord propriétaire unifié : "Tout mon parc immo" (biens + locataires + missions + interventions + finances + priorités IA).
6. **Conformité légale CH** : cadrer avec avocat spécialisé la conformité de l'activité d'apport d'affaires immobilier (réglementation cantonale).

---

## Phase 4 — Resales Suisse (ventes immobilières)

**Durée estimée** : 8-12 semaines.
**Objectif** : Althy couvre la vente immobilière. 2e pilier produit. Même logique que la location, adaptée à la vente.

**Critère de sortie (gate dur)** :
- 5+ ventes effectuées via Althy.
- Module vente = 30%+ du MRR total.
- Hunters actifs sur ventes (pas juste locations).

**Étapes** :
1. Module "bascule mode vente" sur `Bien` (location ↔ vente, historique préservé).
2. Calcul automatique impôts / taxes / plus-values / déductions (adapté au canton CH).
3. Potentiel constructible terrain (cadastre suisse + réglementation communale).
4. Diffusion vente sur portails (Homegate, ImmoScout24, immobilier.ch en mode vente).
5. Marketplace agences immo partenaires (directory + matching + commission Althy sur mandats).
6. Accompagnement démarches IA : notaire / architecte / expert immobilier / banque (partenariats).
7. Cas d'usage "je représente un ami qui vend" (mécanique Hunter déjà en place Phase 3).
8. Marketplace Openers vente (visites vente avec pro dédié, pricing différent car engagement plus lourd).

---

## Phase 5+ — Évolutions post-lancement (à partir du 6e mois)

**Note** : ces chantiers ne sont pas à définir en détail maintenant. Ils seront re-priorisés selon les retours produit réels et les données d'usage.

**Expansion géographique** :
- Tessin (activation i18n IT).
- Anglais (activation i18n EN pour expatriés + communication internationale).
- Potentiellement France voisine (Annemasse, Thonon, bassin emploi CH).

**Hub conversationnel IA** (vision long terme Killian) :
- WhatsApp Cloud API (Meta) : lecture messages propriétaire + IA propose actions contextuelles.
- Microsoft Graph (Azure/Outlook) : lecture boîte mail + calendrier + IA propose actions.
- Infomaniak kMail API : idem pour utilisateurs Infomaniak.
- Pattern unifié "InboxParser" backend + UX conversation dans Althy avec suggestions d'action IA.

**App mobile** :
- PWA installable (couvre 80% des cas pour 5% du coût).
- App native iOS/Android si demande réelle prouvée.

**Extensions produit** :
- Gestion de copropriété (PPE).
- Gestion portefeuille investisseur (ROI, cashflow, benchmarks).
- Intégrations bancaires CH (UBS, Raiffeisen, Postfinance APIs).

---

## Règles transverses (toute la durée du projet)

**Règle 1 — Pas de phase N+1 avant phase N validée.** Les critères de sortie de chaque phase sont des **gates durs**, pas des indicateurs.

**Règle 2 — Discipline technique inchangée.** Tout chantier suit la même méthode : cartographie → cross-check backend → patch atomique → peer review → STOP+remontée si anomalie.

**Règle 3 — Dette technique acceptée mais tracée.** Chaque compromis = ligne dans SPRINT_LOG avec échéance et priorité.

**Règle 4 — Jalons business = jalons techniques.** Chaque fin de phase = push stable + tag git + SPRINT_LOG section fermée + backup Supabase manuel.

**Règle 5 — Pas d'intégration nouvelle parallèle à un chantier incomplet.** Le hub communication, on y pense, on ne l'ouvre pas tant que Phase 3 n'est pas bouclée. Même si ça brûle.

**Règle 6 — La roadmap se met à jour UNIQUEMENT quand un événement réel l'impose** (fin d'une phase, donnée produit contradictoire, contrainte légale concrète, retour utilisateur critique). Pas de re-discussion "pour le fun".

**Règle 7 — i18n-ready dès Phase 1.** Aucune string UI hardcodée en FR. Tout passe par le système i18n. Aucun template backend (email, PDF, bail, quittance) hardcodé en FR. Tout templatisé par locale.

---

## Synthèse visuelle

| Phase | Objectif | Durée | Critère sortie (gate) | i18n |
|---|---|---|---|---|
| **0** | Stabilisation fusion | 3-5 j | 1 bien A à Z + Sunimmo migré | FR |
| **1** | Alpha fermée 5-20 users | 1-2 sem | 3+ testeurs autonomes + Sunimmo auto | FR (archi i18n-ready) |
| **2** | Public payant + marketplace locataire | 3-6 sem | 10+ clients payants + MRR ≥ 500 CHF | FR + DE |
| **3** | Écosystème Openers + Artisans + Hunters | 6-10 sem | 20%+ MRR marketplaces | FR + DE |
| **4** | Resales vente immo | 8-12 sem | 5+ ventes + 30% MRR module vente | FR + DE stabilisés |
| **5+** | Expansion + Hub IA + Mobile | ∞ | Selon demande | + IT + EN |

**Total Phase 0 → Phase 4 : ~6-9 mois solo à plein régime.**

---

## Historique des versions

- **v1** (24 avril 2026, matinée) : draft initial après brainstorm vision.
- **v2** (24 avril 2026, après-midi) : correction Hunters (rôle ouvert à tous, pas phase à part, slogan "finance ton réseau").
- **v3** (24 avril 2026, après-midi) : ajout i18n complet (FR → DE → IT + EN) + Règle 7. **Version figée.**
- **v3.1** (25 avril 2026) — MAJ État actuel post-merge fusion Property→Bien (61 commits déployés prod) + post-migration 0029 prod. Phase 0 étapes 1-9 ✅. Étape 10 (test E2E créer un bien) marquée bloquante pour Phase 1. Étape 10bis (audit visuel post-refonte) ajoutée. Étape 13 reportée après étape 10.

**Prochaine révision** : uniquement quand un événement concret l'impose (fin Phase 0 ou feedback alpha contradictoire).
