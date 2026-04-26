# Sprint — Bien complet

> Session 12 · Ouverture 2026-04-26 · branche `main`
> Sprint précédent : Session 11 (clôture bug P0 pagination + audit log Decimal)
> Sprint suivant : à définir
> Doc adjacent : `docs/session11/HANDOFF-cloture-bug-P0-pagination.md`

---

## Résumé exécutif

Transformer « 1 bien créable via UI » (acquis session 11, étape 10 roadmap) en « 1 bien complet pilotable » : toutes les données métier accessibles à la saisie, modifiables après création, archivables, et prêtes pour exploitation par une IA agentique future.

Le sprint couvre 5 étapes macro (audit, fix bug 500 P1, refonte formulaire, refonte fiche détail, modification/suppression). Chaque étape est validée par checkpoint Killian + smoke test runtime + bilan court dans `docs/session12/etape-N-bilan.md`.

Pas d'enchaînement automatique d'étape à étape. Pas de bundling de scopes : un sprint = un thème (le bien), un fichier de sortie par étape.

---

## Principe directeur permanent — « 1 clic »

**Définition** : vulgariser l'immobilier sans amputer la profondeur pro. Surcouche tech au-dessus, architecture clean en dessous, même invisible à l'utilisateur.

**Triple test obligatoire** pour toute décision de design (UI, schéma, endpoint, naming) prise pendant ce sprint :

- ✅ **Simple pour l'utilisateur** — 1 clic pour les actions courantes, vocabulaire clair (« loyer mensuel » pas « rent_amount_monthly »), pas de jargon brutal, pas de friction inutile (un grand-père doit comprendre).
- ✅ **Complet pour le pro** — aucun champ métier sacrifié, aucun écran amputé sous prétexte de simplicité. On n'est pas un toy product. Les régies suisses qui regardent Althy doivent y voir tout ce qu'elles ont dans leur logiciel actuel, plus l'intelligence en plus.
- ✅ **Lisible pour une IA agent future** — structure sémantique forte (champs nommés explicitement, enums plutôt que strings libres), events traçables (audit log à jour), état du bien introspectable depuis n'importe quel point du code (pas de state caché en mémoire React, tout dans la DB ou dans un cache `react-query` réhydratable).

**Application** : avant tout merge d'étape, valider que la livraison passe les 3 critères. Si un seul tombe, retour table de dessin.

---

## Plan macro 5 étapes

### Étape 1 — Audit cohérence front ↔ back sur le bien

**Résumé** : lister exhaustivement tous les champs du modèle SQLAlchemy `Bien`, du schéma Pydantic, du formulaire de création frontend, et de la fiche détail frontend. Produire un tableau comparatif 4 colonnes + colonne « gap ». Prioriser les manques avec Killian avant tout fix.

Inclure dans l'audit le diagnostic du bug 500 `GET /biens/{id}/changement/actif` (cible étape 2) — au moins identifier si la table `changements_locataire` est censée exister (migration manquante) ou si l'endpoint est obsolète.

**Critères de sortie** :
- Tableau comparatif livré dans `docs/session12/etape-1-audit-cohérence.md`.
- Priorisation gaps validée par Killian (P1 / P2 / P3).
- Cause racine du bug 500 `/changement/actif` identifiée (migration vs rename vs endpoint à supprimer).

**Out of scope** :
- Aucune modification de code en étape 1. Audit pur, lecture seule.
- Pas de patch même « trivial » détecté pendant l'audit (on note, on traitera en étape dédiée).

---

### Étape 2 — Fix `/changement/actif` (bug 500 P1)

**Résumé** : investiguer pourquoi `asyncpg.UndefinedTableError: relation "changements_locataire" does not exist`. Trois hypothèses à départager : (a) migration manquante en prod, (b) table renommée à un moment et endpoint pas mis à jour, (c) endpoint mort à supprimer. Décision selon ce que l'audit étape 1 a révélé.

Si migration manquante → écrire migration alembic, valider en staging, déployer prod selon procédure session 8 (fichier `etape-20-1-B-staging.md` comme référence).

