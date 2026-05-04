# SPRINT A11.A.6.h — Restructuration cohérente fiche bien

> Sprint 12 / PR-A11.A.6.h
> Branche : `feat/bien-restructuration-coherente` → `main`
> Statut : ✅ Livré le 2026-05-04

---

## 1. Périmètre livré (résumé en 5 lignes)

1. **Restructuration 8 → 5 tabs sémantiques** : Le bien / Surfaces & espaces / Argent & charges / Accès & contacts / Description publique. Politique scroll-zero stricte (extension Règle 8).
2. **Composant `<TabSection>`** — pattern card autonome (background `C.surface2`, border `C.border`, padding 24px, radius 12px, header Fraunces 18px + séparateur subtil + description optionnelle).
3. **Migration 0038 BienKey** — 3 nouveaux champs métier : `code_grave` (refabrication serrurier), `carte_securite` (bool), `numero_carte_securite`.
4. **14 types de clés** (vs 8 en 6.f) : appartement / immeuble / boîte aux lettres / cave_acces / cave_personnelle / buanderie / machine_laver_badge / garage_bippeur / garage_porte / ski_room / ski_room_acces / chaufferie / carte_securite_protegee / autre. Plus tooltip carte sécu via icône `ShieldCheck`.
5. **Code digicode immeuble en clair UI** (chiffrement at-rest préservé via `app/core/crypto.py`).

---

## 2. Migration 0038

`backend/alembic/versions/0038_extension_bien_keys.py` (revision `0038`, parent `0037`) :

```python
op.add_column('bien_keys', sa.Column('code_grave', sa.String(100), nullable=True))
op.add_column('bien_keys', sa.Column('carte_securite', sa.Boolean(), nullable=False, server_default=sa.text('false')))
op.add_column('bien_keys', sa.Column('numero_carte_securite', sa.String(100), nullable=True))
```

Downgrade symétrique. Aucune data migration (les BienKey existants auront `carte_securite = false` par default DB).

---

## 3. Restructuration tabs : 8 → 5 (mapping complet)

### Avant (8 tabs livrés sprint 6.f)
1. Identité
2. Localisation
3. Surface & Annexes
4. Caractéristiques techniques
5. Conditions location
6. Contacts
7. Fiscalité
8. Description publique

### Après (5 tabs sémantiques)

| # | Tab | Cards (sous-sections) | Champs DB |
|---|---|---|---|
| 1 | **Le bien** | Identité du bien · Identifiants suisses officiels · Localisation · Caractéristiques techniques | `building_name` `unit_number` `reference_number` `type` · `egid` `ewid` `numero_parcelle` `numero_lot_ppe` `commune_ofs` · `adresse` `cp` `ville` `canton` `etage` `nb_etages` `orientation_principale` `vue` `bruit_proximite` `accessibilite_pmr` `ascenseur` · `annee_construction` `annee_renovation` `classe_energetique` `type_chauffage` `mode_eau_chaude` `parking_type` + 8 toggles équipements + `pets_allowed` `smoking_allowed` + 5 distances + `situation_notes` |
| 2 | **Surfaces & espaces** | Surfaces & pièces · Annexes du bien | `surface` `rooms` `bedrooms` `bathrooms` `cave_m2` `balcon_m2` `terrasse_m2` `jardin_m2` `terrain_m2` · `<AnnexesSection>` |
| 3 | **Argent & charges** | Loyer & charges · Garantie de loyer · Conditions du bail · Charges incluses · Compteurs · Fiscalité | `loyer` `loyer_charges_exclus` `charges` `acompte_charges` · `deposit` `caution_type` · `disponibilite_date` `duree_minimale_mois` `preavis_mois` `residence_type` `location_type_actuel` · 13 booléens `charges_*` · `<CompteursSection>` · `valeur_locative_fiscale` `valeur_assurance_ecab` |
| 4 | **Accès & contacts** | Clés et badges (PREMIÈRE position du tab) · Contacts du bien | `<KeysSection>` + `code_digicode` (en clair UI) · `<ContactsSection>` |
| 5 | **Description publique** | Description publique · Descriptions internes | `description_publique` `points_forts` · `description_lieu` `description_logement` `remarques` |

→ Aucun champ perdu vs sprint 6.f. Réorganisation pure par cohérence sémantique métier.

---

## 4. Composant `<TabSection>` ajouté

Fichier : `frontend/src/components/biens/TabSection.tsx`.

