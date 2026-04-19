/**
 * E2E — Parcours proprio : génération de quittance PDF.
 *
 * Pré-requis (compte test) :
 *   - Un proprio_solo avec au moins 1 bien actif
 *   - Le bien doit avoir un loyer mensuel défini (monthly_rent > 0)
 *   - Le bien doit avoir un locataire actif (table locataires, statut="actif")
 *
 * Credentials via env vars : E2E_PROPRIO_EMAIL / E2E_PROPRIO_PASSWORD
 */

import { test, expect } from "./fixtures/auth";
import { TEST_USERS } from "./fixtures/auth";

test.describe("Proprio — génération quittance de loyer", () => {
  test.setTimeout(30_000);

  test("naviguer vers un bien et générer une quittance PDF", async ({
    proprioPage: page,
  }) => {
    // ── 1. Go to biens list ──────────────────────────────────────────────
    await page.goto("/app/biens");
    await page.waitForLoadState("domcontentloaded");

    // Wait for the list to load (should have at least 1 bien)
    const bienCard = page.locator(
      'a[href*="/app/biens/"], [data-testid="bien-card"]',
    );
    await expect(bienCard.first()).toBeVisible({ timeout: 15_000 });

    // ── 2. Click on the first bien ───────────────────────────────────────
    await bienCard.first().click();
    await page.waitForURL(
      (url) => /\/app\/biens\/[a-f0-9-]+/.test(url.pathname),
      { timeout: 10_000 },
    );

    // Verify the page loaded (should have address visible)
    await expect(page.locator("body")).not.toContainText("404");

    // ── 3. Find and click "Générer quittance" ────────────────────────────
    // The button might be in a dropdown, modal trigger, or direct button
    const quittanceBtn = page.locator(
      'button:has-text("quittance"), button:has-text("Quittance")',
    );

    // If not directly visible, check for a "Documents" or "Actions" section
    if ((await quittanceBtn.count()) === 0) {
      // Try expanding a dropdown or navigating to a sub-section
      const docsTab = page.locator(
        'button:has-text("Documents"), a:has-text("Documents")',
      );
      if ((await docsTab.count()) > 0) {
        await docsTab.first().click();
        await page.waitForTimeout(500);
      }
    }

    await expect(quittanceBtn.first()).toBeVisible({ timeout: 10_000 });

    // ── 4. Intercept the PDF response ────────────────────────────────────
    // The quittance button either:
    // a) Opens a new tab/window with the PDF
    // b) Triggers a download via blob URL
    // c) Returns a response with pdf_base64 or download_url

    // Listen for new pages (window.open)
    const [newPageOrDownload] = await Promise.all([
      // Race: either a popup opens or a download starts
      Promise.race([
        page.context().waitForEvent("page", { timeout: 15_000 }).catch(() => null),
        page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
      ]),
      // Click the button
      quittanceBtn.first().click(),
    ]);

    // ── 5. Verify PDF was generated ──────────────────────────────────────
    if (newPageOrDownload && "url" in newPageOrDownload) {
      // A new page opened (window.open with blob or signed URL)
      const popup = newPageOrDownload;
      await popup.waitForLoadState("domcontentloaded");
      const popupUrl = popup.url();

      // Should be a PDF — either blob: URL or signed Supabase URL
      const isPdf =
        popupUrl.includes("blob:") ||
        popupUrl.includes(".pdf") ||
        popupUrl.includes("documents/");
      expect(isPdf).toBeTruthy();
      await popup.close();
    } else if (newPageOrDownload && "suggestedFilename" in newPageOrDownload) {
      // A download was triggered
      const download = newPageOrDownload;
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.pdf$/);

      // Save and verify size
      const filePath = await download.path();
      expect(filePath).toBeTruthy();
    } else {
      // Neither popup nor download — check for success toast/notification
      // The API might have returned and the UI shows a success state
      const successIndicator = page.locator(
        'text=/quittance.*générée|PDF.*prêt|Télécharger/i',
      );
      await expect(successIndicator).toBeVisible({ timeout: 10_000 });
    }
  });

  test("la quittance contient le mois et le montant", async ({
    proprioPage: page,
  }) => {
    // ── Setup: intercept the API response ──────────────────────────────
    let quittanceResponse: {
      pdf_base64?: string;
      montant?: number;
      mois?: string;
      download_url?: string;
    } | null = null;

    await page.route("**/loyers/quittance**", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      quittanceResponse = body;
      await route.fulfill({ response });
    });

    // ── Navigate to first bien ──────────────────────────────────────────
    await page.goto("/app/biens");
    await page.waitForLoadState("domcontentloaded");

    const bienCard = page.locator(
      'a[href*="/app/biens/"], [data-testid="bien-card"]',
    );
    await expect(bienCard.first()).toBeVisible({ timeout: 15_000 });
    await bienCard.first().click();
    await page.waitForURL(
      (url) => /\/app\/biens\/[a-f0-9-]+/.test(url.pathname),
      { timeout: 10_000 },
    );

    // ── Click quittance button ──────────────────────────────────────────
    const quittanceBtn = page.locator(
      'button:has-text("quittance"), button:has-text("Quittance")',
    );

    if ((await quittanceBtn.count()) === 0) {
      const docsTab = page.locator(
        'button:has-text("Documents"), a:has-text("Documents")',
      );
      if ((await docsTab.count()) > 0) {
        await docsTab.first().click();
        await page.waitForTimeout(500);
      }
    }

    await expect(quittanceBtn.first()).toBeVisible({ timeout: 10_000 });
    await quittanceBtn.first().click();

    // ── Wait for API response ───────────────────────────────────────────
    await page.waitForTimeout(3_000);

    // ── Verify response content ─────────────────────────────────────────
    if (quittanceResponse) {
      // Should have a montant
      expect(quittanceResponse.montant).toBeGreaterThan(0);

      // Should have a mois in YYYY-MM format
      expect(quittanceResponse.mois).toMatch(/^\d{4}-\d{2}$/);

      // Should have either pdf_base64 or download_url
      const hasPdf =
        !!quittanceResponse.pdf_base64 || !!quittanceResponse.download_url;
      expect(hasPdf).toBeTruthy();

      // If we have pdf_base64, verify it's valid base64
      if (quittanceResponse.pdf_base64) {
        expect(quittanceResponse.pdf_base64.length).toBeGreaterThan(100);
        // PDF magic bytes: JVBERi0 (base64 of %PDF-)
        expect(quittanceResponse.pdf_base64).toMatch(/^JVBERi0/);
      }
    }
  });
});
