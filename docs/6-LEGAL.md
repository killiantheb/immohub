# 6. Légal Althy

> **Source de vérité unique** pour la conformité juridique opérationnelle.
> Last update : 2026-04-30 (v5)
> Audience : Killian, avocat, futur DPO, Claude Code (alertes).
> Entité opérationnelle : **HBM Swiss Sàrl** — IDE/TVA **CHE-179.984.757 TVA**.

---

## 6.1 Entité légale actuelle

### Vehicle légal actif

| Rubrique | Valeur |
|---|---|
| Raison sociale | **HBM Swiss Sàrl** |
| IDE / TVA | **CHE-179.984.757 TVA** |
| Forme juridique | Société à responsabilité limitée (Sàrl) suisse |
| Statut | Active — vehicle d'opération pour `althy.ch` |

HBM Swiss Sàrl est la société du fondateur (Killian Thébaud) qui sert de **vehicle d'opération immédiat** pour Althy. Toutes les factures clients (abonnements CHF 29, frais dossier proprio CHF 45, commissions 3 % loyers) sont émises par HBM Swiss Sàrl. Toutes les obligations fiscales, comptables et nLPD lui incombent.

### Marque commerciale

| Rubrique | Valeur |
|---|---|
| Marque utilisée publiquement | **Althy** |
| Domaine | **althy.ch** |
| Logo | « A althy » (4 variantes — `frontend/src/components/AlthyLogo.tsx`) |

### Athyl Sàrl / Althy Sàrl (futur)

- **Statut** : standby. Constitution non urgente.
- **Plan** : à constituer si traction commerciale justifie un transfert (typiquement > CHF 200k ARR + ouverture aux investisseurs).
- **Transfert futur** : HBM Swiss Sàrl → Althy Sàrl par cession de fonds de commerce. Doit être permis sans refacto code grâce à la source unique `legal-entity.ts` / `config.py`.

### Affichage frontend

- Mentions légales `/legal` : « **HBM Swiss Sàrl, IDE CHE-179.984.757 TVA** ».
- Footer : « © Althy — HBM Swiss Sàrl ».
- **Pas d'affichage « Killian Thébaud »** en frontend (séparation perso/pro voulue).
- **Pas d'affichage « Sunimmo »** en frontend (séparation Sunimmo/Althy — Sunimmo reste l'agence du fondateur).

### Source de vérité unique

| Couche | Fichier | Variables |
|---|---|---|
| Frontend | `frontend/src/lib/legal-entity.ts` | `LEGAL.name`, `LEGAL.form`, `LEGAL.ide`, `LEGAL.address`, etc. |
| Backend | `backend/app/core/config.py` | `ALTHY_CREDITOR_NAME`, `ALTHY_CREDITOR_IDE` |
| Variables d'env Railway | (à configurer) | `ALTHY_CREDITOR_NAME=HBM Swiss Sàrl`, `ALTHY_CREDITOR_IDE=CHE-179.984.757 TVA` |

### Règle absolue

> ⚠️ **Jamais hardcoder** « Althy SA » / « Althy Sàrl » / « HBM Swiss Sàrl » dans le code source. Toujours via `LEGAL.*` (frontend) ou `settings.ALTHY_CREDITOR_*` (backend).

Cette règle permet le transfert futur vers Althy Sàrl sans refacto code (`grep -r "HBM Swiss"` doit ne rien trouver hors des fichiers de source de vérité).

**Backlog code à corriger** (cf §6.16) : 3 occurrences hardcodées « Althy SA » dans le backend (`config.py:104`, `services/qr_facture.py:207`, `services/quittance.py:103`) — **CRITIQUE** à patcher avant le 1er client externe.

---

## 6.2 Conformité nLPD 2023 (RS 235.1)

### Responsable du traitement

- **Entité** : HBM Swiss Sàrl (CHE-179.984.757 TVA).
- **Contact privacy** : `privacy@althy.ch`.
- **Représentant** : Killian Thébaud (en sa qualité de gérant HBM Swiss Sàrl).

### Registre des activités de traitement (art. 12)

⏳ **À CRÉER** (TODO avocat). Doit lister pour chaque traitement :
- Finalité du traitement.
- Catégories de données (identité, contact, financières, IA).
- Catégories de personnes concernées (proprios, locataires, candidats).
- Sous-traitants (cf §6.4).
- Durées de conservation (cf §6.12).
- Mesures de sécurité (chiffrement, RLS, audit logs).