Pattern card autonome aligné `3-ARCHITECTURE` §3.6 (DA scientifique — hiérarchie visuelle forte) :
- Background `C.surface2` (subtil bleu pâle)
- Border `1px solid C.border`
- Padding `24px`, border-radius `12px`
- Header : titre Fraunces 18px (couleur `C.prussian`) + description DM Sans 13px (`C.text2`) + séparateur `1px solid C.border` margin-bottom 14px
- Espacement entre cards : géré par parent via `tabContentStyle.gap: 32px`

Tokens `C.*` exclusivement, aucun hex direct (conforme §3.12).

---

## 5. Section Clés refondue

### 14 types de clés (frontend select)

Backend : 0 modification (champ `type` est `String(30)` libre, pas un enum Postgres).

Catégorisation visuelle (5 familles couleur badge) :
- **Bleu de Prusse** : appartement (clé du logement)
- **Or Althy** : immeuble (entrée principale, élément valorisant)
- **Brun** : cave_acces / cave_personnelle / buanderie / machine_laver_badge
- **Violet** : garage_bippeur / garage_porte
- **Bleu clair** : ski_room / ski_room_acces
- **Ambre** : chaufferie
- **Rouge** : carte_securite_protegee
- **Gris** : boite_aux_lettres / autre

### 3 nouveaux champs UI (Form Create + Edit)

1. **Code gravé sur la clé** (`code_grave`, str optionnel) — input texte, placeholder « Ex : ABC123 — pour refabrication chez serrurier »
2. **Carte de sécurité fournie** (`carte_securite`, bool) — toggle checkbox, label « Mul-T-Lock / Kaba / Assa »
3. **Numéro de la carte de sécurité** (`numero_carte_securite`, str optionnel) — visible uniquement si toggle = true

### Card mini affichage

- Badge type (couleur selon catégorie)
- N° badge (si présent)
- Code gravé (si présent, italique)
- Description (si présente, `C.text2`)
- Indicateur carte de sécurité (icône `ShieldCheck` Lucide, vert) avec n° au hover/title
- Boutons edit/delete TOUJOURS visibles (`opacity: 1`, fix sprint 6.f)

### Layout grille (politique scroll-zero)

- Desktop ≥1024px : 3 colonnes (`auto-fill, minmax(220px, 1fr)`)
- Tablette : 2 colonnes
- Mobile : 1 colonne
- Au-delà de ~9 clés : `max-height: 540px` + `overflow-y: auto` → scroll DANS la grille (extension Règle 8 : scroll DANS une liste OK, scroll entre catégories KO)

---

## 6. Code digicode en clair (D6)

**Avant (6.d)** : `<Field type="password">` + toggle œil pour révéler.
**Après (6.h)** : `<Field type="text">` — affichage en clair permanent.

**Backend inchangé** : `code_digicode_encrypted` reste chiffré at-rest via `encrypt_field()` / `decrypt_field()` du helper `app/core/crypto.py`. Défense en profondeur préservée contre fuite DB.

Justification métier : un code d'accès immeuble = analogue à un n° d'appartement, pas à un mot de passe au sens nLPD. Le « masqué » du sprint 6.d était une protection contre regards par-dessus l'épaule, pas contre fuite DB.

---

## 7. Décisions arbitraires prises

1. **Politique scroll-zero stricte** : extension Règle 8 (« 1 clic interaction directe » → également « tout à portée d'œil dans une catégorie »). Scroll DANS une liste OK, scroll pour passer d'une catégorie à une autre KO. Documenté dans le recap, à backporter dans `2-ROADMAP.md` §2.10.
2. **Mapping nb_etages dans Localisation** (et pas Caractéristiques techniques) — un nb d'étages immeuble est une info géolocalisée (où dans l'immeuble je suis), pas technique pure.
3. **Distances utiles dans Caractéristiques techniques** (et pas Localisation) — info qualitative sur le bien (« combien de minutes pour la gare »), pas une donnée d'adresse.
4. **« Entrée immeuble » → « Immeuble (entrée principale) »** dans BienKey types — formulation plus claire grand-père friendly.
5. **Catégorie `carte_securite_protegee`** ajoutée comme type de clé distinct de `carte_securite` booléen — un type de clé peut représenter UNE carte de sécurité physique séparée.
6. **`maxHeight: 540px`** pour grille de clés — équivalent ~9 cards (3 lignes × 3 cols) avant scroll, balance lisibilité/compacité.
7. **Préservation TabFiscalite content** sprint 6.f — repris tel quel comme `<TabSection title="Fiscalité">` dans Tab 3. Pas de perte de travail 6.f.

---

## 8. Backlog identifié

