# SPRINT A11.A.6.d — Enrichissement UX & data complémentaire fiche bien

> Sprint 12 / PR-A11.A.6.d
> Branche : `feat/bien-enrichissement-uxd` → `main`
> Statut : ✅ Livré le 2026-05-04

---

## 1. Périmètre livré (résumé en 6 lignes)

1. **Charges incluses au bail** : 13 booléens sur `Bien` (4 familles : chauffage/eau, conciergerie, immeuble, taxes) — toggles tab Conditions location.
2. **Sécurité opérationnelle structurée** : table 1:N `BienKey` (entrée, cave, BAL, parking, garage, cadenas, autre) + `code_digicode` chiffré at-rest sur `Bien`.
3. **Helper crypto générique** : `app/core/crypto.py` factorise le pattern Fernet pré-existant de `partner_service.py` — réutilisable pour futurs champs sensibles (IBAN sprint 13).
4. **`keys_count` recalculé service-side** : conservé sur `Bien` pour affichage rapide, mais source de vérité = `count(BienKey where is_active)`.
5. **Naming review grand-père friendly** : composant `<FieldLabel>` (libellé simple + tooltip technique au hover) appliqué à 16 champs (EGID/EWID/PPE/OFS/DPE/caution/charges/etc.).
6. **Migration de données** : pour chaque bien legacy `keys_count > 0`, création automatique d'1 `BienKey` type='entree' avec description « auto-créée depuis legacy keys_count ».

---

## 2. Migration appliquée

**`alembic/versions/0037_bien_charges_keys.py`** (revision `0037`, parent `0036`).

Upgrade :
1. 13 colonnes booléennes `charges_*` sur `biens` (NOT NULL, default `false`).
2. Colonne `code_digicode_encrypted` (Text, nullable) sur `biens`.
3. Table `bien_keys` (id, bien_id, type, numero_badge, description, created_at, updated_at, is_active) + 2 index `(bien_id)` + `(bien_id, type)`.
4. Data migration : `INSERT INTO bien_keys` 1 ligne `type='entree'` par bien legacy `keys_count > 0`.

Downgrade : symétrique propre (drop indexes + table + 14 colonnes).

---

## 3. Modèles SQLAlchemy ajoutés

| Modèle | Fichier | Pattern |
|---|---|---|
| `BienKey` | `backend/app/models/bien_key.py` | Aligné `BienAnnexe`/`BienContact`/`BienCompteur` (BaseModel + ForeignKey CASCADE + 2 indexes) |
| Extension `Bien` | `backend/app/models/bien.py` | +13 booléens `charges_*` + `code_digicode_encrypted` (Text) + relation `keys` (lazy=selectin, cascade delete-orphan) |

Export : `app/models/__init__.py` (`BienKey` ajouté).

---

## 4. Schemas Pydantic + endpoints + hooks

### Schemas (`backend/app/schemas/bien.py`)
- `BienBase` étendu : 13 booléens `charges_*` (default `False`) + `code_digicode: str | None` (clair côté API).
- `BienUpdate` : mêmes champs en `bool | None` / `str | None`.
- `BienKeyRead` / `BienKeyCreate` / `BienKeyUpdate` (pattern aligné BienAnnexe).
- `BienDetail.keys: list[BienKeyRead]` ajouté.

### Service (`backend/app/services/bien_key_service.py`)
- 4 méthodes CRUD + `_recompute_keys_count()` appelé à chaque create / delete.
- Re-utilise `BienService._get_or_404` + `_can_write` pour cohérence ACL.

### Service Bien étendu (`backend/app/services/bien_service.py`)
- `create()` : `code_digicode` clair → `encrypt_field()` → `code_digicode_encrypted`.
- `update()` : idem ; `code_digicode` exclu du snapshot audit (nLPD).
- `get_detail()` : déchiffre `code_digicode_encrypted` → expose `code_digicode` clair (1 bien à la fois) + injecte la liste `keys`.
- Liste paginée : ne déchiffre PAS (sécurité — info non exposée en bulk).

### Helper crypto (`backend/app/core/crypto.py`)
- `encrypt_field()` / `decrypt_field()` génériques.
- Dérivation `SECRET_KEY → SHA256 → base64 urlsafe → Fernet` (identique à `partner_service.encrypt_api_key`).
- Aucune nouvelle dépendance pip (`cryptography` déjà importable).