### Délégué à la protection des données — DPD (art. 10)

- **Décision après consultation avocat**.
- Probablement non obligatoire (taille entreprise — < 250 employés, pas de traitement à grande échelle de données sensibles).
- Si obligatoire : DPD externe (CHF 100-200/mois) ou rôle interne attribué à Killian.

### Droits des personnes (art. 25-27)

- Droit d'accès, rectification, effacement, portabilité, opposition, restriction.
- **Délai de réponse** : 30 jours (extensible à 60 jours si complexe).
- **Procédure** : email à `privacy@althy.ch` avec pièce d'identité.
- **Implémentation Phase 2** : endpoint self-service `/profil/donnees` (export JSON + suppression compte).

---

## 6.3 RGPD (en complément si users EU)

- Politique de confidentialité actuelle référence **RGPD art. 6.1.a** (consentement) — à harmoniser avec nLPD pour cohérence.
- **Phase 1** : utilisateurs CH uniquement, RGPD applicable indirectement via SCCs sous-traitants.
- **Phase 5+ (expansion DACH)** : conformité RGPD allemande renforcée (Impressum DE, AGB conforme BGB, validation avocat allemand).

---

## 6.4 Sous-traitants étrangers

| Sous-traitant | Pays | Données traitées | DPA + SCCs |
|---|---|---|---|
| Supabase Inc. | USA (infra EU Frankfurt) | Toutes données (DB, auth, Storage) | ✅ |
| Vercel Inc. | USA | Logs accès, code frontend | ✅ |
| Railway Corp. | USA | Logs application, API backend | ✅ |
| Stripe Inc. | USA | Données paiement (abonnements + Connect) | ✅ |
| Anthropic PBC | USA | Q/R IA (anonymisées avant envoi) | ✅ |
| Resend Inc. | USA | Emails transactionnels | ✅ |
| Twilio Inc. | USA | SMS, WhatsApp (n° tel + contenu) | ✅ |
| Mapbox Inc. | USA | Géolocalisation (pas de données perso) | ✅ |
| PostHog Inc. | USA / EU | Analytics comportementales (opt-in) | ✅ |

**Note** : tous les transferts USA sont couverts par les **SCCs (Standard Contractual Clauses)** annexés aux DPA. Le successor du Privacy Shield (Data Privacy Framework de juillet 2023) est applicable pour les sous-traitants certifiés DPF.

**Question avocat** : les garanties sont-elles suffisantes au regard de l'art. 16 nLPD pour les transferts vers les USA ? (cf [questions archivées §3.A.4](./archive/legal/dossier-avocat-audit-juridique-2026-04-19.md)).

---

## 6.5 APIs publiques suisses (sources de données)

Cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md#38-intégrations-externes) §3.8 et [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A1 pour la liste exhaustive et les détails techniques.

| API | Source | Statut juridique |
|---|---|---|
| **GeoAdmin Swisstopo** | Confédération | Données ouvertes (LGéo / OGéo) — réutilisation libre, mention « source : swisstopo » obligatoire |
| **RegBL** | OFS | Données ouvertes — réutilisation libre, mention OFS |
| **BNS** | Banque nationale suisse | Données publiques (taux hypothécaire) — citation source |
| **OFS** | Office fédéral de la statistique | Données ouvertes — réutilisation libre, mention OFS |
| **Zefix** | Confédération | Registre public — accès gratuit limité, conditions générales Zefix applicables |
| **AFC** | Administration fédérale des contributions | Données publiques (barèmes, taux TVA) — redistribution commerciale automatisée à clarifier |
| **Cadastre cantonal VS / VD / GE** | Cantons | Variable selon canton (LGéoCH + lois cantonales) — conditions par canton à vérifier |

**Conformité nLPD** : aucune donnée personnelle n'est exposée par ces APIs (RegBL = bâtiment, GeoAdmin = parcelles, BNS = taux, OFS = statistiques agrégées). Elles peuvent être interrogées sans collecte préalable de consentement utilisateur.

