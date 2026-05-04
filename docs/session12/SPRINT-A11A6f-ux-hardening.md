# SPRINT A11.A.6.f — UX hardening fiche bien

> Sprint 12 / PR-A11.A.6.f
> Branche : `feat/bien-ux-hardening` → `main`
> Statut : ✅ Livré le 2026-05-04

---

## 1. Périmètre livré (résumé en 6 lignes)

1. **Lisibilité** — base body 15px (cohérent doctrine `3-ARCHITECTURE` §3.6), line-height 1.5, padding 32px modale, espacement 32px entre sections, espacement 20px entre champs.
2. **Hiérarchie label/valeur** — labels 11px uppercase tracking 0.04em, valeurs 15px line-height 1.5, gap label/valeur 6px, min-height 42px par champ.
3. **`<RequiredMarker />`** — primitive UI réutilisable (FieldLabel.tsx), astérisque rouge `*` + tooltip natif « Champ obligatoire ». Appliqué uniquement aux 3 champs strictement obligatoires `BienCreate` Pydantic (adresse, ville, cp).
4. **Split tab Fiscalité & Description** → 8 tabs distincts (Fiscalité simple + Description publique séparée). Tooltip ajouté aux 5 textareas description.
5. **D5 — Type `appartement` BienKey** — ajouté en première position du select KeysSection + nouveau default à la création. « Entrée » renommée « Entrée immeuble » pour distinction.
6. **D6 — Bug édition BienKey corrigé** — actions edit/delete toujours visibles (`opacity: 1`), avant cachées derrière `:hover` → inaccessibles sur tactile (mobile/tablette).

---

## 2. Composants modifiés

| Composant | Type | Changement |
|---|---|---|
| `frontend/src/components/biens/CaracteristiquesModal.tsx` | Modifié | 18 constantes de style refondues (typo + spacing), Section/Grid/ToggleGrid spacing étendu, 8 tabs au lieu de 7, nouveau `TabDescription` |
| `frontend/src/components/biens/FieldLabel.tsx` | Modifié | Prop `required: boolean` ajoutée, export `<RequiredMarker />` |
| `frontend/src/components/biens/KeysSection.tsx` | Modifié | Type `appartement` ajouté en première position + default, badge couleur prussian, actions visibles en permanence |
| `frontend/src/app/app/(dashboard)/biens/nouveau/page.tsx` | Modifié | `RequiredStar` legacy supprimé (hex direct anti-pattern §3.12), remplacé par `<RequiredMarker />` partagé. Marker retiré de titre/type/surface (UX-only, pas backend-required). |

---

## 3. Composant ajouté

### `<RequiredMarker />`

Exporté depuis `frontend/src/components/biens/FieldLabel.tsx`. Utilise `C.red` du design-tokens (pas de hex direct). Tooltip natif via `title` attribute + `aria-label` pour a11y. Réutilisable dans tout formulaire avec champ obligatoire backend.

```tsx
import { RequiredMarker } from "@/components/biens/FieldLabel";

<label>Adresse<RequiredMarker /></label>
```

Ou via `<FieldLabel required>` pour combiner avec tooltip technique :

```tsx
<FieldLabel label="Adresse" required tooltip="Rue + numéro complet" />
```

---

## 4. Bugs corrigés

### D5 — Type `appartement` manquant dans BienKey
- `KeysSection.tsx` : 7 → 8 types disponibles (`appartement` premier)
- Default form : `entree` → `appartement` (clé du logement = cas le plus courant)
- Backend : 0 modification — champ `type` est `String(30)` libre, aucune migration

### D6 — Édition BienKey impossible
- Diagnostic : `cardActionsStyle.opacity = 0` initial, révélé via CSS `.key-card:hover .key-card-actions { opacity: 1 }` dans `globals.css:318`. **Sur mobile/tactile (`@media (hover: none)`), les boutons restaient invisibles → impossible d'éditer.** Aussi friction desktop (non-découvrabilité).
- Fix : `opacity: 1` permanent, transition retirée. Backend PATCH `BienKey` + hook `useUpdateBienKey` étaient déjà fonctionnels — bug purement CSS.

---

## 5. Restructuration tabs (D4)

### Avant (7 tabs)
1. Identité
2. Localisation
3. Surface & Annexes
4. Caractéristiques techniques
5. Conditions location
6. Contacts
7. Fiscalité & Description ← mélange 2 sujets

### Après (8 tabs)
1. Identité
2. Localisation
3. Surface & Annexes
4. Caractéristiques techniques
5. Conditions location
6. Contacts
7. **Fiscalité** (valeur_locative_fiscale, valeur_assurance_ecab uniquement — autres champs reportés)
8. **Description publique** (description_publique, points_forts, description_lieu, description_logement, remarques + tooltips)

Cohérent avec `7-CATALOGUE-DONNEES-ALTHY.md` qui sépare déjà `§Fiscalité du bien` (l. 245-254) et `§Description publique` (l. 235-243) en 2 sous-sections distinctes.

---

## 6. Décisions arbitraires prises pendant le sprint

