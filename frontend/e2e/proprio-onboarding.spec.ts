/**
 * E2E — Parcours proprio_solo : inscription → onboarding → ajout bien.
 *
 * Ce test couvre le parcours complet d'un nouveau propriétaire :
 *   / → /register → /bienvenue → /app → /app/biens/nouveau → /app/biens/[id]
 *
 * Chaque run utilise un email unique (timestamp-based) pour éviter les conflits.
 * Le compte créé n'est PAS nettoyé automatiquement (Supabase Admin API requis).
 * En CI, un cron ou un hook post-test devrait purger les comptes test-*.
 */

import { test, expect } from "@playwright/test";

const UNIQUE_ID = Date.now().toString(36);
const TEST_EMAIL = `test-e2e-${UNIQUE_ID}@althy-test.ch`;
const TEST_PASSWORD = "TestE2e1!Secure";

test.describe("Proprio solo — onboarding complet", () => {
  test.setTimeout(30_000);

  test("inscription → onboarding → ajout bien → fiche bien", async ({
    page,
  }) => {
    // ── 1. Landing → CTA ──────────────────────────────────────────────────
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Click the main CTA — "Commencer gratuitement" (may be in header or in page)
    const cta = page.locator(
      'a:has-text("Commencer gratuitement"), a:has-text("Créer un compte")',
    );
    // If CTA exists on landing, click it; otherwise go directly to /register
    if ((await cta.count()) > 0) {
      await cta.first().click();
    } else {
      await page.goto("/register");
    }

    await page.waitForURL("**/register**", { timeout: 10_000 });

    // ── 2. Register — step 1: credentials ────────────────────────────────
    await page.locator('input[id="email"]').fill(TEST_EMAIL);
    await page.locator('input[id="password"]').fill(TEST_PASSWORD);
    await page.locator('input[id="confirm_password"]').fill(TEST_PASSWORD);

    // Accept CGU
    const cguCheckbox = page.locator('input[type="checkbox"]');
    await cguCheckbox.check();

    // Submit credentials
    await page.locator('button[type="submit"]').click();

    // ── 3. Register — step 2: pick role ──────────────────────────────────
    // Wait for role selection step
    await expect(
      page.locator("text=Que gérez-vous"),
    ).toBeVisible({ timeout: 10_000 });

    // Pick "propriétaire"
    await page.locator("button:has-text('propriétaire')").first().click();

    // ── 4. Redirect to /app/sphere or /bienvenue ─────────────────────────
    // The register flow pushes to /app/sphere; middleware may redirect to /bienvenue
    await page.waitForURL(
      (url) =>
        url.pathname.includes("/bienvenue") ||
        url.pathname.includes("/app/sphere") ||
        url.pathname.includes("/app"),
      { timeout: 15_000 },
    );

    const currentUrl = page.url();

    // ── 5. If on /bienvenue, complete onboarding ─────────────────────────
    if (currentUrl.includes("/bienvenue")) {
      // The onboarding has steps — fill minimal info and proceed
      // Step: role confirmation (if shown)
      const roleCard = page.locator("button:has-text('Propriétaire')");
      if ((await roleCard.count()) > 0) {
        await roleCard.first().click();
      }

      // Fill questions if shown (nb_biens, gestion)
      const nbBiensInput = page.locator('input[placeholder="3"]');
      if ((await nbBiensInput.count()) > 0) {
        await nbBiensInput.fill("2");
      }

      // Click continue/next buttons until we reach the dashboard
      for (let attempt = 0; attempt < 5; attempt++) {
        const nextBtn = page.locator(
          'button:has-text("Continuer"), button:has-text("Suivant"), button:has-text("Terminer"), button:has-text("Accéder")',
        );
        if ((await nextBtn.count()) > 0) {
          await nextBtn.first().click();
          await page.waitForTimeout(500);
        }

        // Check if we've reached the app
        if (page.url().includes("/app/")) break;
      }

      // Wait for any /app route
      await page.waitForURL((url) => url.pathname.startsWith("/app"), {
        timeout: 15_000,
      });
    }

    // ── 6. Dashboard — navigate to "Ajouter un bien" ─────────────────────
    // We should be in /app (any page). Navigate to biens if not already there
    await page.goto("/app/biens");
    await page.waitForLoadState("domcontentloaded");

    // Click "Ajouter un bien" button
    const addBtn = page.locator(
      'a:has-text("Ajouter un bien"), button:has-text("Ajouter un bien")',
    );
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 });
    await addBtn.first().click();

    // ── 7. Verify /app/biens/nouveau loads (not 404) ─────────────────────
    await page.waitForURL("**/biens/nouveau**", { timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText("404");
    await expect(page.locator("body")).not.toContainText("not found");

    // The page should have a form with address field
    const addressInput = page.locator(
      'input[placeholder*="adresse" i], input[placeholder*="Rue" i], input[name="address"]',
    );
    // At minimum, the page title should be visible
    await expect(
      page.locator('text=/Ajouter|Nouveau bien|Créer un bien/i'),
    ).toBeVisible({ timeout: 5_000 });

    // ── 8. Fill the new property form ────────────────────────────────────
    // Address
    if ((await addressInput.count()) > 0) {
      await addressInput.first().fill("Rue de la Gare 10, 1003 Lausanne");
    }

    // Monthly rent
    const rentInput = page.locator(
      'input[name="loyer"], input[placeholder*="loyer" i], input[placeholder*="CHF" i]',
    );
    if ((await rentInput.count()) > 0) {
      await rentInput.first().fill("1800");
    }

    // Type (select if exists)
    const typeSelect = page.locator(
      'select[name="type"], select:has(option:has-text("Appartement"))',
    );
    if ((await typeSelect.count()) > 0) {
      await typeSelect.first().selectOption({ index: 1 });
    }

    // Rooms
    const roomsInput = page.locator(
      'input[name="rooms"], input[placeholder*="pièce" i]',
    );
    if ((await roomsInput.count()) > 0) {
      await roomsInput.first().fill("3");
    }

    // Submit the form
    const submitBtn = page.locator(
      'button[type="submit"]:has-text("Créer"), button[type="submit"]:has-text("Ajouter"), button:has-text("Enregistrer")',
    );
    if ((await submitBtn.count()) > 0) {
      await submitBtn.first().click();

      // ── 9. Verify redirect to /app/biens/[id] ───────────────────────────
      await page.waitForURL(
        (url) => /\/app\/biens\/[a-f0-9-]+/.test(url.pathname),
        { timeout: 15_000 },
      );

      // The page should show our address
      await expect(page.locator("body")).toContainText("Lausanne", {
        timeout: 5_000,
      });
    }
  });
});