**Mentions de source** : tous les outputs Althy reposant sur ces APIs (fiche bien, estimation IA, rapports) doivent porter la mention « source : swisstopo / OFS / BNS » conformément aux conditions de réutilisation des données ouvertes CH.

**Question avocat** : la redistribution des barèmes AFC dans nos PDFs (quittances, fiscalité) constitue-t-elle une « utilisation commerciale » nécessitant une autorisation préalable ? Cf [questions archivées §3.A.5](./archive/legal/dossier-avocat-audit-juridique-2026-04-19.md).

---

## 6.6 DBs propriétaires Althy anonymisées

Althy constitue progressivement des bases de données différenciatrices (prix m² loyer, prix m² vente, démographique locataire, comparables vente, tendances marché 5 ans). Cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md#38-intégrations-externes) §3.8 et [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A2 pour la liste exhaustive et les sources d'alimentation.

### Garantie d'anonymisation k-anonymity ≥ 5

**Toutes** les DBs propriétaires sont alimentées avec des données anonymisées selon le principe **k-anonymity ≥ 5** : chaque enregistrement est indistinguable d'au moins 4 autres sur les attributs quasi-identifiants (zone géographique, surface, type de bien, année de construction). Cela garantit qu'un attaquant ne peut pas remonter à un bien ou un locataire identifiable depuis les statistiques publiées ou commercialisées.

**Procédure technique** :
- Agrégation par zone NPA (jamais par adresse précise ni EGID).
- Surface arrondie (tranches de 10 m²).
- Année construction arrondie (tranches de 5 ans).
- Suppression de tous les identifiants directs (nom, IDE, EGID, EWID, parcelle).
- Validation k-anonymity automatisée avant publication.

### Conformité nLPD

L'anonymisation au sens de l'**art. 5 let. a nLPD** doit être **irréversible** pour sortir du champ des données personnelles. Si k-anonymity ≥ 5 réduit fortement la probabilité de ré-identification, un **audit technique formel** est prévu Phase 2 (~CHF 1 500 — cf §6.16 TODO Killian) avant exploitation commerciale, notamment pour l'**indice Althy des loyers romands** prévu Phase 5+ (commercialisation API B2B banques / gérances).

### Sources d'alimentation et risques juridiques

| DB Althy | Sources | Phase | Risque juridique principal |
|---|---|---|---|
| Prix m² loyer / vente par zone | Listings + contrats Althy + scraping anonymisé portails | P2-P3 | Conditions scraping portails (LCD art. 5 — actes parasitaires) à valider |
| Démographique locataire | TenantFile Althy anonymisé | P3 | k-anonymity strict requis (données sensibles) |
| Risques (zones inondables, bruit) | Couches publiques OFEV + cantonales | P3 | Données publiques — pas de risque |
| Barème AFC travaux déductibles | AFC + jurisprudence | P2 | Cf §6.5 (redistribution commerciale) |
| Comparables vente IA enrichis | DB Althy + registre foncier + portails | P3 | Statut registre foncier cantonal à vérifier |
| Tendances marché 5 ans | Historique Althy + données OFS | P2 | Données OFS = OK ; historique Althy = anonymisation requise |

**Question avocat** : la commercialisation Phase 5+ de l'« indice Althy des loyers romands » via API B2B (banques, gérances, assurances) requiert-elle un cadre contractuel spécifique (CGV API, SLA, garantie anonymisation, clause de non-ré-identification) ? Cf [questions archivées §3.A.6](./archive/legal/dossier-avocat-audit-juridique-2026-04-19.md).

---

## 6.7 IA et données personnelles

### Pseudonymisation avant envoi

L'IA Anthropic Claude traite des contextes contenant potentiellement des noms de locataires, montants de loyers, adresses. **Avant tout envoi à Claude** :

- Noms propres → tokens pseudonymes (`Locataire_001`, `Bien_042`).
- Adresses précises → ranges (`Lausanne, VD` au lieu de `Av. de la Gare 12, 1003 Lausanne`).
- Montants → ranges (`CHF 1500-2500` au lieu de `CHF 1850.50`).
- Données financières détaillées → totaux agrégés.

**Implémentation** : `backend/app/services/ai_service.py:_anonymize_context()` (à auditer Phase 2).

### AIPD (Analyse d'Impact Protection Données)