**Critères de sortie** :
- 200 OK sur `GET /biens/{id}/changement/actif` en prod (réponse `null` si pas de changement actif, objet sinon).
- Navigation onglet « Changement » sur fiche bien fonctionnelle (pas d'écran rouge React error boundary).
- Migration alembic taggée et appliquée si la cause était une migration manquante.

**Out of scope** :
- Refonte complète du flow changement de locataire (UX check-in / check-out / EDL). On fait fonctionner l'endpoint, on ne réécrit pas le module.

---

### Étape 3 — Refonte formulaire création bien

**Résumé** : tous les champs métier backend disponibles à la saisie, organisés en sections logiques (identité bien / surface & pièces / financier / état actuel), avec sections optionnelles repliables (collapsible). Champs obligatoires marqués étoile rouge avec helper text. Statut du bien explicite (pas un dropdown caché en bas). Validation Zod côté front avec bornes raisonnables (loyer 0-50 000 CHF, surface 5-2000 m², étage -3 à +50, etc.).

Couverture 100% des champs `BienCreate` (Pydantic) côté UI.

**Critères de sortie** :
- Formulaire couvre 100% des champs métier backend (cf audit étape 1).
- Validation côté front avant submit (pas de 422 backend pour erreur de format trivial).
- UX validée par Killian (test création bien complet en condition réelle).
- Triple test « 1 clic » passé : simple (sections claires, helper text), complet (tous les champs), IA-ready (champs nommés FR explicite, enums au lieu de strings libres pour `type`, `statut`).

**Out of scope** :
- Photos / galerie (gestion `BienImage`) — étape 4 ou sprint dédié.
- Documents attachés (`BienDocument`) — étape 4 ou sprint dédié.
- Catalogue équipements — déjà existe (`useBienEquipements`), pas de refonte ici.

---

### Étape 4 — Refonte fiche bien (cœur du mot d'ordre « 1 clic »)

**Résumé** : édition inline des champs principaux (loyer, statut, locataire actif, charges) directement depuis la fiche, sans modal pour modifier un champ unique. Actions critiques (modifier loyer, changer locataire, générer quittance, archiver, exporter) atteignables 1 clic depuis la fiche. Onglets fonctionnels et cohérents (pas d'onglet vide, pas d'onglet qui crash).

**Critères de sortie** :
- Aucune action critique ne nécessite plus de 2 clics depuis la fiche bien (tap rule).
- Triple test « 1 clic » passé sur chaque action exposée.
- Onglets « Vue d'ensemble », « Locataire », « Finances », « Documents », « Interventions », « Historique », « Changement », « Potentiel » tous fonctionnels (200 OK + UX cohérente).
- Édition inline avec optimistic update + invalidation cache `react-query` (pattern `useUpdateBien` déjà en place dans `useBiens.ts:271`).

**Out of scope** :
- Intégration IA agent (action déclenchée par Sphere) — sprint future.
- Onglet « Vente » (flag-gated `FEATURE_VENTE` = false en prod).

---

### Étape 5 — Modification / suppression bien

**Résumé** : `PATCH /biens/{id}` fonctionne pour tous les champs autorisés (vérifier `BienUpdate` Pydantic). Soft delete / archivage (pas de hard delete pour préserver l'audit trail légal nLPD). Bouton archivage 1 clic depuis fiche, avec écran de confirmation (action irréversible-ish).

**Critères de sortie** :
- Modifier un bien existant marche end-to-end depuis la fiche détail (édition inline étape 4 invalide le cache, le PATCH backend persiste, le bien est mis à jour).
- Archivage marche : bien archivé n'apparaît plus dans la liste active mais reste consultable via filtre « archivés » ou route dédiée.
- Audit log capture la modification (champ `audit_log.action = "update"` ou `"archive"`, `old_values` / `new_values` populés grâce au serializer session 11).
- Triple test « 1 clic » passé : simple (1 bouton archiver), complet (audit conservé), IA-ready (état archivé introspectable via `is_active = false` ou champ dédié).

**Out of scope** :
- Restauration d'un bien archivé (sprint future si demande utilisateur).
- Suppression définitive (RGPD droit à l'oubli) — endpoint dédié hors scope sprint, à traiter dans un sprint « conformité ».

---

## Validation par étape

Chaque étape se termine par :

1. **Checkpoint Killian** — review du diff (pour les étapes code) ou du livrable doc (pour étape 1).
2. **Smoke test runtime obligatoire** — au minimum :
   - Étape 1 : N/A (audit pur).
   - Étape 2-5 : test manuel sur preview Vercel + Railway PR env avant merge prod.
3. **Bilan dans `docs/session12/etape-N-bilan.md`** — court (2 paragraphes max) : ce qui a été livré, ce qui reste éventuellement en backlog, lien commit/PR.

Pas d'enchaînement automatique d'étape à étape. Killian valide la fin d'une étape avant qu'on attaque la suivante.

---

## Backlog hors sprint 12

Bugs résiduels P2 / P3 reportés depuis session 11, à traiter dans un sprint dette technique dédié :

- 🟡 P2 — Hydration mismatch React #422 #425 (warning console DevTools, non bloquant runtime).
- 🟢 P3 — CI/CD GitHub Actions cassé (secrets Supabase manquants en repo settings).
- 🟢 P3 — 14 erreurs Integrity Check pré-existantes (TS strict mode partiel).
- 🟢 P3 — 536 erreurs `ruff` backend (441 auto-fixables, à passer en un commit dédié).
- 📝 Doc session 10 manquante — extraction depuis `SPRINT_LOG.md` (« Sprint — Fusion properties → biens ») vers `docs/session10/HANDOFF-...md` rétroactif si on veut une chaîne docs cohérente. Non bloquant.
- 📚 **Sprint « Cohérence doc »** (post-sprint 12, avant sprint 13) — aligner tous les fichiers de doc sur la réalité produit avril 2026. Contradictions identifiées à investiguer :
  * **DA produit** : business plan PDF mentionne palette terre cuite `#B55A30` + stone `#FAFAF8`. Killian indique nouvelle DA bleu (Bleu de Prusse `#0F2E4C` + Or `#C9A961`, migration v8 datée 2026-04-20 dans `CLAUDE.md`). À vérifier puis documenter source de vérité unique.
  * **Nom société** : « Althy SA » en backend (`config.py`, `qr_facture.py`, `quittance.py`) vs « Althy Sàrl » en frontend (CGU, mentions légales). Réalité actuelle : « Killian Thébaud — Althy » (raison individuelle, Sàrl en cours) selon `lib/legal-entity.ts`. Risque LCD identifié dans `docs/dossier-avocat-audit-juridique.md`.
  * **Nombre tables DB** : 13 (`README.md`) vs 18 (business plan) vs 20 migrations actives (`CLAUDE.md` Section I, 004 → 0037). À vérifier.
  * **Phases produit** : numérotation divergente entre `ROADMAP.md` (Phase 0-5+), `docs/plan-communication-roles-phase1.md` (Phase 1-3) et business plan PDF.
  * **APP_NAME** : `CATHY` dans `.env.example` vs Althy partout ailleurs.
  * **Décisions cadrage 26/04/2026** (pas Stripe Connect loyers, pas PPE Phase 1, ordre sprints 13 → 14 → 15) à propager dans business plan et autres docs si besoin.

  Méthode : audit contradictions, source de vérité unique par sujet, cleanup chirurgical. PAS de suppression aveugle de fichiers (chacun a un rôle distinct). Livrables proposés : `docs/coherence-doc/AUDIT-contradictions-YYYY-MM-DD.md` + `docs/coherence-doc/SOURCES-DE-VERITE.md` + patches ciblés sur les fichiers désynchronisés.

---

## Roadmap macro post-sprint 12

Décisions cadrage prises le 26/04/2026 :

- Phase 1 = location pure. Tout le reste est repoussé.
- Pas de Stripe Connect 4% loyers. Paiement QR code suisse direct (SPC 2.0). Stripe garde les abonnements (CHF 29) uniquement.
- Pas de PPE / copropriété en Phase 1.
- Pas d'opener / artisan / hunter / expert en Phase 1.
- Modules ci-dessus restent dans la vision Althy long terme, mais ne sont pas roadmappés tant que la location pure n'est pas excellente.

Ordre des sprints macro :

### Sprint 12 (en cours) — Bien complet

Fondation. Le bien existe propre, modifiable, archivable, cohérent front ↔ back. C'est la base de tout.

### Sprint 13 — Documents par bien

- Templates baux par canton (commencer par VD/GE/VS, étendre)
- Quittances et attestations auto-générées
- État des lieux entrée/sortie
- OCR pour pré-remplissage depuis scans
- Signature électronique distancielle (e-signature CH conforme)
- Archivage par bien, accès propriétaire et locataire

### Sprint 14 — Comptabilité location

- États locatifs annuels par bien (revenus / charges / travaux)
- Déclaration fiscale IFD assistée (revenus nets par bien)
- Rapprochement bancaire (CAMT.054 → loyers attendus vs reçus)
- Export fiduciaire (format plan comptable suisse standard)
- OCR factures + affectation IA proprio/locataire (OBLF)
- Pas de PPE Phase 1.

### Sprint 15 — Paiements loyers via QR code

- Génération QR-facture SPC 2.0 par loyer
- Réconciliation automatique loyer reçu → quittance auto
- Dashboard « économies vs régie classique » pour le proprio
- Relances automatiques loyers en retard
- Stripe = abonnements CHF 29/mois uniquement, jamais loyers

### Backlog vision (post-Phase 1, non roadmappé)

Modules Althy à terme, mentionnés ici pour ne pas les oublier :

- Module openers (visites, EDL, check-in)
- Module artisans (devis comparés, missions)
- Module experts (géomètres, archi, photographes)
- Module hunters (réseau off-market)
- PPE / copropriété
- Compta avancée multi-comptes
- Channel manager Airbnb / Booking (court séjour)
- Syndication portails (Homegate / Immoscout)
- Module vente (estimation IA + Hunters vente)
- Acheteur premium

Ces modules font partie de la vision Althy validée par le business plan. Ils ne sont PAS abandonnés. Ils sont reportés post-Phase 1 pour éviter la dispersion. Phase 1 = location pure excellente avant d'élargir.

---

## Critères de sortie sprint 12

Le sprint 12 est clos quand :

1. Les 5 étapes ci-dessus sont validées (checkpoint Killian + smoke test).
2. Création / lecture / modification / archivage d'un bien fonctionnent end-to-end via UI sans assistance technique.
3. Triple test « 1 clic » passé sur le flow complet (création → consultation → modification → archivage).
4. Bug 500 `/changement/actif` éliminé (étape 2).
5. Aucune régression sur les fonctionnalités existantes (dashboard, marketplace, fiche bien).
6. Bilan global sprint 12 rédigé dans `docs/session12/BILAN-sprint-bien-complet.md` à la clôture.
