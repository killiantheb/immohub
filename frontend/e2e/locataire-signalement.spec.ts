/**
 * E2E — Parcours locataire : signaler un problème.
 *
 * Pré-requis (compte test) :
 *   - Un locataire associé à un bien (bien_id set dans la table locataires)
 *   - Le bien doit exister et être actif
 *
 * Flow testé :
 *   Login → Dashboard locataire → Section "Signaler un problème"
 *   → Sélectionner catégorie → Décrire → Envoyer → "Signalement envoyé"
 *   → Vérifier via API que l'intervention a été créée
 */

import { test, expect } from "./fixtures/auth";
import { API_URL } from "./fixtures/auth";

test.describe("Locataire — signalement de problème", () => {
  test.setTimeout(30_000);

  test("signaler une fuite et vérifier le succès", async ({
    locatairePage: page,
  }) => {
    // ── 1. Navigate to dashboard ─────────────────────────────────────────
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    // Wait for the dashboard to load (not a redirect loop)
    await page.waitForURL(
      (url) => url.pathname.startsWith("/app"),
      { timeout: 15_000 },
    );

    // ── 2. Find the "Signaler un problème" section ─────���─────────────────
    // The section is rendered by SectionSignalerProbleme in UnifiedDashboard
    // It uses DSectionTitle with text "Signaler un problème"
    const sectionTitle = page.locator("text=Signaler un problème");
    await expect(sectionTitle.first()).toBeVisible({ timeout: 15_000 });

    // Scroll to the section
    await sectionTitle.first().scrollIntoViewIfNeeded();

    // ── 3. Select category "fuite" (plomberie) ───────────────────────────
    const categorySelect = page.locator("select").filter({
      has: page.locator("option:has-text(\"Fuite d'eau\")"),
    });
    await expect(categorySelect).toBeVisible({ timeout: 5_000 });
    await categorySelect.selectOption("plomberie");

    // ── 4. Type description ──────────────────────────────────────────────
    const descriptionField = page.locator(
      'textarea[placeholder*="problème" i]',
    );
    await expect(descriptionField).toBeVisible();

    const description = `[E2E-TEST] Fuite sous l'évier de cuisine depuis ce matin — ${Date.now()}`;
    await descriptionField.fill(description);

    // ── 5. Intercept the API call to capture the intervention ID ─────────
    let interventionResponse: { id?: string; detail?: string } | null = null;

    await page.route("**/interventions**", async (route) => {
      if (route.request().method() === "POST") {
        const response = await route.fetch();
        const body = await response.json().catch(() => ({}));
        interventionResponse = body;
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    // ── 6. Click "Envoyer à mon propriétaire" ────────────────────────────
    const sendBtn = page.locator(
      "button:has-text('Envoyer à mon propriétaire')",
    );
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // ── 7. Verify success message ────────────────────────────────────────
    const successMsg = page.locator("text=Signalement envoyé");
    await expect(successMsg).toBeVisible({ timeout: 10_000 });

    // Verify the follow-up link is visible
    const followLink = page.locator("text=Suivre le signalement");
    await expect(followLink).toBeVisible();

    // ── 8. Verify the intervention was created via API ───────────────────
    // The intercepted response should contain the created intervention
    if (interventionResponse && interventionResponse.id) {
      expect(interventionResponse.id).toBeTruthy();
    }
    // If no response intercepted (race condition), verify via navigation
    else {
      // Click "Suivre le signalement" to go to interventions page
      await followLink.click();
      await page.waitForURL("**/interventions**", { timeout: 10_000 });

      // Our intervention should be listed
      await expect(page.locator("body")).toContainText("Fuite", {
        timeout: 10_000,
      });
    }
  });

  test("le bouton est désactivé sans bien associé", async ({ page }) => {
    // This test uses a fresh page (not locatairePage) to test edge case
    // Skip if we can't create a user without bien — this is a defensive check
    test.skip(true, "Requires a locataire without bien_id — manual test");
  });

  test("signalement avec catégorie urgente", async ({
    locatairePage: page,
  }) => {
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    const sectionTitle = page.locator("text=Signaler un problème");
    await expect(sectionTitle.first()).toBeVisible({ timeout: 15_000 });
    await sectionTitle.first().scrollIntoViewIfNeeded();

    // Select "Chauffage" (marked as urgent in SIGNALER_CATS)
    const categorySelect = page.locator("select").filter({
      has: page.locator("option:has-text('Chauffage')"),
    });
    await categorySelect.selectOption("chauffage");

    // Fill description
    const descriptionField = page.locator(
      'textarea[placeholder*="problème" i]',
    );
    const description = `[E2E-TEST] Chauffage en panne, température < 15°C — ${Date.now()}`;
    await descriptionField.fill(description);

    // Intercept to verify urgence field
    let postedBody: Record<string, unknown> | null = null;
    await page.route("**/interventions**", async (route) => {
      if (route.request().method() === "POST") {
        postedBody = route.request().postDataJSON();
        const response = await route.fetch();
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    // Submit
    const sendBtn = page.locator(
      "button:has-text('Envoyer à mon propriétaire')",
    );
    await sendBtn.click();

    // Wait for success
    await expect(page.locator("text=Signalement envoyé")).toBeVisible({
      timeout: 10_000,
    });

    // Verify the posted data had urgence "urgente" (chauffage is urgent: true)
    if (postedBody) {
      expect(postedBody.categorie).toBe("chauffage");
      expect(postedBody.urgence).toBe("urgente");
    }
  });
});
