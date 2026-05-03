# Sprint A11.A.6.c — Refonte UI fiche bien (édition inline + sub-entités + Settings BankAccount)

> Statut : ✅ Code livré (smoke runtime à exécuter sur preview Vercel après merge)
> Date livraison : 2026-05-03
> Branche : feat/bien-ui-refonte (à merger sur main)

## Périmètre livré

- **Refonte intégrale de `CaracteristiquesModal`** en pattern édition inline « Notion-style » (clic champ → input → blur/Enter → save auto via PATCH `/biens/{id}`). 7 tabs horizontaux. Spinner + checkmark fugace pendant la sauvegarde.
- **3 sections sub-entités inline** (Annexes / Contacts / Compteurs) intégrées dans les tabs Surface, Contacts et Caractéristiques techniques. Pattern cards mini + form inline avec save explicite par sous-form.
- **4 hooks React Query** dédiés : `useBienAnnexes`, `useBienContacts`, `useBienCompteurs`, `useBankAccounts`. Pattern strictement aligné sur `useInterventions.ts`.
- **Section Comptes bancaires** (`/app/settings` tab Bancaire) avec liste cards moyenne, IBAN masqué, badge « Principal » Or, bouton « Définir comme principal ».
- **Renommage bouton header** « Modifier » → « Voir / éditer les caractéristiques » (la modale n'a plus qu'un mode unique = lecture interactive inline).

## Composants ajoutés / refondus

| Fichier | Statut | LoC |
|---|---|---|
| `frontend/src/components/biens/CaracteristiquesModal.tsx` | 🔁 Refondu intégralement | ~1180 |
| `frontend/src/components/biens/AnnexesSection.tsx` | ➕ Nouveau | ~470 |
| `frontend/src/components/biens/ContactsSection.tsx` | ➕ Nouveau | ~520 |
| `frontend/src/components/biens/CompteursSection.tsx` | ➕ Nouveau | ~600 |
| `frontend/src/components/settings/BankAccountsSection.tsx` | ➕ Nouveau | ~620 |

## Hooks ajoutés

| Fichier | Hooks | LoC |
|---|---|---|
| `frontend/src/lib/hooks/useBienAnnexes.ts` | useBienAnnexes, useCreate/Update/Delete | ~155 |
| `frontend/src/lib/hooks/useBienContacts.ts` | useBienContacts, useCreate/Update/Delete | ~160 |
| `frontend/src/lib/hooks/useBienCompteurs.ts` | useBienCompteurs, useCreate/Update/Delete | ~165 |
| `frontend/src/lib/hooks/useBankAccounts.ts` | useBankAccounts, useCreate/Update/Delete (avec cascade `est_principal`) | ~165 |

Pattern strict : `cancelQueries → snapshot → optimistic → return ctx → onError rollback → onSettled invalidate`. La cascade `est_principal=true → bascule des autres comptes à false` est répliquée optimistique côté frontend pour cohérence visuelle immédiate.

## Pages modifiées

- `frontend/src/app/app/(dashboard)/settings/page.tsx` — ajout du tab `bancaire` entre `paiement` et `notifications`, icône `Banknote`. `BankAccountsSection` mountée dans `renderContent()`.
- `frontend/src/app/app/(dashboard)/biens/[id]/page.tsx` — renommage du bouton « Modifier » dans `<CardHeaderBien />`. Aucun autre changement (lift state modale conservé depuis A11.A.3).
- `frontend/src/lib/types/index.ts` — ajout des 28 champs A11.A.6.a sur l'interface `Bien` (TypeScript ne les connaissait pas alors qu'ils étaient livrés en DB et Pydantic).
- `frontend/src/app/globals.css` — règles CSS hover sur cards sub-entités + classe `bien-field--editing` (background bleu pâle subtil).

## Cartographie champs Bien DB → tabs

### Tab 1 — Identité (✅ 11 champs présents)

`building_name`, `unit_number`, `reference_number`, `type`, `egid`, `ewid`, `numero_parcelle`, `numero_lot_ppe`, `commune_ofs`, `keys_count`. **Reportés** : `keys_description`, `numero_badge`, `code_digicode` (UI password+toggle œil prête mais pas de champ DB), `date_acquisition`, `prix_acquisition`.

### Tab 2 — Localisation (✅ 13 champs présents, tous catalogue P1 couverts)

`adresse`, `cp`, `ville`, `canton`, `lat`, `lng`, `etage`, `nb_etages`, `orientation_principale`, `vue`, `bruit_proximite`, `accessibilite_pmr`, `ascenseur`.

