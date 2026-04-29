# 5. Finances Althy

> **Source de vérité unique** pour le modèle économique + projections.
> Last update : 2026-04-29
> Audience : Killian, futurs investisseurs, futur DAF.
> Entité opérationnelle : **HBM Swiss Sàrl** (CHE-179.984.757 TVA).

> ⚠️ **Statut** : modèle économique **PROVISOIRE** (à valider terrain Phase 1).
> Projections 5 ans : **TODO** avec hypothèses cadrées (chiffres précis à compléter).

---

## 5.1 Vision pricing

**Volonté de viralité** : le **locataire ne paie JAMAIS rien à Althy**. Ni inscription, ni candidature, ni acceptation, ni frais cachés. Tout endpoint qui facturerait un locataire est un bug à corriger immédiatement (cf [`4-PRODUIT.md`](./4-PRODUIT.md) §4.7). Cette règle est l'arme principale de viralité — un locataire qui n'a rien à payer recommande Althy à son propriétaire suivant.

**Transparence** : pas de commission cachée. Le propriétaire sait toujours combien Althy prélève et pourquoi.

**Économie démontrée vs régie** : widget « CHF 328 économisés vs régie ce mois » affiché en hero de la fiche bien. Calcul transparent : `loyer_annuel × 10 % régie − CHF 348 abo annuel = économies`.

**Le gratuit crée l'addiction** : documents générés illimités gratuits (bail, quittance, EDL, relance, attestation). Une régie facture CHF 50-150 par document ; Althy en propose autant que nécessaire dans l'abonnement CHF 29.

**Frais sur transaction quand le client vient de gagner** : commission 3 % sur loyer réconcilié (ponctionnée *après* réception du loyer par le proprio, jamais en avance). L'utilisateur ressent la commission comme une « participation au succès » et non comme un frais sec.

---

## 5.2 Modèle économique Phase 1 (PROVISOIRE)

### Abonnement `proprio_solo`

| Période | Prix | Réduction |
|---|---|---|
| Mensuel | **CHF 29/mois** | — |
| Annuel | **CHF 290/an** | -16 % (équivalent CHF 24.17/mois) |

**Trial** : 14 jours sans carte → CHF 29 au M15 (Phase 2).

**Source code** : `frontend/src/lib/plans.config.ts`.

### Commission Althy sur loyers