### Router (`backend/app/routers/bien_keys.py`)
- `GET    /api/v1/biens/{bien_id}/keys`
- `POST   /api/v1/biens/{bien_id}/keys`
- `PATCH  /api/v1/biens/{bien_id}/keys/{key_id}`
- `DELETE /api/v1/biens/{bien_id}/keys/{key_id}`

Enregistré dans `app/main.py` après `bien_compteurs_router`.

### Hooks frontend (`frontend/src/lib/hooks/useBienKeys.ts`)
- `useBienKeys`, `useCreateBienKey`, `useUpdateBienKey`, `useDeleteBienKey`.
- Pattern aligné `useBienAnnexes` (cancelQueries → snapshot → optimistic → rollback → invalidate).
- Invalide `["biens", bienId]` à chaque mutation pour rafraîchir `keys_count`.

---

## 5. Composant `FieldLabel` ajouté

Fichier : `frontend/src/components/biens/FieldLabel.tsx`.

Pattern réutilisable « libellé court + tooltip explicatif au hover » :
- Si `tooltip` absent → simple span uppercase (équivalent au `<label>` legacy).
- Si `tooltip` présent → ajoute icône `Info` 12px + tooltip CSS-only au hover/focus.
- Tooltip : Bleu de Prusse, max-width 280px, fade 140ms, `pointer-events: none`.

CSS hover : `globals.css` — sélecteurs `.althy-field-label__icon:hover .althy-field-label__tooltip`.

Intégré dans `Field` / `SelectField` / `TextareaField` / `ToggleRow` via prop optionnelle `tooltip?: string`.

---

## 6. Mapping libellés appliqués

### Champs renommés dans CaracteristiquesModal

| Champ DB | Avant | Après | Tooltip activé |
|---|---|---|---|
| `egid` | EGID (n° fédéral bâtiment) | Identifiant du bâtiment | ✅ RegBL OFS |
| `ewid` | EWID (n° fédéral logement) | Identifiant du logement | ✅ RegBL OFS |
| `numero_parcelle` | N° parcelle cadastrale | N° de parcelle (cadastre) | ✅ Cadastre cantonal |
| `numero_lot_ppe` | N° lot PPE | N° de lot copropriété | ✅ PPE Propriété Par Étages |
| `commune_ofs` | N° OFS commune | N° de commune (officiel) | ✅ OFS |
| `classe_energetique` | Classe énergétique (DPE) | Étiquette énergie | ✅ DPE/CECB A→G |
| `acompte_charges` | Acompte charges (CHF) | Provision charges mensuelle (CHF) | ✅ régularisation annuelle |
| `deposit` | Montant caution (CHF) | Garantie de loyer (CHF) | ✅ max 3 mois CO 257e |
| `caution_type` | Type de caution | Type de garantie | ✅ espèces / bancaire / cautionnement |
| `valeur_locative_fiscale` | Valeur locative fiscale (CHF) | Valeur locative (impôts) | ✅ admin fiscale cantonale |
| `valeur_assurance_ecab` | Valeur ECAB / assurance bâtiment (CHF) | Valeur assurance bâtiment (ECAB) | ✅ Établissement Cantonal Assurance Bâtiments |
| `disponibilite_date` | Disponibilité | Disponible à partir du | ✅ |
| `duree_minimale_mois` | Durée minimale (mois) | Durée minimale du bail (mois) | ✅ souvent 12 mois CH |
| `preavis_mois` | Préavis (mois) | Préavis de résiliation (mois) | ✅ souvent 3 mois |
| `surface` | Surface habitable (m²) | (inchangé) | ✅ exclut caves/balcons |
| `rooms` | Pièces | Nombre de pièces | ✅ cuisine = 0.5 pièce |
| `code_digicode` | (nouveau) | Code digicode immeuble | ✅ chiffré at-rest |

13 toggles de la section « Charges incluses » : tooltip systématique sur chaque (chauffage / eau chaude / chaudière / compteurs / conciergerie / nettoyage / produits / ascenseur / éclairage / espaces verts / déneigement / égouts / ordures / TV).

### Champs catalogue NON renommés (déjà clairs)
`adresse`, `ville`, `cp`, `canton`, `building_name`, `unit_number`, `reference_number`, `etage`, `bedrooms`, `bathrooms`, équipements booléens (`is_furnished`, `has_balcony`, etc.), distances, descriptions.

---

## 7. Backlog identifié

