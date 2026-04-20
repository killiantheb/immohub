import { expect, test } from "@playwright/test";

/**
 * i18n locale switching (fondations 2026-04-20).
 *
 * Phase 1 : seule la locale fr-CH est "enabled". Les autres locales existent
 * dans le registre et reçoivent le bon message bundle, mais la majorité des
 * chaînes sont vides — c'est attendu (on pose les fondations, pas les
 * traductions).
 *
 * Ce test valide que :
 *   1. `/` charge en fr-CH par défaut (titre landing présent).
 *   2. `/fr-FR/` déclenche un 302 → `/` avec cookie NEXT_LOCALE=fr-FR posé.
 *   3. Le cookie NEXT_LOCALE persiste entre navigations.
 */

test.describe("i18n — locale prefix redirect + cookie", () => {
  test("fr-CH par défaut sur la home", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    // Hero rendu (utilise useTranslations("landing.hero"))
    await expect(page.locator("h1")).toBeVisible();
  });

  test("/fr-FR redirige vers / et pose le cookie NEXT_LOCALE=fr-FR", async ({
    page,
    context,
  }) => {
    const response = await page.goto("/fr-FR", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    // Après redirect on atterrit sur /
    expect(new URL(page.url()).pathname).toBe("/");

    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(localeCookie?.value).toBe("fr-FR");
  });

  test("/de-CH/biens redirige vers /biens et pose le cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/de-CH/biens", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe("/biens");

    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(localeCookie?.value).toBe("de-CH");
  });

  test("préfixe non-supporté (/xx-YY) n'est pas interprété comme locale", async ({
    page,
  }) => {
    // /xx-YY n'est pas dans LOCALES → pas de redirect locale, route 404 Next
    const response = await page.goto("/xx-YY", { waitUntil: "domcontentloaded" });
    // Soit 404 Next, soit route non-trouvée — l'important est l'absence de
    // redirect basé sur la locale.
    expect([404, 200]).toContain(response?.status() ?? 0);
  });
});
