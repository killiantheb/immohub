# HANDOFF Claude Code — 29/04/2026

> Audit exhaustif post-Sprint 12 : bugs connus + correctifs esthétiques + rattrapages des 6 docs vivants.
> Source pour la session du 30/04/2026 (PR-A11 polish + rattrapages).

---

## 🔴 BUGS CONNUS (encore en prod ou rapportés en cours de Sprint 12)

| # | Bug | Localisation | Statut | Priorité |
|---|---|---|---|---|
| **B-01** | Estim IA tombe en fallback `confidence_score=2.0` (cause exacte inconnue) | `bien_service.py:get_potentiel_ia_v2` | Logging ajouté PR-A9.3, à analyser dans logs Railway | **P0** |
| **B-02** | "Althy SA" hardcodé backend (3 occurrences) | `config.py:104`, `qr_facture.py:207`, `quittance.py:103` | Documenté `6-LEGAL.md` §6.14, jamais corrigé | **P0** (LCD risque) |
| **B-03** | Boutons décoratifs sans `onClick` | `_shared.tsx:268` "Proposer renouvellement" + `_shared.tsx:391` "Générer document IA" | Documenté audit PR-A4 §6, contournés en `<Link>` mais l'expérience reste pauvre | P1 |
| **B-04** | Pas de pré-ciblage locataire dans "Contacter" | `page.tsx` Card Locataire actif | Pointe vers `/app/communication?tab=messages&bien_id=X` mais pas `?contact=locataire_id` | P1 (Phase 2) |
| **B-05** | "Voir candidatures" / "Recevoir candidatures" pointent vers `/app/candidatures?bien_id=X` mais le **module global ne lit pas `bien_id` natif** | `candidatures/page.tsx` | Banner contextuel affiché, mais liste complète non filtrée | P1 |
| **B-06** | DELETE intervention `actif` peut empêcher la suppression bien (si user a oublié de fermer) | `bien_service.py:delete_with_checks` | UX : pas de raccourci pour aller fermer l'intervention bloquante | P2 |
| **B-07** | `useUpdateBien` envoie `is_furnished: false` quand le toggle n'est jamais cliqué | `page.tsx:SectionInfos` | Form initialise `is_furnished: bien.is_furnished ?? false` → écrit `false` même si null en BD | P1 (potentiellement écrase des données) |
| **B-08** | Estim IA `/potentiel-v2` peut renvoyer 500 si bien sans loyer (Claude prompt avec `null`) | `bien_service.py` | Pas de garde-fou côté entrée | P1 |
| **B-09** | Mini-map Mapbox ne gère pas le cas `lat/lng = 0,0` (bien créé sans géocoding) | `MiniMapBien.tsx` | Affiche un point au milieu de l'océan Atlantique au lieu du placeholder | P2 |
| **B-10** | Card Estim IA gold accent **trop discrète** (bordure 4px gauche) vs autres cards plates | `page.tsx:SectionEstimationIA` | Hiérarchie visuelle pas assez claire | Esthétique |

---

## 🎨 CORRECTIFS ESTHÉTIQUES IDENTIFIÉS (audit visuel post-PR-A10)

### Header bien (CardHeaderBien)

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-01** | Bouton "Supprimer" rouge dans header | Visuel sobre OK mais positionné à côté de "Modifier" — risque clic accidentel sur mobile | Ajouter `marginLeft: auto` ou kebab menu (`...`) déroulant pour les actions secondaires |
| **E-02** | Photo placeholder `MiniMapBien` | Marqueur or sur fond gradient bleu+or = effet « sapin de Noël » sur certains biens | Tester un seul accent (gold OU prussian) plus sobre |
| **E-03** | H1 adresse mobile | Si adresse longue (>40 chars) + badge statut, casse le layout grid `240px 1fr` | Ajouter `min-width: 0` + `text-overflow: ellipsis` sur le titre |
| **E-04** | Métadonnées (type · m² · pièces · étage · loyer) | Sur mobile, wrap inesthétique avec orphelins | `column-gap: 14px; row-gap: 4px` (déjà là) mais ajouter visual separator entre items |

### Grille 7 cards

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-05** | 7e card seule sur 3e ligne (desktop ≥1024px) | Asymétrie visuelle (3 + 3 + 1) | Soit étirer la 7e card sur 3 colonnes (display: contents), soit ajouter une 8e card placeholder, soit accepter |
| **E-06** | Hauteurs cards variables | `align-items: stretch` mais contenu différent → cards Estim IA et Historique plus hautes | Définir `min-height: 280px` uniforme sur toutes les `CARD` |
| **E-07** | Card Documents/Interventions vides | Icône grise + texte → trop neutre vs autres cards remplies | Ajouter une discrète bordure pointillée pour signaler l'état "à remplir" |
| **E-08** | Gap entre cards (16px) | Légèrement serré sur desktop | Passer à 20px ou 24px |