### Compléments data model encore en attente (sprints A11.A.6.e+)
- `BienAnnexe` : `etage`, `mode_parcage`, `notes` (catalogue 7-CATALOGUE l. 386-390 ➕).
- `BienContact` : `user_id` (lien user Althy si existant), `start_date`, `end_date` (catalogue l. 420, 426-427).
- `BienCompteur` : `releve_entree`, `releve_sortie` distincts du seul `releve_initial` (catalogue l. 408-409).
- `Bien` : `prix_acquisition`, `date_acquisition`, `taux_hypothecaire`, `hypotheque_montant` (reportés depuis 6.a, voir `TabFiscalite`).

### Cohérence docs (à mettre à jour)
- **`docs/7-CATALOGUE-DONNEES-ALTHY.md` l. 392-401** : refléter la structure `BienKey` table 1:N (vs scalaires `keys_description` / `numero_badge` actuels). `code_digicode` reste scalaire mais doit être marqué `code_digicode_encrypted` côté DB.
- **`docs/7-CATALOGUE-DONNEES-ALTHY.md`** : ajouter section « Charges incluses au bail » sur `Bien` (13 booléens), distincte de la sous-section `ChargeLine` (sprint 13-14).
- **`docs/3-ARCHITECTURE.md` §3.5 Sécurité** : documenter le helper `app.core.crypto` comme primitive officielle pour les champs sensibles (et noter que `partner_service.encrypt_api_key` peut migrer plus tard vers ces helpers — backlog non bloquant).

### Migration `partner_service.py` vers `app.core.crypto`
- Hors scope A11.A.6.d. Le pattern Fernet historique est préservé tel quel.
- Quand fait : 3 lignes à supprimer dans `partner_service.py` + import depuis `app.core.crypto`.

---

## 8. Conformité docs (récap final CH0)

Sprint déclenché par feedback Killian post-livraison A11.A.6.c. CH0 conformité docs validé avant code (cf chat session).

| Élément A11.A.6.d | Doc canonique | État final |
|---|---|---|
| 13 booléens `charges_*` (clauses bail) | `7-CATALOGUE` l. 709-721 (sémantique `ChargeLine.included_in_rent`) | 🟡 Innovation : cohabitation justifiée — déclaratif vs comptable. Backlog cohérence docs ouvert. |
| Table `BienKey` 1:N (vs scalaires catalogue) | `7-CATALOGUE` l. 392-401 | 🟡 Innovation : pattern aligné BienAnnexe/Contact/Compteur. Backlog cohérence docs ouvert. |
| `code_digicode` chiffré at-rest | `7-CATALOGUE` l. 399 + `6-LEGAL` §6.2 nLPD | ✅ Aligné — donnée sensible chiffrée. |
| `keys_count` conservé, recalculé | `7-CATALOGUE` l. 396 | ✅ Sémantique préservée, source de vérité = `bien_keys`. |
| Composant `FieldLabel` (libellé + tooltip) | `4-PRODUIT` §4.2 + `3-ARCHITECTURE` §3.6 | ✅ Aligné DA scientifique + cible UX double grand-père / Bernard Nicod. Nouvelle primitive UI documentée. |
| BienKey inline tab Identité (pas side panel) | `3-ARCHITECTURE` §3.12 (3 patterns modale) | ✅ Aligné — sub-entité simple → inline fullscreen. |
| Helper `app.core.crypto` factorisant Fernet | `partner_service.py` l. 32-65 + `6-LEGAL` §6.2 | ✅ Pattern existant réutilisé sans nouvelle dépendance. |

---

## 9. Liens docs de référence

- [`docs/4-PRODUIT.md`](../4-PRODUIT.md) §4.6 (Module Bien) + §4.8 (Module Finances — ChargeLine reportées sprints 13-14)
- [`docs/3-ARCHITECTURE.md`](../3-ARCHITECTURE.md) §3.6 (DA scientifique) + §3.12 (3 patterns modale + conventions code)
- [`docs/6-LEGAL.md`](../6-LEGAL.md) §6.2 (nLPD — chiffrement comme mesure de sécurité)
- [`docs/7-CATALOGUE-DONNEES-ALTHY.md`](../7-CATALOGUE-DONNEES-ALTHY.md) Sous-section Sécurité opérationnelle (l. 392-401) + Sous-section Charges détaillées (l. 709-721)
- [`docs/session12/SPRINT-A11A6c-ui-refonte.md`](./SPRINT-A11A6c-ui-refonte.md) (sprint précédent, refonte modale)
- [`docs/session12/SPRINT-bien-complet.md`](./SPRINT-bien-complet.md) (sprint en cours)
