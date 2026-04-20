/**
 * Configuration runtime next-intl — charge les messages selon la locale résolue.
 *
 * Utilisé par le plugin next-intl configuré dans next.config.js (createNextIntlPlugin).
 * Lit la locale depuis le cookie `NEXT_LOCALE` (posé par le middleware) ou fallback sur DEFAULT_LOCALE.
 */

import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale, type Locale } from "./config";

async function resolveLocale(): Promise<Locale> {
  const cookie = cookies().get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(cookie)) return cookie;

  const header = headers().get("x-althy-locale");
  if (isSupportedLocale(header)) return header;

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  }

  return { locale, messages };
});