### Card Locataire

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-09** | Avatar = initiales sur fond bleu | Bien mais petit (48px) | Augmenter à 56px + accent or au lieu de bleu pour plus de chaleur |
| **E-10** | "Bien vacant" cas vide | Icône `User` ambre dans cercle ambre = correct | OK, mais ajouter un sous-texte avec le **nombre de candidatures en attente** s'il y en a (incite à cliquer) |

### Card Finances

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-11** | Bloc bleu rendement net | Belle hiérarchie, mais le label "Loyer net annuel après commission" est long | Tronquer en "Loyer net annuel" avec tooltip explicatif |
| **E-12** | Pas de visualisation du rendement | Juste des chiffres | Ajouter une mini sparkline ou jauge de couleur (vert ≥ 4 % / ambre 2-4 % / rouge < 2 %) |

### Card Estimation IA

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-13** | Bordure gauche or 4px | Subtil mais asymétrie ne se justifie qu'ici | Soit retirer la bordure (uniformité), soit la mettre sur les 4 côtés (frame) |
| **E-14** | Icône Sparkles non animée | Card très importante (vision Killian premium) mais visuellement statique | Animation pulse subtile sur la `Sparkles` pour signaler le côté IA |

### Card Caractéristiques (PR-A10)

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-15** | Aperçu = 4 emojis dans badges prussianBg | Joli mais emojis monochromes sur certains OS | Soit Lucide icons (Building, Trees, Car, Flame), soit emojis + fallback |
| **E-16** | DPE coloré | A vert / G rouge OK, mais les classes intermédiaires (D ambre) peu lisibles | Ajouter un mini-badge avec fond coloré (pas juste texte) |
| **E-17** | Bouton "Voir toutes les caractéristiques" | Fait doublon avec lien "Voir détails →" en haut | Garder un seul lien (en haut), retirer le bouton bas |

### Card Historique (timeline)

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-18** | Pastilles or + ligne prussian | Cohérent avec gold accent IA mais pas assez distinctif | Différencier les types d'événements par couleur (création = vert, modif = bleu, suppression = rouge) |
| **E-19** | Lien "Voir anciens locataires →" | Asymétrie cognitive renommée PR-A4, mais reste confuse | Renommer "Voir tout l'historique →" et créer une vraie sous-page audit en Phase 2 |

### Estim IA enrichie (modale potentiel)

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-20** | Disclaimer LSFin permanent en haut | OK pour conformité mais visuel agressif (banner ambre fixe) | Le rendre repliable (toggle "Détails légaux") après 1ère lecture |
| **E-21** | 6 sections expandables | Bonne UX mais `ChevronDown` rotate 200ms peut sembler lent | Réduire à 150ms |
| **E-22** | LocationCard recommandée (étoile or) | Très visible OK | Ajouter une animation discrète au mount pour attirer l'œil |
| **E-23** | Footer méta "Régénérer" | Lien underline en bas | Le rendre plus visible (bouton sobre avec icône `RefreshCw`) |

### Modale Caractéristiques (PR-A10)

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-24** | Equipement absent grisé | Volonté louable de signaler ce qui PEUT être renseigné, mais charge cognitive | Section "Équipements" en 2 sous-sections : **Présents** (en haut, vert) + **Non renseignés** (en bas, gris, repliée) |
| **E-25** | DPE coloré dans Row | Texte coloré simple | Badge avec fond pleine couleur |
| **E-26** | Modale 760px max-width | Confort sur desktop, peut paraître étroit pour les descriptions longues | Augmenter à 840px |

### Sous-pages bien

| # | Élément | Constat | Proposition |
|---|---|---|---|
| **E-27** | Bouton retour (BienBackButton) | Bordure subtle + chevron OK | Hover : transition de la flèche `translateX(-2px)` |
| **E-28** | Banner contextuel modules globaux | Bon mais pas assez visible | Ajouter une légère ombre + animation slide-down au mount |

---

## 📋 RATTRAPAGES DOCS NON FAITS / SAUTÉS

D'après audit croisé des **6 docs vivants** + sessions précédentes, voici ce qui était prévu mais pas livré pendant Sprint 12 :

### Depuis [`docs/3-ARCHITECTURE.md`](../3-ARCHITECTURE.md)

| # | Item | Référence | Statut |
|---|---|---|---|
| **R-01** | Réorganiser route `/{listing_id}` en fin de fichier marketplace.py | §3.13 | ✅ FAIT (PR-A5) |
| **R-02** | `frontend/src/lib/legal-entity.ts` source unique entité | §3.12 | ⚠️ **À VÉRIFIER** : existe-t-il bien ? Hardcodés backend B-02 toujours présents |
| **R-03** | Architecture cible Phase 2-3 (modules globaux filtrés) | §3.11 | 🟡 Préparé via `bien-links.ts` (PR-A4) mais modules globaux ne lisent pas `bien_id` |

### Depuis [`docs/4-PRODUIT.md`](../4-PRODUIT.md)

