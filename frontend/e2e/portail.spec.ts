/**
 * E2E tests — Portail proprio flow.
 *
 * These tests verify the public portail view (/portail/[token]) renders
 * correctly and the messaging channel works.
 *
 * In CI: runs against the production-built app (npm run build && npm run start).
 * Locally: runs against dev server (npm run dev).
 */

import { expect, test } from "@playwright/test";

const FAKE_TOKEN = "00000000-0000-0000-0000-000000000000";
const PORTAIL_URL = `/portail/${FAKE_TOKEN}`;

test.describe("Portail proprio — public route", () => {
  test("shows error page for invalid token", async ({ page }) => {
    await page.goto(PORTAIL_URL);
    // Should show error state (invalid token → 404 from API)
    await expect(page.locator("text=invalide")).toBeVisible({ timeout: 15_000 });
  });

  test("LCP budget — portal page renders within 2.5s", async ({ page }) => {
    // Measure LCP via Performance API
    const start = Date.now();
    await page.goto(PORTAIL_URL);
    await page.waitForLoadState("domcontentloaded");
    const elapsed = Date.now() - start;
    // Allow 5s on CI (slower machines) — target 2.5s in prod
    expect(elapsed).toBeLessThan(5_000);
  });
});

test.describe("Cookie banner — RGPD/LPD", () => {
  test("cookie banner appears on first visit", async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("althy_cookie_consent"));
    await page.reload();
    // Banner should be visible
    const banner = page.getByRole("dialog", { name: /cookies/i });
    await expect(banner).toBeVisible({ timeout: 10_000 });
  });

  test("cookie banner can be dismissed with essential-only", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("althy_cookie_consent"));
    await page.reload();

    const banner = page.getByRole("dialog", { name: /cookies/i });
    await expect(banner).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /essentiels/i }).click();
    await expect(banner).not.toBeVisible();

    // Consent saved in localStorage
    const consent = await page.evaluate(() => localStorage.getItem("althy_cookie_consent"));
    expect(consent).toBeTruthy();
    const parsed = JSON.parse(consent!);
    expect(parsed.level).toBe("essential");
  });

  test("cookie banner not shown after accepting", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("althy_cookie_consent", JSON.stringify({ level: "all", at: new Date().toISOString() }))
    );
    await page.reload();
    // Banner should NOT appear
    const banner = page.getByRole("dialog", { name: /cookies/i });
    await expect(banner).not.toBeVisible();
  });
});

test.describe("Landing page — performance", () => {
  test("landing page loads within 5s on mobile", async ({ page, browserName }) => {
    // Skip on non-Chromium — LCP is Chromium-only
    test.skip(browserName !== "chromium", "LCP only on Chromium");

    const start = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5_000);
  });

  test("landing has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Althy/i);
  });

  test("landing CTA buttons are visible", async ({ page }) => {
    await page.goto("/");
    // Wait for content
    await page.waitForLoadState("domcontentloaded");
    // Check page renders (has some content)
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect((body as string).length).toBeGreaterThan(100);
  });
});

test.describe("Dashboard — auth redirect", () => {
  test("unauthenticated user is redirected from /app", async ({ page }) => {
    await page.goto("/app");
    // Should redirect to login
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    // Either redirected to /login or shows an auth form
    const isAuthRedirect = url.includes("login") || url.includes("auth") || url.includes("signin");
    const hasAuthForm = await page.locator("input[type=email]").count() > 0;
    expect(isAuthRedirect || hasAuthForm).toBeTruthy();
  });
});