1. **Spacing 32px desktop / 20px modale (au lieu de 20px section)** — équilibre densité/lisibilité, conforme cible UX double grand-père/Bernard Nicod.
2. **Section `marginBottom` retirée** au profit du `gap: 32px` sur `tabContentStyle` — pattern flex column plus propre, source de vérité unique pour l'espacement entre sections.
3. **Marker `*` uniquement sur 3 champs backend-required** (adresse, ville, cp), pas sur 8 du wizard frontend Zod (titre, type, surface) — reflet du contrat API réel, pas de la UX discipline locale.
4. **Default BienKey `appartement`** au lieu de `entree` — clé du logement est le cas le plus fréquent.
5. **Actions BienKey toujours visibles** au lieu de `:hover` + `@media (hover: none)` — solution simple et lisible, sans détection runtime du device.
6. **Tabs scrollables horizontalement** sur mobile via `overflowX: auto` (pattern existant 6.c) — pas de hamburger menu.

---

## 7. Backlog identifié

### Refacto composant Field
- `Field` / `SelectField` / `TextareaField` / `ToggleRow` sont actuellement inline dans `CaracteristiquesModal.tsx` (1665 lignes). À extraire dans `frontend/src/components/biens/CaracModalFields.tsx` ou variantes spécialisées (FieldText / FieldNumber / FieldDate / FieldSelect / FieldToggle).

### Audit a11y WCAG AA
- Contraste (Bleu de Prusse `#0F2E4C` sur blanc — à mesurer)
- Focus visible sur tous les éléments interactifs
- Roles ARIA cohérents (toggle / dialog / tab)
- Sprint dédié post Phase 1 launch.

### Validation IBAN python-stdnum
- Sprint sécurité financière dédié — pas dans le scope UX hardening.

### Champs Fiscalité reportés
- `prix_acquisition`, `date_acquisition`, `taux_hypothecaire`, `hypotheque_montant`, `valeur_fiscale`, `impot_foncier`, `date_derniers_travaux`, `etat` — catalogue les marque ➕ (à créer). Migration future requise.

---

## 8. Conformité docs (récap final CH0)

CH0 validé Killian avant code. 4 décisions confirmées :

| Décision | Doc canonique | État final |
|---|---|---|
| **DA1** Tokens `C.*` (CSS-in-JS) au lieu de Tailwind classes | `3-ARCHITECTURE` §3.12 « Jamais d'hex direct dans le .tsx » | ✅ Tous les nouveaux styles utilisent `C.prussian/text/text2/text3/red/border` |
| **DA2** Marker `*` uniquement sur 3 champs `BienCreate` backend-required | `BienCreate` Pydantic + `7-CATALOGUE` Identité l. 157-160 | ✅ adresse / ville / cp uniquement. UX-bloquant frontend conservé sans marker. |
| **DA3** Spacing 32px desktop / 20px mobile entre sections | DA scientifique §3.6 « hiérarchie visuelle forte » | ✅ Documenté dans ce recap. Nouvelle convention sprint. |
| **DA4** Bug BienKey = CSS hover `opacity 0` | `4-PRODUIT` §4.2 Règle 8 « 1 clic modifier » | ✅ Hypothèse confirmée. Fix : `opacity: 1` permanent. |

| Élément A11.A.6.f | Doc canonique | État |
|---|---|---|
| Base 15px + line-height 1.5 | `3-ARCHITECTURE` §3.6 « Taille base : 15px sur html » | ✅ aligné — applique la doctrine déjà figée |
| Hiérarchie label/valeur | `3-ARCHITECTURE` §3.6 + `4-PRODUIT` §4.2 | ✅ aligné — labels uppercase 11px / valeurs 15px |
| RequiredMarker création bien | `4-PRODUIT` §4.2 + contrat Pydantic | ✅ aligné — explicite l'obligatoire |
| Split tab Fiscalité / Description | `7-CATALOGUE` l. 235-254 | ✅ aligné — 2 sous-sections distinctes au catalogue |
| Type `appartement` BienKey | `7-CATALOGUE` l. 392-401 (str libre) | ✅ aligné — extension |
| Bug édition BienKey | `4-PRODUIT` §4.2 Règle 8 | ✅ aligné — bug viole doctrine, fixé |

---

## 9. Liens docs de référence

- [`docs/3-ARCHITECTURE.md`](../3-ARCHITECTURE.md) §3.6 (DA scientifique — base 15px, palette, hiérarchie) + §3.12 (Conventions code — tokens, jamais d'hex direct)
- [`docs/4-PRODUIT.md`](../4-PRODUIT.md) §4.2 (1 clic + triple test grand-père/Bernard Nicod) + §4.6 (Module Bien)
- [`docs/7-CATALOGUE-DONNEES-ALTHY.md`](../7-CATALOGUE-DONNEES-ALTHY.md) Section UI Fiche bien Identité (l. 137-172) + Sécurité opérationnelle (l. 392-401) + Fiscalité (l. 245-254) + Description publique (l. 235-243)
- [`docs/session12/SPRINT-A11A6d-enrichissement.md`](./SPRINT-A11A6d-enrichissement.md) (sprint précédent — création FieldLabel + KeysSection)
- [`docs/session12/SPRINT-A11A6c-ui-refonte.md`](./SPRINT-A11A6c-ui-refonte.md) (sprint refonte modale 7 tabs)