| # | Item | Référence | Statut |
|---|---|---|---|
| **R-04** | Triple test "1 clic" appliqué partout | §4.2 | 🟡 Card Estim IA = 2 clics (card → page → infos), pourrait être 1 clic |
| **R-05** | Sphère IA briefing matinal | §4.3 | ❌ **JAMAIS LIVRÉ** dans Sprint 12 (hors scope mais mentionné CLAUDE.md) |
| **R-06** | Interventions cas vide pré-ouvre form | §4.10 | ✅ FAIT (PR-A4 P1.7) |
| **R-07** | Module Documents complet (10 types) | §4.9 | ❌ **SPRINT 13** |

### Depuis [`docs/5-FINANCES.md`](../5-FINANCES.md)

| # | Item | Référence | Statut |
|---|---|---|---|
| **R-08** | Commission Althy 3% loyers réconciliés (calcul réel) | §5.2 | ❌ **PAS IMPLÉMENTÉ** : la card Finances affiche "Loyer net après 3%" mais c'est juste `× 0.97` côté frontend, pas une vraie déduction backend |
| **R-09** | Frais dossier locataire CHF 45 (Stripe off-session) | §5.2 | 🟡 Migration 0032 ajoute les colonnes (`owner_fee_*`) mais le **flow Stripe Connect off-session n'a pas été testé** |
| **R-10** | Mode dégradé QR direct = 0% commission | §5.2 | ❌ **PAS IMPLÉMENTÉ** : pas de toggle ou config |

### Depuis [`docs/6-LEGAL.md`](../6-LEGAL.md)

| # | Item | Référence | Statut |
|---|---|---|---|
| **R-11** | "Althy SA" hardcodé backend (3 fichiers) | §6.14 backlog | ❌ **JAMAIS CORRIGÉ** (cf B-02) |
| **R-12** | Disclaimer IA `documents.disclaimer_included` | §6.12 | 🟡 Champ existe en BD mais **jamais set à `true`** dans `quittance.py`/`qr_facture.py` |
| **R-13** | Patrick M. + 2'847 estimations retirés | §6.6 | ✅ FAIT (refonte docs) |
| **R-14** | Slogans Althy validés avocat | §6.6 | ❌ Pas de validation juridique |
| **R-15** | EDL signature électronique CH | §6.7 | ❌ **SPRINT 13** |

### Depuis [`docs/2-ROADMAP.md`](../2-ROADMAP.md) §dette technique

| # | Item | Statut |
|---|---|---|
| **R-16** | 307 redirects FastAPI trailing slash | ❌ Non corrigé |
| **R-17** | Refacto `_shared.tsx` (800 lignes fourre-tout) | ❌ Non fait |
| **R-18** | Audit Unicode latent `ai/documents.py` + `contract_service.py` | ❌ Risque latent (PR-A5 ne couvrait que `quittance` + `qr_facture`) |
| **R-19** | Modules globaux acceptent `?bien_id` natif | ❌ Banner posé PR-A6 mais filtrage backend pas encore (cf B-05) |
| **R-20** | Upload photos UI bien | ❌ Backend prêt, UI absente |

---

## 🎯 RECOMMANDATION DE STRUCTURE POUR DEMAIN

Scinder en **3 PRs séquentielles** sur la même journée pour éviter une PR fourre-tout massive :

### PR-A11.A — HOTFIXES P0/P1 critiques (~2h)

| Inclus | Pourquoi |
|---|---|
| B-02 / R-11 : Patcher 3 hardcodés "Althy SA" backend | LCD risque, doc 6-LEGAL §6.14, dur depuis longtemps |
| B-07 : Fix `is_furnished` qui écrase | Risque perte de données |
| B-08 : Garde-fou Estim IA si bien sans loyer | Évite 500 |
| B-09 : MiniMapBien gère lat/lng = 0,0 | UX visible |
| R-12 : `disclaimer_included = true` dans quittance/qr_facture | Conformité |
| R-18 : Audit Unicode `ai/documents.py` + `contract_service.py` | Préventif |

### PR-A11.B — POLISH ESTHÉTIQUE Sprint 12 (~3h)

Tous les correctifs **E-01 à E-28**. Une seule PR car cohérence visuelle = un seul commit.

Ordre d'implémentation suggéré :
1. Variables CSS communes (gap, min-height, etc.)
2. Header bien (E-01 à E-04)
3. Cards individuelles (E-05 à E-19)
4. Modales (E-20 à E-26)
5. Sous-pages (E-27, E-28)

### PR-A11.C — RATTRAPAGES NON-BLOQUANTS (~2h, optionnel)

| Inclus | Pourquoi |
|---|---|
| R-08 : Backend déduction commission 3% (vraie ligne dans rendement-net) | Cohérence vs frontend qui affiche déjà |
| R-19 : Modules globaux lisent `?bien_id` natif (1 module = `/app/candidatures`) | Phase 2 amorcée |
| R-16 : 307 redirects FastAPI (config slowapi) | Hygiène |
| B-04 : `?contact=locataire_id` dans /app/communication | Phase 2 amorcée |