### Tab 3 — Surface & Annexes (✅ 9 champs + relation annexes)

`surface`, `rooms`, `bedrooms`, `bathrooms`, `cave_m2`, `balcon_m2`, `terrasse_m2`, `jardin_m2`, `terrain_m2` + section `<AnnexesSection />`. **Reportés** : `surface_ponderee`, `toilets`, `ceiling_height_cm`.

### Tab 4 — Caractéristiques techniques (✅ 21 champs + relation compteurs)

`annee_construction`, `annee_renovation`, `classe_energetique`, `type_chauffage`, `mode_eau_chaude`, 8 booléens équipements (`is_furnished`, `has_balcony`, `has_terrace`, `has_garden`, `has_storage`, `has_fireplace`, `has_laundry_private`, `has_laundry_building`), `parking_type`, 2 booléens règles (`pets_allowed`, `smoking_allowed`), 5 distances (gare/bus/télécabine/lac/aéroport), `situation_notes` + section `<CompteursSection />`. **Reportés** : `linge_fourni`, `has_dishwasher`, `has_aircon`, `has_internet`, `distance_ecole_minutes`, `distance_commerces_minutes`, `date_derniers_travaux`, `etat`.

### Tab 5 — Conditions location (✅ 11 champs présents, tous catalogue P1 couverts)

`loyer`, `loyer_charges_exclus`, `charges`, `acompte_charges`, `deposit` (= caution_montant catalogue), `caution_type`, `disponibilite_date`, `duree_minimale_mois`, `preavis_mois`, `residence_type`, `location_type_actuel`.

### Tab 6 — Contacts (relation pure, 0 champ Bien direct)

Section `<ContactsSection />` uniquement.

### Tab 7 — Fiscalité & Description (✅ 7 champs)

`valeur_locative_fiscale`, `valeur_assurance_ecab`, `description_publique`, `points_forts`, `description_lieu`, `description_logement`, `remarques`. **Reportés** : `prix_acquisition`, `date_acquisition`, `taux_hypothecaire`, `hypotheque_montant`, `valeur_fiscale`, `impot_foncier`, `atouts_ia`.

## Champs catalogue reportés au sprint compléments (~22 champs)

### Sur `Bien` (modèle backend à étendre)

- **Identité** : `keys_description`, `numero_badge`, `code_digicode` (sensible — chiffrement at-rest), `date_acquisition`, `prix_acquisition`
- **Caractéristiques techniques** : `surface_ponderee`, `toilets`, `ceiling_height_cm`, `linge_fourni`, `has_dishwasher`, `has_aircon`, `has_internet`, `distance_ecole_minutes`, `distance_commerces_minutes`, `date_derniers_travaux`, `etat`
- **Fiscalité** : `taux_hypothecaire`, `hypotheque_montant`, `valeur_fiscale`, `impot_foncier`, `atouts_ia` (généré IA)

### Sur sous-entités

- **BienAnnexe** : `etage`, `mode_parcage`, `notes`
- **BienContact** : `user_id` (FK users.id pour contact Althy authentifié), `start_date`, `end_date`
- **BienCompteur** : `releve_entree`, `releve_sortie` (cycle locataire — sémantiquement A11.A.4 changement de locataire)

## Décisions arbitraires prises pendant le sprint

1. **Édition inline `save au blur/Enter` (pas debounce keystroke)** — le prompt mentionnait debounce 500ms texte. Décision : save **au blur ou Enter uniquement**, pas pendant la frappe. Plus prévisible UX (Notion-style strict). Pas de saves auto à chaque caractère.
2. **`initialMode` prop conservée mais ignorée** — la signature publique `CaracteristiquesModal({ bienId, open, onClose, initialMode? })` est préservée pour rétrocompat call site. Mais la nouvelle modale a un mode unique (lecture interactive inline), donc `initialMode` est documenté comme no-op.
3. **Champs sensibles password (UI prête mais pas de champ DB)** — le composant `Field` supporte `type="password"` avec toggle œil. Aucun champ Bien actuel n'utilise ce type (`code_digicode` est reporté). Le code est prêt pour le sprint compléments.
4. **`ToggleRow` save sans confirmation** — booléens (équipements, règles) save instantanément au clic. Pas de mode lecture/édition, pattern toggle direct.
5. **Validation IBAN regex permissive** — `^[A-Z]{2}\d{2}\s?(\d{4}\s?){2,7}(\d{1,4})?$` accepte CH + autres pays IBAN. Pas python-stdnum (sprint sécurité financière à venir).
6. **Compte principal supprimé → pas de ré-élection auto** — cohérent avec décision A11.A.6.b service-side. UI confirme avec message « Vous devrez désigner un nouveau principal manuellement ».

