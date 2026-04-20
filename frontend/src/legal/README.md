# Legal content by country

Fondations multi-legal pour l'expansion européenne (Y3-Y4).

## Structure

```
src/legal/
├── CH/           # Suisse — actif (source canonique)
│   ├── cgu.md
│   ├── confidentialite.md
│   ├── cookies.md
│   └── disclaimer-ia.md
├── FR/           # France — placeholder (RGPD directement applicable, CGU à adapter)
├── DE/           # Allemagne — placeholder (DSGVO + Impressum obligatoire)
└── IT/           # Italie — placeholder (Codice Privacy + adaptation CGU)
```

## Règle

- `CH/` contient les textes actifs en prod (fr-CH, conformes LPD suisse).
- `FR/`, `DE/`, `IT/` contiennent des placeholders (`_placeholder.md`) à
  compléter par un avocat local avant activation du pays correspondant.
- Le pays est déterminé par `profiles.country` (migration 0037) ou par la
  locale de l'URL (fallback).

## Résolution côté Next.js

Les pages `/legal/*` (dans `app/legal/`) doivent résoudre le contenu via :

```ts
import { COUNTRY_BY_LOCALE } from "@/i18n/config";
import { cookies } from "next/headers";

async function getLegalMarkdown(slug: "cgu" | "confidentialite" | "cookies" | "disclaimer-ia") {
  const locale = cookies().get("NEXT_LOCALE")?.value ?? "fr-CH";
  const country = COUNTRY_BY_LOCALE[locale] ?? "CH";
  const { default: md } = await import(`@/legal/${country}/${slug}.md`);
  return md;
}
```

Le loader Markdown (`remark` / `@next/mdx`) reste à brancher — pas de
dépendance ajoutée en Phase 1.

## Quand compléter FR/DE/IT

Avant d'activer une locale dans `LOCALES_ENABLED` (`src/i18n/config.ts`) :
1. Faire valider les textes par un juriste du pays cible.
2. Remplacer `_placeholder.md` par les 4 fichiers requis.
3. Vérifier les obligations locales (Impressum en DE, RGPD en FR, etc.).
