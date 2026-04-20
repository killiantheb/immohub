# Guide i18n — Althy

> **Statut (2026-04-20) :** fondations posées. Aucune traduction réelle en
> Phase 1. Le but est de permettre l'expansion Europe (FR/DE/IT) Y3-Y4 sans
> refactoring majeur.

---

## 1. Vue d'ensemble

- **Lib :** `next-intl` (Next.js 14 App Router compatible).
- **Source de vérité locales :** `frontend/src/i18n/config.ts`.
- **Locales déclarées :** `fr-CH`, `fr-FR`, `de-CH`, `de-DE`, `it-CH`, `it-IT`, `en`.
- **Locales activées en prod :** `fr-CH` uniquement (`LOCALES_ENABLED`).
- **Locale par défaut :** `fr-CH`.
- **Messages :** `frontend/messages/{locale}.json`.
- **Mécanisme de bascule :** cookie `NEXT_LOCALE` + préfixe d'URL (redirect).

## 2. Architecture

```
frontend/
├── src/
│   ├── i18n/
│   │   ├── config.ts          # LOCALES, DEFAULT_LOCALE, helpers
│   │   └── request.ts         # next-intl : charge le bon bundle
│   ├── middleware.ts          # détecte préfixe locale → redirect + cookie
│   ├── app/layout.tsx         # <NextIntlClientProvider> au root
│   └── legal/{CH,FR,DE,IT}/   # contenus légaux par pays
└── messages/
    ├── fr-CH.json             # canonique (complet)
    ├── fr-FR.json             # skeleton
    └── de-CH.json             # skeleton
```

## 3. Utiliser une traduction dans un composant

**Client component :**

```tsx
"use client";
import { useTranslations } from "next-intl";

export function MyButton() {
  const t = useTranslations("common");
  return <button>{t("save")}</button>;
}
```

**Server component :**

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("landing.hero");
  return <h1>{t("title1")}</h1>;
}
```

**Avec interpolation ICU :**

```tsx
// messages: "economyPctSuffix": "soit {pct}% de moins chaque année"
t("economyPctSuffix", { pct: 42 });
// → "soit 42% de moins chaque année"
```

## 4. Namespaces

`fr-CH.json` est découpé en 8 namespaces stables :

| Namespace   | Contenu                                             |
|-------------|-----------------------------------------------------|
| `common`    | mots courants (save, cancel, loading, app name)     |
| `auth`      | écrans login/register/reset                         |
| `dashboard` | navigation sidebar, empty states, KPIs              |
| `landing`   | pages publiques (hero, features, témoignages)       |
| `autonomie` | landing + calculator Althy Autonomie                |
| `pricing`   | cartes Tarifs + CTAs                                |
| `legal`     | titres CGU/confidentialité/cookies                  |
| `errors`    | messages d'erreur techniques visibles utilisateur   |

**Règle** : ne pas créer de nouveau namespace sans raison forte. Ajouter une
clé dans un namespace existant est presque toujours la bonne décision.

## 5. Bascule de locale

### Via cookie (programmatique)

```ts
document.cookie = "NEXT_LOCALE=de-CH; path=/; SameSite=Lax";
location.reload();
```

### Via URL

`https://althy.ch/de-CH/biens` → le middleware pose le cookie `NEXT_LOCALE=de-CH`,
puis redirige (302) vers `/biens`. Next-intl lit ensuite le cookie pour toutes
les requêtes suivantes.

## 6. Ajouter une locale

1. Ajouter la clé dans `LOCALES` dans `src/i18n/config.ts`.
2. Mettre à jour `CURRENCY_BY_LOCALE` et `COUNTRY_BY_LOCALE`.
3. Créer `frontend/messages/{locale}.json` (copier la structure `fr-CH.json`).
4. Remplir les textes légaux dans `src/legal/{COUNTRY}/` (+ `backend/legal/{COUNTRY}/`).
5. Valider la conformité juridique (avocat local).
6. Ajouter la locale à `LOCALES_ENABLED` pour l'exposer au switcher UI.

## 7. Backend — currency / locale

- `profiles.locale` (migration 0037) : locale préférée de l'utilisateur.
- `profiles.country`, `companies.country`, `properties.country`,
  `biens.country` : pays ISO-3166.
- `properties.currency`, `contracts.currency`, `subscriptions.currency`,
  `transactions.currency`, `loyer_transactions.currency` : ISO-4217.
- `loyer_transactions.bank_country` : pays de la banque (route le bon parser
  dans `app.services.bank_parsers`).

### currency_service

```python
from app.services.currency_service import format_currency, get_exchange_rate

format_currency(1234.5, currency="CHF", locale="fr_CH")
# → "1 234.50 CHF" (ou "CHF 1'234.50" selon Babel dispo)

rate = get_exchange_rate("CHF", "EUR")  # 1.03 (taux figé Phase 1)
```

### bank_parsers

```python
from app.services.bank_parsers import get_parser

parser = get_parser(bank_country="CH", format="camt.054")
entries = parser.parse(xml_bytes)  # list[BankEntry]
```

Ajouter un parser SEPA futur : implémenter `BankStatementParser.parse()` et
`register_parser("FR", "pain.001", MyPain001Parser)` dans
`bank_parsers/registry.py`.

## 8. Tests

- `frontend/e2e/i18n-locale-switch.spec.ts` — valide le redirect + cookie.
- Lancer : `npx playwright test e2e/i18n-locale-switch.spec.ts`.

## 9. Pièges connus

- **Ne pas faire de `rewrite`** sur le préfixe locale : Supabase auth ne verrait
  pas la requête finale. Utiliser `redirect` (comportement actuel).
- **Ne pas déplacer `app/` vers `app/[locale]/`** tant que `LOCALES_ENABLED`
  contient une seule entrée : ça casserait les routes existantes sans bénéfice.
- **Ne pas hardcoder une locale** (`"CHF"`, `"fr-CH"`) dans un composant :
  passer par `CURRENCY_BY_LOCALE` / `useLocale()`.

## 10. TODO avant activation d'une 2e locale

- [ ] Compléter `messages/{locale}.json` (texte produit).
- [ ] Traduire les `src/legal/{COUNTRY}/*.md`.
- [ ] Valider juridique pays (RGPD FR/DE/IT, Impressum DE).
- [ ] Brancher un provider de change réel dans `currency_service.get_exchange_rate`.
- [ ] Ajouter un `<LocaleSwitcher>` dans `DTopNav` (écouter les locales de `LOCALES_ENABLED`).
- [ ] Vérifier formats date / nombre Babel (backend) et Intl (frontend).
- [ ] Enregistrer un parser bancaire local si différent de CAMT.053.