- **À prévoir avant lancement public Phase 2**.
- Justification : traitement à grande échelle de données personnelles sensibles (financières, locatives) avec IA tierce (Anthropic).
- Coût estimé : CHF 3 000 - 5 000 (avocat spécialisé nLPD).

### Garde-fous techniques

- Rate limiting (cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md) §3.5 et [`4-PRODUIT.md`](./4-PRODUIT.md) §4.3).
- Journal audit `ai_sessions` (chaque interaction tracée).
- Disclaimer obligatoire visible sur tout output IA.
- Validation humaine obligatoire avant action irréversible.

---

## 6.8 LCD (RS 241) — Slogans, témoignages, preuves sociales

### Témoignages — règles strictes

- Tout témoignage = **sourçable, daté, vérifiable**.
- Si le client est une entité du fondateur (ex : Sunimmo Riviera), explicité dans le texte.
- **Témoignage « Patrick M. — 130 biens » : RETIRÉ** de la landing (LCD art. 3 al. 1 let. b — indications fallacieuses sur soi-même).

### Statistiques

- Toute statistique = vérifiable et à jour, calculée dynamiquement depuis la DB.
- **« 2 847 estimations réalisées » : RETIRÉ** (non vérifiable au moment de l'affichage).
- **« 130 biens gérés »** : à clarifier (= biens Sunimmo, séparation marque). Préférer « **N biens propriétaires** » avec N calculé en live depuis `SELECT count(*) FROM biens WHERE is_active=true`.

### Slogans actuels (à challenger avec avocat)

- « Votre bien, géré sans agence. » (H1 principal)
- « Propriétaire, sans charge mentale. » (sous-titre)
- « Louer et vendre, c'est simple. »

**Question avocat** : sont-ils conformes à la LCD ? Le mot « géré » ne crée-t-il pas une confusion avec une activité de régie réglementée ? Cf [questions archivées §3.B.10](./archive/legal/dossier-avocat-audit-juridique-2026-04-19.md).

---

## 6.9 CO art. 253ss / 412ss — Gestion locative

### Frais dossier locataire

- **CHF 45 payés par le PROPRIÉTAIRE** (jamais le locataire).
- Compatible **CO art. 254** (pas de frais à charge du locataire pour la conclusion du bail).
- Pas de qualification de courtage (**CO art. 412+**) — Althy ne met pas en relation, le proprio choisit librement.
- Cf [`4-PRODUIT.md`](./4-PRODUIT.md) §4.7 et [`5-FINANCES.md`](./5-FINANCES.md) §5.2.

### Quittances générées par IA

- **Disclaimer obligatoire** (champ `documents.disclaimer_included = true`).
- **Responsabilité partagée** propriétaire ↔ Althy à clarifier avec avocat (cf §3.C.13 archive). Pré-position : la responsabilité primaire incombe au proprio (validation avant envoi), Althy fournit l'outil avec disclaimer.

### EDL (état des lieux) signé électroniquement

- Valeur juridique = signature électronique CH (LSCSE — Loi sur la signature électronique).
- Horodatage + audit log conservés.
- **Phase 2** : intégration prestataire e-signature certifié (Skribble, DocuSign EU, ou Swisscom Sign Service).

### QR-factures SPC 2.0

- Norme suisse SIX (Standard Postal Code 2.0).
- **Émetteur** : HBM Swiss Sàrl (source `legal-entity.ts` + `config.py`).
- Conformité SIX : pas d'obligation d'enregistrement supplémentaire pour générer des QR-factures (la banque créancière les accepte).

---

## 6.10 LSFin / FINMA

### QR direct (paiement loyer) — pas de FINMA

- Les loyers ne transitent **PAS** par un compte Althy.
- L'argent va de la **banque locataire → banque propriétaire directement**.
- Althy ne fait que **générer la QR-facture** + **réconcilier** la réception.
- ⇒ **Pas de licence FINMA requise** comme prestataire de services de paiement.

### Stripe Connect (transactions artisans / openers) — pas de FINMA

- Stripe = établissement de paiement réglementé en Europe (PSD2).
- Althy = bénéficiaire d'une commission de plateforme via `application_fee_amount`.
- ⇒ **Pas de licence FINMA requise**.

### Estimation IA

- **Disclaimer obligatoire** : « À titre indicatif, ne constitue pas un conseil financier ou en placement ».
- Pas de qualification « conseil en placement » au sens de la **LSFin art. 3**.
- Pas de qualification « service financier ».

### Backlog FINMA

- ⏳ **Avis FINMA formel à obtenir avant lancement public Phase 2** (CHF 1 500 - 3 000 — avocat spécialisé droit bancaire).

---

## 6.11 Communications (LCD art. 3 al. 1 let. o)

### Email transactionnel

- Consentement implicite via bail signé entre proprio et locataire.
- Opt-out facile (lien désinscription dans chaque email).
- Émetteur : `noreply@althy.ch` (HBM Swiss Sàrl identifiable dans le pied de page).

### SMS Twilio

- Numéro identifiable Althy (Sender ID configuré).
- Notifications critiques uniquement (paiement réussi, échec relance).
- Opt-out possible via paramètres compte.

### WhatsApp Business API (Phase 5+)

- **Pas Phase 1**.
- **Opt-out par message obligatoire** (LCD art. 3 al. 1 let. o).
- Conformité LCD : pas de démarchage commercial sans consentement explicite.
- Numéro Meta Business identifiable comme appartenant à Althy.

### Démarchage commercial

- **Interdiction sans consentement explicite** (CGU + opt-in case à cocher).
- Newsletter : opt-in obligatoire, double opt-in confirmation email.
- Aucun email de prospection à des non-utilisateurs.

---

## 6.12 Rétention données

| Type de donnée | Durée | Base légale |
|---|---|---|
| Données financières (paiements, factures, baux) | **10 ans** | Obligation fiscale CH (CO art. 958f) |
| Données utilisateur (profil, contact) | **Durée du compte + 2 ans** | nLPD art. 6 |
| Audit logs (`audit_log`) | **Au-delà des suppressions** | Préservation traçabilité légale |
| Biens (`biens.is_active = false`) | **Soft delete permanent** | Pas de hard delete (audit nLPD) |
| Sessions IA (`ai_sessions`) | **Durée du compte + 2 ans** | nLPD art. 6 |
| Logs application (Sentry) | **30 jours** (default Sentry) | Sécurité / debugging |

**Implémentation** :
- Pas de hard delete sur `biens`, `tenants`, `leases` (uniquement `is_active = false`).
- Job Celery mensuel : purge des données utilisateur après `compte_supprime_at + 2 ans` (Phase 2).
- Audit logs préservés indéfiniment dans une table partitionnée par année.

---

## 6.13 Propriété intellectuelle

### Logo Althy

- 4 variantes « A althy » créées par Killian Thébaud.
- Fichier source : `frontend/src/components/AlthyLogo.tsx` (SVG inline).
- Cession à HBM Swiss Sàrl par contrat de licence (à formaliser).

### Marque Althy

- **Dépôt EUIPO prévu Phase 2** (~CHF 1 100 — classes 9, 36, 42).
- Protection cible :
  - **IPI** (Suisse) — Phase 2.
  - **EUIPO** (Union Européenne) — Phase 2.
  - **USPTO** (USA) — Phase 5+ si expansion.
- Domaine `althy.ch` enregistré au nom de HBM Swiss Sàrl.

### Code source

- **Propriété originale** : Killian Thébaud (auteur).
- **Transfert vers HBM Swiss Sàrl** : opéré via contrat de licence d'utilisation exclusive.
- **Transfert futur vers Althy Sàrl** : prévu si constitution. Mécanisme : cession de fonds de commerce.
- Licence : code propriétaire (pas open source). Repo GitHub privé.

---

## 6.14 Clauses de non-responsabilité

### Sphère IA

- Disclaimer visible obligatoire dans l'UI (composant `<SphereDisclaimer />`).
- Texte : « **Réponses IA à titre indicatif, validation utilisateur requise** ».

### Estimation IA

- Disclaimer dans tous les rapports : « **À titre indicatif, ne constitue pas un conseil financier** ».
- Pas de garantie de précision (exclusion LSFin art. 3).
- Source : `frontend/src/legal/CH/disclaimer-ia.md`.

### Documents générés IA

- Pied de page automatique avec disclaimer.
- Champ `documents.disclaimer_included = true` (NOT NULL si `generated_by_ai = true`).
- Source texte : `frontend/src/legal/CH/disclaimer-ia.md`.

### Liens vers fichiers source

| Document | Fichier source |
|---|---|
| CGU | `frontend/src/legal/CH/cgu.md` |
| Confidentialité | `frontend/src/legal/CH/confidentialite.md` |
| Cookies | `frontend/src/legal/CH/cookies.md` |
| Disclaimer IA | `frontend/src/legal/CH/disclaimer-ia.md` |
| Mentions légales | rendu depuis `lib/legal-entity.ts` |

---

## 6.15 Contenus légaux par pays (i18n)

**Structure** :
- `frontend/src/legal/{CH,FR,DE,IT}/` (4 dossiers — placeholders FR/DE/IT non remplis).
- `backend/legal/{CH,DE,FR,IT}/` (snippets PDF / templates emails).

**Activation par phase** :
- **Phase 1** : CH activé (`fr-CH`).
- **Phase 2** : DE activé (`de-CH`).
- **Phase 5+** : IT (`it-CH`) + EN.

### Règle absolue

> ⚠️ **Ne JAMAIS activer une locale sans validation juridique locale.**
> RGPD FR / DSGVO + Impressum DE / Codice Privacy IT.
> Avocat pays requis avant activation.

**Procédure d'activation** :
1. Compléter `messages/{locale}.json`.
2. Traduire `src/legal/{COUNTRY}/*.md`.
3. **Validation juridique locale par avocat pays** (CHF 2 000 - 5 000).
4. Tester le redirect locale + cookie.
5. Ajouter à `LOCALES_ENABLED` dans `frontend/src/i18n/config.ts`.

Cf [`3-ARCHITECTURE.md`](./3-ARCHITECTURE.md) §3.7.

---

## 6.16 Backlog juridique

### Questions encore ouvertes (référence archive)

📚 Source détaillée : [`docs/archive/legal/dossier-avocat-audit-juridique-2026-04-19.md`](./archive/legal/dossier-avocat-audit-juridique-2026-04-19.md) — **26 questions à l'avocat** classées par domaine (nLPD, LCD, CO, LSFin, communications, rémunération).

### Bugs juridiques code à corriger CRITIQUE

| Problème | Localisation | Sévérité |
|---|---|---|
| « Althy SA » hardcodé | `backend/app/core/config.py:104` | 🔴 CRITIQUE (LCD art. 3) |
| « Althy SA » hardcodé | `backend/app/services/qr_facture.py:207` | 🔴 CRITIQUE (LCD art. 3) |
| « Althy SA » hardcodé | `backend/app/services/quittance.py:103` | 🔴 CRITIQUE (LCD art. 3) |
| Politique conf. réf. RGPD au lieu de nLPD | `frontend/src/app/legal/confidentialite/page.tsx:84` | 🟡 IMPORTANT |
| « en cours de constitution » encore affiché | `frontend/src/app/legal/page.tsx:29,36` | 🟡 À mettre à jour |

→ Action : corriger via la source unique `legal-entity.ts` / `config.py` + appliquer `LEGAL.name` partout.

### Cadre légal du rôle Hunter cross-produit

Le rôle **Hunter** (apporteur de mandat) est ouvert à **tout utilisateur Althy**, pas uniquement aux pros (cf [`1-VISION.md`](./1-VISION.md#15-les-3-acteurs-pros-de-lécosystème) §1.5 et [`2-ROADMAP.md`](./2-ROADMAP.md#26-phase-3--marketplace-3-acteurs) §2.6). Activation Phase 3 sur location, Phase 4 sur vente. Slogan : *« Finance ton réseau »*. Champs `hunter_id` + `hunter_commission_rate` sur `Bien`, split commission à la conclusion via Stripe Connect.

Le rôle pose plusieurs questions juridiques à clarifier avec un avocat spécialisé droit immobilier CH **avant le lancement Phase 3** :

1. **Qualification d'apport d'affaires immobilier** — Un Hunter non-pro qui apporte un mandat de location/vente exerce-t-il une activité réglementée ? Distinction avec courtage (CO art. 412+) et gérance professionnelle (autorisations cantonales).
2. **Réglementation cantonale** — Plusieurs cantons (VD, GE, NE, FR, VS) imposent des autorisations spécifiques pour activité immobilière professionnelle. Quel seuil de transactions au-delà duquel l'activité Hunter devient « professionnelle » ?
3. **Statut fiscal du Hunter** — La commission Hunter (versée via Stripe Connect) est-elle un revenu accessoire (impôt sur le revenu) ou une activité indépendante (cotisations AVS dès CHF 2 300/an) ? Obligations déclaratives Althy plateforme ?
4. **LCD art. 3 — obligations d'information** — Quelle information obligatoire envers le proprio quand un Hunter présente un mandat ? Conflit d'intérêts si Hunter = locataire candidat ou acheteur potentiel ?
5. **Obligations Althy plateforme** — Responsabilité de la plateforme en cas de mandat illégal apporté par un Hunter (vérification IDE, lutte anti-blanchiment LBA art. 2 et 3, vérification identité du Hunter) ?
6. **Cadre du split commission** — Le champ `hunter_commission_rate` doit-il être plafonné par la loi (taux usuriers, équité contractuelle CO art. 21) ?

→ Action : consultation avocat spécialisé droit immobilier CH (~CHF 1 500 — cf TODO Killian Phase 3 ci-dessous).

### TODO Killian (échéances Phase 1)

- [ ] **Consultation avocat** (2h, ~CHF 750) — répondre aux 26 questions archivées.
- [ ] **Patcher les 3 « Althy SA »** hardcodés backend (avant 1er client externe).
- [ ] **Créer le registre des activités de traitement** (art. 12 nLPD) — peut être fait avec template fourni par l'avocat.
- [ ] **Audit sécurité** avant 1er client agence externe (~CHF 2 000 — pentest léger).
- [ ] **Validation slogans** landing avec avocat.
- [ ] **Marque déposée EUIPO** Phase 2 (~CHF 1 100).
- [ ] **AIPD module IA** Phase 2 (~CHF 3 000 - 5 000).
- [ ] **Avis FINMA formel** sur 3 % commission loyers Phase 2 (~CHF 1 500 - 3 000).
- [ ] **Statut RC + IDE Althy Sàrl** si constitution future.
- [ ] **Validation cadre légal Hunter cross-produit** (Phase 3, ~CHF 1 500 — avocat spécialisé droit immobilier CH) — répondre aux 6 questions de la sous-section « Cadre légal du rôle Hunter cross-produit » ci-dessus.
- [ ] **Audit anonymisation DBs propriétaires** (Phase 2, ~CHF 1 500 — avocat nLPD + test technique de ré-identification) — valider que k-anonymity ≥ 5 est effectivement atteint avant exploitation commerciale (notamment indice Althy des loyers romands Phase 5+).

### Coût juridique total estimé Phase 1 → Phase 5+

- Phase 1 : ~CHF 1 000 (consultation + patches code).
- Phase 2 : ~CHF 9 500 - 13 500 (AIPD module IA + FINMA + EUIPO + audit sécurité + audit anonymisation DBs propriétaires).
- Phase 3 : ~CHF 1 500 (validation cadre Hunter cross-produit).
- Phase 5+ : ~CHF 5 000 par pays additionnel (DACH) + ~CHF 3 000 cadre commercial revente données API B2B.

---

## Annexes

- [1-VISION.md](./1-VISION.md) — Vision macro Althy
- [2-ROADMAP.md](./2-ROADMAP.md) — Phases produit + sprints
- [3-ARCHITECTURE.md](./3-ARCHITECTURE.md) — Stack technique + sécurité
- [4-PRODUIT.md](./4-PRODUIT.md) — Spec fonctionnelle
- [5-FINANCES.md](./5-FINANCES.md) — Modèle économique
- [7-CATALOGUE-DONNEES-ALTHY.md](./7-CATALOGUE-DONNEES-ALTHY.md) — Catalogue données granulaire (sources, anonymisation, ownership)
- [archive/legal/dossier-avocat-audit-juridique-2026-04-19.md](./archive/legal/dossier-avocat-audit-juridique-2026-04-19.md) — 26 questions avocat (référence)
- `frontend/src/lib/legal-entity.ts` — source unique entité légale frontend
- `backend/app/core/config.py` — `ALTHY_CREDITOR_NAME` / `ALTHY_CREDITOR_IDE`
- `frontend/src/legal/CH/` — contenus légaux suisses (CGU, confidentialité, cookies, disclaimer-ia)
