/**
 * Configuration i18n — source unique de la liste des locales.
 *
 * Phase 1 (2026-04-20) : 'fr-CH' seule locale active.
 * Phase Y3-Y4 : activation progressive selon expansion européenne.
 *
 * Ajouter une locale :
 *   1. Ajouter le code BCP-47 dans LOCALES ci-dessous
 *   2. Créer frontend/messages/{locale}.json avec la même structure que fr-CH.json
 *   3. Ajouter l'entrée CURRENCY_BY_LOCALE + COUNTRY_BY_LOCALE
 *   4. Vérifier que tous les composants i18n-isés ont bien leurs clés traduites
 *   5. Activer dans LOCALES_ENABLED (feature flag progressif par pays)
 */

export const LOCALES = [
  "fr-CH", // Suisse romande (par défaut, Phase 1)
  "fr-FR", // France (Y3)
  "de-CH", // Suisse alémanique (Y3)
  "de-DE", // Allemagne (Y4)
  "it-CH", // Suisse italienne (Y3)
  "it-IT", // Italie (Y4)
  "en",    // English fallback international
] as const;

export type Locale = (typeof LOCALES)[number];

/** Locales activées en production. Les autres rechargent les messages fallback (fr-CH). */
export const LOCALES_ENABLED: Locale[] = ["fr-CH"];

export const DEFAULT_LOCALE: Locale = "fr-CH";

/** Devise par défaut pour chaque locale (ISO 4217). */
export const CURRENCY_BY_LOCALE: Record<Locale, string> = {
  "fr-CH": "CHF",
  "de-CH": "CHF",
  "it-CH": "CHF",
  "fr-FR": "EUR",
  "de-DE": "EUR",
  "it-IT": "EUR",
  "en":    "CHF",
};

/** Code pays ISO-3166-1 alpha-2 par locale. */
export const COUNTRY_BY_LOCALE: Record<Locale, string> = {
  "fr-CH": "CH",
  "de-CH": "CH",
  "it-CH": "CH",
  "fr-FR": "FR",
  "de-DE": "DE",
  "it-IT": "IT",
  "en":    "CH",
};

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isSupportedLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}