## Section conformité docs

| Doc canonique | Sections impactées | Statut sprint A11.A.6.c |
|---|---|---|
| `docs/7-CATALOGUE-DONNEES-ALTHY.md` | Rôle 1 fiche bien (~50 champs) + entités sous-tables | ✅ UI livrée pour tous les champs P1 présents en DB ; ~22 champs reportés au sprint compléments data model |
| `docs/4-PRODUIT.md` | §4.2 (édition inline pattern Notion) + §4.6 + §4.5 (settings) | ✅ Aligné — édition inline implémentée selon doctrine ; bouton « Voir / éditer » remplace « Modifier » |
| `docs/3-ARCHITECTURE.md` | §3.6 (DA palette + typo Fraunces/DM Sans + DA scientifique) + §3.12 (3 patterns modale) | 🟡 Innovation à documenter post-sprint : pattern inline pour sub-entités simples (annexe/contact/compteur) — la doc cite uniquement side panel pour intervention/devis/paiement/candidature |
| `docs/2-ROADMAP.md` | §2.10 (Règle 8 1 clic) | ✅ Aligné — annexes/contacts/compteurs gérables sans changer de page |

## Backlog identifié pour sprints suivants

### Sprint compléments data model (migration 0037)

- **Bien** : ajouter `keys_description`, `numero_badge`, `code_digicode` (chiffré at-rest), `surface_ponderee`, `toilets`, `ceiling_height_cm`, `linge_fourni`, `has_dishwasher`, `has_aircon`, `has_internet`, `distance_ecole_minutes`, `distance_commerces_minutes`, `date_derniers_travaux`, `etat`, `prix_acquisition`, `date_acquisition`, `taux_hypothecaire`, `hypotheque_montant`.
- **BienAnnexe** : ajouter `etage`, `mode_parcage`, `notes`.
- **BienContact** : ajouter `user_id` (FK), `start_date`, `end_date`.
- **BienCompteur** : ajouter `releve_entree`, `releve_sortie` (cycle locataire — coupler avec sprint A11.A.4 changement de locataire).
- Extension UI tabs en conséquence.

### Sprint cohérence docs post-6.c

- Mise à jour `docs/7-CATALOGUE-DONNEES-ALTHY.md` : officialiser Comptes bancaires sous `/app/settings` (au lieu de `/app/profil` actuel l. 1353).
- Mise à jour `docs/4-PRODUIT.md` §4.2 + `docs/3-ARCHITECTURE.md` §3.12 : préciser que pattern **inline dans tab dédié** est acceptable pour sub-entités simples (annexe/contact/compteur), en complément du side panel pour les sub-entités complexes (intervention/devis/paiement/candidature).

### Sprint validation IBAN stricte

Passer de regex CH simple à `python-stdnum` (validation BIC, calcul check digit mod-97 IBAN, normalisation espaces, etc.). Avec rollout côté backend (Pydantic) + frontend (lib stdnum.js équivalent).

### Sprint acquisition automatique APIs publiques

GeoAdmin / RegBL pour pré-remplir EGID, EWID, `commune_ofs` au géocodage du bien (cf catalogue l. 165-167 — état « 🧠 IA » P1 « API GeoAdmin Swisstopo via adresse »).

### Sprint sections enrichies P2-P4 (Phase 2-3)

- Valorisation IA (sous-section catalogue l. 429-447, P3-4)
- Maintenance prédictive (l. 449-457, P3)
- Marché local (l. 459-467, P2)
- Optimisation fiscale IA (l. 469-478, P2-3)

### Sprint chiffrement at-rest données sensibles

- IBAN dans `bank_accounts` (currently stored cleartext)
- `code_digicode` quand ajouté
- via pgcrypto ou KMS dédié

## Doc de référence

- Sprint précédent : `docs/session12/SPRINT-A11A6b-endpoints.md` (16 endpoints CRUD livrés en 6.b — consommés par les hooks de ce sprint).
- `docs/7-CATALOGUE-DONNEES-ALTHY.md` — catalogue source, Rôle 1 § Fiche bien.
- `docs/4-PRODUIT.md` §4.2 (édition inline pattern Notion) + §4.6 (Module Bien).
- `docs/3-ARCHITECTURE.md` §3.6 (DA scientifique) + §3.12 (3 patterns modale + Règle 8).
- `docs/2-ROADMAP.md` §2.10 (Règle 8 1 clic).