- **3 %** sur loyers RÉCONCILIÉS via Althy (loyer reçu sur l'IBAN proprio + matché à un bien dans le système via réconciliation CAMT.054).
- **Mode dégradé QR direct = 0 %** — si le proprio refuse le passage par Althy pour la réconciliation et utilise le QR-facture sans matching, commission = 0 %.
- Cette structure incite naturellement à utiliser la réconciliation (rapports + audit + IA + dashboard « économies vs régie »).

**Stratégique** : les loyers ne transitent **jamais** par un compte Althy. Le QR-facture SPC 2.0 envoie directement le loyer sur l'IBAN du propriétaire. Cela évite l'enregistrement FINMA comme prestataire de services de paiement (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.8).

### Commission Althy sur transactions entreprises

- **5 %** sur transactions Stripe Connect (artisans / openers / experts).
- Frais Stripe (~2.9 %) à la charge de l'**artisan** (Option B figée).
- **Coût total artisan** : 5 % Althy + 2.9 % Stripe ≈ **7.9 %**.
- Acceptable pour artisan vs marketplace classique (10-15 % chez ServiceMaster, MyHammer, etc.).
- QR-code direct entre artisan et propriétaire = 0 % (incite à utiliser Stripe Connect via Althy pour la traçabilité + paiement échelonné + commission).

**Source service** : `backend/app/services/artisan_service.py:settle_intervention_payment`.

### Frais dossier locataire

- **CHF 45 PAYÉS PAR LE PROPRIÉTAIRE** (pas le locataire).
- Prélevés à l'**acceptation** d'une candidature (pas à la soumission).
- **Migration 0033** : champs `owner_fee_amount`, `owner_fee_paid_at`, `owner_fee_stripe_intent_id`, `owner_fee_failed_at`/`reason` sur `candidatures`.
- Mode : Stripe **off-session** (carte enregistrée à l'inscription du proprio).
- Échec de prélèvement n'annule **pas** l'acceptation (le proprio est notifié pour régulariser).

**Anciennes colonnes locataire** (`candidatures.frais_payes`, `candidatures.stripe_pi_id`) : conservées pour audit historique mais **plus jamais écrites** depuis le pivot du 20/04/2026.

---

## 5.3 Sources de revenus par phase

### Phase 1 (active)

- Abonnement `proprio_solo` : CHF 29/mois ou CHF 290/an
- Commission **3 %** sur loyers réconciliés
- Commission **5 %** sur transactions Stripe Connect (artisans M1 partiel GE+VD)
- Frais dossier locataire **CHF 45** (payés par le proprio)
- Plan gratuit : CHF 0 (1 bien max, essai)

### Phase 2 (lancement public)

- + Caution apporteur (commission **GoCaution** ~10 %)
- + Assurance RC (commission **La Mobilière** ~CHF 40/police)
- + Déménagement (commission ~6 %)
- + Activation rôle agence : abo **CHF 49/agent/mois** (A5)
- + Portail proprio agence (A6) : abo **CHF 9/mois**
- + Canaux diffusion annonce : **CHF 9/mois par canal** (Homegate, ImmoScout24, immobilier.ch, ImmoStreet — Flatfox + althy.ch inclus gratuitement)

### Phase 3 (marketplace 3 acteurs)

- + Commission openers **10-15 %** sur missions visite/EDL/check-in
- + Commission hunters (referral fee variable, slogan « Finance ton réseau »)
- + Commission experts **8-15 %** (géomètres, archi, photographes)
- + Abo `artisan_verified` **CHF 49/mois** (M1 généralisé)
- + Abo `artisan_free_early` CHF 0 à vie (50 fondateurs / canton, stratégie Uber)

### Phase 4 (Resales — ventes immo)

- + Commission vente Hunters **0.5 %** du prix de vente
- + Module vente complet (commission via marketplace agences immo partenaires)
- + Compta agence complète (upgrade abo agence vers `enterprise` CHF 1500-5000/mois)

### Phase 5+ (exploratoire — non figé)

- API B2B + données marché : CHF 6 000 - 36 000/mois (banques, assureurs, urbanistes)
- Indice Althy des loyers romands (vente données aux banques)
- Abonnement acheteur premium : CHF 9/mois (alertes off-market, dossier acheteur)

**Sources tarifaires** : `frontend/src/lib/plans.config.ts` + CLAUDE.md §D pricing v3.

---

## 5.4 Pivot stratégique A6 → A4 (Althy Autonomie)

**Concept** : un propriétaire en compte invité d'agence (A6 — CHF 9/mois) peut basculer vers Althy Autonomie (A4 — CHF 39/mois) pour devenir autonome.

**Mécanique backend** :
- Trigger : webhook Stripe sur changement d'abonnement.
- `agency_relationships.status = 'left_for_autonomy'`.
- Fonction : `backend/app/routers/stripe_webhooks.py:_trigger_autonomy_upgrade()`.
- Notification à l'agence (in-app + email Resend).
- Log frontend : `autonomy_activated` (PostHog).

**Pourquoi c'est stratégique** : un proprio qui quitte une agence garde son historique Althy. Il ne perd rien. C'est la **migration douce** régie → autonomie, qui justifie l'écart de prix (CHF 9 → CHF 39).

**Détail produit** : `frontend/src/app/app/(dashboard)/autonomie/page.tsx` (dashboard ou pitch selon `plan_id`).

---

## 5.5 Coûts fixes mensuels par phase

| Poste | Phase 1 (M3) | Phase 2 (M12) | Phase 3 (An 3) |
|---|---|---|---|
| Vercel Pro | CHF 20 | CHF 35 | CHF 80 |
| Railway (FastAPI + worker + beat + Redis) | CHF 50 | CHF 90 | CHF 200 |
| Supabase Pro (DB + Auth + Storage) | CHF 25 | CHF 25 | CHF 100 |
| Anthropic Claude (Sonnet) — voir §5.6 | CHF 91 | CHF 380 | CHF 1100 |
| Stripe (% volume — non fixe) | ~CHF 29 | ~CHF 100 | ~CHF 250 |
| Resend (emails) | CHF 0 (free) | CHF 20 | CHF 80 |
| Twilio (SMS) | CHF 5 | CHF 30 | CHF 100 |
| Mapbox | CHF 0 (free) | CHF 0 (free) | CHF 50 |
| Sentry | CHF 0 (free) | CHF 26 | CHF 80 |
| BetterStack uptime | CHF 0 (free) | CHF 18 | CHF 18 |
| PostHog | CHF 0 (free) | CHF 0 (free) | CHF 100 |
| Domaine + DNS + SSL | CHF 5 | CHF 5 | CHF 5 |
| Fiduciaire externe | CHF 300 | CHF 300 | CHF 500 |
| **Total** | **~CHF 525** | **~CHF 1029** | **~CHF 2663** |

**Hors masse salariale** (cf §5.8). **Hors marketing** (cf §5.7 hypothèses).

---

## 5.6 Coût IA (rate limiting + simulation)

**Rate limit Phase 1** : 30 interactions/jour `starter`, 100/jour `proprio_pro`.

**Coût par interaction Anthropic Claude Sonnet** (mai 2026) :
- Tokens entrée : ~2 000 tokens × $3 / 1M tokens = $0.006
- Tokens sortie : ~500 tokens × $15 / 1M tokens = $0.0075
- **Total ~CHF 0.012 par interaction** (taux CHF/USD ~0.91).

| Profil usage | Interactions/jour | Coût/mois | Marge sur abo |
|---|---|---|---|
| Léger (5/jour) | 5 | ~CHF 1.80 | CHF 27.20 / 29 |
| Moyen (15/jour) | 15 | ~CHF 5.40 | CHF 23.60 / 29 |
| Standard plafonné (30/jour) | 30 | ~CHF 10.80 | CHF 18.20 / 29 |
| Pro plafonné (100/jour) | 100 | ~CHF 36 | (-) — plan pro CHF 79 |

**Mécanisme anti-abus** : au-delà du rate limit, réponse simplifiée (moins de tokens, moins de contexte). Bloque les coûts.

**À toutes les phases** : coût IA cible < **3 % du CA**. À surveiller mensuellement.

---

## 5.7 Projections 5 ans (TODO avec hypothèses cadrées)

> ⚠️ **STATUT** : projections à compléter avec hypothèses confirmées Killian. Les chiffres ci-dessous sont des **placeholders de structure** — ils n'engagent pas.

### Hypothèses cadrées (à confirmer avec Killian)

- Loyer moyen plateforme : **CHF 1 800/mois**
- Taux activation paiements Althy : **70 %** an 1 → **85 %** an 5
- Rotation locataires par bien/an : **0.35** (changement tous les ~3 ans)
- Biens moyens par `proprio_solo` : **4**
- Biens moyens par `agence` : **80**
- Coût IA par user/mois : **CHF 0.50 - 6** selon usage
- Churn cible Phase 2 : **< 10 %/mois**

### À compléter (TODO Killian)

- [ ] Cible utilisateurs Phase 1 (3 mois, 6 mois, 12 mois)
- [ ] Cible utilisateurs Phase 2 (lancement public)
- [ ] Cible utilisateurs Phase 3 (marketplace)
- [ ] Hypothèse churn par phase
- [ ] Scénarios pessimiste / réaliste / optimiste
- [ ] ARR cible par phase
- [ ] Break-even attendu

### Calcul de revenu unitaire (référence)

Pour 1 `proprio_solo` moyen (4 biens, 4 loyers de CHF 1 800, 70 % activation paiements) :

```
Abo annuel               : CHF 290
Commission loyers        : 4 biens × 12 mois × 1 800 × 70 % × 3 %
                         = CHF 1 814/an
Frais dossier (0.35 rotation × 4 biens)
                         = 1.4 acceptations/an × CHF 45
                         = CHF 63/an

ARPU annuel proprio_solo ≈ CHF 2 167
```

À multiplier par la cohorte cible × (1 - churn).

---

## 5.8 Plan recrutement par phase

| Phase | Période | Effectif | Coût mensuel masse salariale |
|---|---|---|---|
| Phase 1 | M1 → M6 | Fondateur seul | CHF 0 |
| Phase 2 | M7 → M12 | + 1 commercial terrain | CHF 5 500 + 10 % ARR apporté |
| Phase 3 | M13 → M18 | + 1 lead développeur | CHF 9 000 |
| Phase 4 | M19 → M24 | + 1 customer success | CHF 4 500 |
| Phase 5 | An 3+ | Équipe ~9 personnes | ~CHF 80 000 |

### Règles strictes

- **Recrutement uniquement si revenu couvre 3× le salaire** (sécurité 9 mois de runway après embauche).
- **Pas de recrutement commercial avant CHF 100k ARR** (besoin de produit-market-fit avant scale).
- **Openers / artisans / experts / hunters = JAMAIS employés** (marketplace pure, contractors via Stripe Connect).
- **Fiduciaire externe** dès Phase 1 (CHF 300/mois) — délégation comptabilité.

---

## 5.9 Garde-fous financiers

- **Autofinancement strict** — jamais de dette bancaire.
- **Pas de levée pré-Série A** — sauf opportunité stratégique (entrée d'un client majeur, ouverture marché DACH).
- **Sunimmo Riviera (130-180 biens du fondateur)** = revenu garanti dès Phase 1. Couvre les coûts fixes Phase 1.
- **Coûts fixes Phase 1 < CHF 600/mois** (cf §5.5 — couverts par Sunimmo).
- **Paiement clients en avance** (annuel -16 %) pour améliorer le cash.
- **Pas de frais variables non maîtrisés** : rate limit IA, plafond Stripe, plafond Twilio.

---

## 5.10 Conformité financière

### FINMA non requise

- QR direct (loyers ne transitent **pas** par compte Althy) → pas de licence FINMA.
- Stripe Connect = établissement de paiement réglementé en Europe → exonération.
- Estimation IA : disclaimer obligatoire (« à titre indicatif ») → pas de qualification « conseil en placement » au sens de la LSFin art. 3.

### TVA et entité

- **HBM Swiss Sàrl** — IDE/TVA : **CHE-179.984.757 TVA**.
- Régime TVA : assujetti normal (CHF 100k+ CA prévisionnel Phase 2).
- Taux applicable : 8.1 % (depuis 01/01/2024).

### Comptabilité

- Tenue par fiduciaire externe (CHF 300/mois Phase 1 → CHF 500/mois Phase 3+).
- Plan comptable suisse standard (PME OBA art. 957).
- Compatible exports Bexio, Banana, AbaWeb.

### Rapports légaux annuels

- Bilan + compte de résultat + annexe (CO art. 957a).
- Décompte TVA trimestriel.
- Décompte AVS si masse salariale > 0.

---

## 5.11 Grandfathering

**Mécanique** : les anciens clients à un prix ancien conservent leur prix jusqu'à résiliation ou changement volontaire.

**Source code** :
- `subscriptions.is_grandfathered` (bool — migration 0029).
- `subscriptions.grandfathered_price` (decimal — migration 0031).
- `profiles.grandfathered_price` (decimal — migration 0031).

**Cas d'usage** : les agences actuelles à CHF 79/mois (avant pivot pricing v3) conservent leur prix. Au prochain renouvellement automatique : prix inchangé tant que `is_grandfathered = true`.

**Décision pricing** : tout changement de prix est non rétroactif par défaut. Le grandfathering est appliqué automatiquement à la migration tarifaire.

**Mappings legacy** : `LEGACY_PLAN_MAP` dans `plans.config.ts` :
- `decouverte`, `vitrine` → `gratuit`
- `solo` → `starter`
- `proprio` → `pro`
- `agence_premium` → `enterprise`

---

## Annexes

- [1-VISION.md](./1-VISION.md) — Vision macro Althy
- [2-ROADMAP.md](./2-ROADMAP.md) — Phases produit + sprints
- [3-ARCHITECTURE.md](./3-ARCHITECTURE.md) — Stack technique
- [4-PRODUIT.md](./4-PRODUIT.md) — Spec fonctionnelle
- [6-LEGAL.md](./6-LEGAL.md) — Conformité juridique
- `frontend/src/lib/plans.config.ts` — source de vérité tarifs
- `backend/app/models/subscription.py` — modèle abonnements + grandfathering