- **Vue tableau Clés** quand > 12 éléments (actuellement scroll grille). Toggle « Vue tableau » avec colonnes Type / N° badge / Code gravé / Carte sécu / Description / Actions, tri sur Type, filtre rapide texte.
- **Atouts IA en lecture seule** + bouton « Régénérer avec IA » dans Tab 5 (Phase 2 — sprint dédié sphère IA).
- **Suppression `encrypt_field` du `code_digicode`** si Killian veut full clarté DB (sprint dédié sécurité). Pour l'instant le chiffrement at-rest reste actif (défense en profondeur).
- **Backport `2-ROADMAP.md` §2.10 Règle 8** : préciser « politique scroll-zero stricte » comme extension formelle de la doctrine 1 clic.
- **Cohérence catalogue 7-CATALOGUE l. 392-401** : mettre à jour pour ajouter les 3 champs `BienKey` (`code_grave`, `carte_securite`, `numero_carte_securite`) avec acquisition `👤 USER` Phase 1.
- **Cohérence catalogue 7-CATALOGUE l. 399** : remplacer « masqué + chiffré » par « chiffré at-rest, affiché en clair UI — pas un secret au sens nLPD ».
- **Backport TabFiscalite/TabDescription** : code dupliqué entre 6.f (déprécié) et 6.h (intégré). Cleanup possible mais pas bloquant.
- **Champs Fiscalité reportés** (`prix_acquisition`, `date_acquisition`, `taux_hypothecaire`, `hypotheque_montant`, `valeur_fiscale`, `impot_foncier`, `date_derniers_travaux`, `etat`) — migration future dédiée.

---

## 9. Conformité docs (récap final CH0)

CH0 validé Killian avant code. 4 décisions confirmées :

| Décision | Doc canonique | État final |
|---|---|---|
| **DA1** Politique scroll-zero stricte | Extension `2-ROADMAP` §2.10 Règle 8 | ✅ documentée comme nouvelle convention sprint, backlog backport doc canonique |
| **DA2** Refonte 8 → 5 tabs (post-6.f) | `7-CATALOGUE` Rôle 1 (sous-sections sémantiques, pas tabs figés) | ✅ aligné — pas de gaspillage 6.f, TabFiscalite/TabDescription réutilisés |
| **DA3** Code digicode UI clair | Diverge de `7-CATALOGUE` l. 399 « masqué » | 🟡 chiffré at-rest préservé. Backlog cohérence docs ouvert |
| **DA4** 3 nouveaux champs BienKey hors catalogue | Innovation métier (retour terrain agence) | 🟡 aligné str libre `type` mais champs nouveaux. Backlog cohérence docs ouvert |

| Élément A11.A.6.h | Doc canonique | État |
|---|---|---|
| 5 tabs cohérents | `7-CATALOGUE` Rôle 1 + `4-PRODUIT` §4.6 | ✅ aligné — sous-sections sémantiques |
| Cards par sous-section (`<TabSection>`) | `3-ARCHITECTURE` §3.6 « hiérarchie visuelle forte » + DA scientifique pattern cards | ✅ aligné |
| Tokens `C.*` exclusivement | `3-ARCHITECTURE` §3.12 « jamais d'hex direct » | ✅ tous nouveaux styles via `C.surface2 / border / prussian / gold / etc.` |
| Migration 0038 cohérente | `3-ARCHITECTURE` §3.3 (Modèle de données) | ✅ extension propre `bien_keys` |
| Helper `app/core/crypto.py` préservé | `6-LEGAL` §6.2 nLPD défense en profondeur | ✅ chiffrement at-rest actif |

---

## 10. Liens docs de référence

- [`docs/2-ROADMAP.md`](../2-ROADMAP.md) §2.10 Règle 8 (1 clic interaction directe → étendue scroll-zero ce sprint)
- [`docs/3-ARCHITECTURE.md`](../3-ARCHITECTURE.md) §3.6 (DA scientifique, palette tokens) + §3.12 (3 patterns modale, conventions code)
- [`docs/4-PRODUIT.md`](../4-PRODUIT.md) §4.2 (1 clic + grand-père/Bernard Nicod) + §4.6 (Module Bien)
- [`docs/7-CATALOGUE-DONNEES-ALTHY.md`](../7-CATALOGUE-DONNEES-ALTHY.md) Section UI Fiche bien (l. 137-260) + Sécurité opérationnelle (l. 392-401)
- [`docs/session12/SPRINT-A11A6f-ux-hardening.md`](./SPRINT-A11A6f-ux-hardening.md) (sprint précédent — 8 tabs + RequiredMarker + lisibilité)
- [`docs/session12/SPRINT-A11A6d-enrichissement.md`](./SPRINT-A11A6d-enrichissement.md) (sprint table BienKey + helper crypto)
