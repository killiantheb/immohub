/**
 * Auth fixtures for E2E tests.
 *
 * These fixtures provide authenticated browser contexts for different user roles.
 * They use Supabase Auth via the frontend login page (no direct DB access needed).
 *
 * Required env vars (in .env.test or CI secrets):
 *   E2E_PROPRIO_EMAIL    — email of a test proprio_solo account
 *   E2E_PROPRIO_PASSWORD — password
 *   E2E_LOCATAIRE_EMAIL  — email of a test locataire account
 *   E2E_LOCATAIRE_PASSWORD
 *   E2E_API_URL          — backend API base URL (default: http://localhost:8000/api/v1)
 *
 * Setup: create these users manually in Supabase dashboard or via CLI:
 *   1. proprio_solo with at least 1 bien + 1 locataire actif
 *   2. locataire associated to a bien (bien_id set in locataires table)
 */

import { test as base, expect, type Page } from "@playwright/test";

// ── Test user credentials ────────────────────────────────────────────────────

export const TEST_USERS = {
  proprio: {
    email: process.env.E2E_PROPRIO_EMAIL ?? "test-proprio@althy.ch",
    password: process.env.E2E_PROPRIO_PASSWORD ?? "TestProprio1!",
    role: "proprio_solo",
  },
  locataire: {
    email: process.env.E2E_LOCATAIRE_EMAIL ?? "test-locataire@althy.ch",
    password: process.env.E2E_LOCATAIRE_PASSWORD ?? "TestLocataire1!",
    role: "locataire",
  },
} as const;

export const API_URL =
  process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

// ── Login helper ─────────────────────────────────────────────────────────────

export async function loginAs(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  // Fill email
  await page.locator('input[type="email"]').fill(user.email);
  // Fill password
  await page.locator('input[type="password"]').first().fill(user.password);
  // Submit
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

// ── Extended test fixture ────────────────────────────────────────────────────

type AuthFixtures = {
  proprioPage: Page;
  locatairePage: Page;
};

/**
 * Extended Playwright test with pre-authenticated pages.
 *
 * Usage:
 *   import { test } from "./fixtures/auth";
 *   test("my test", async ({ proprioPage }) => { ... });
 */
export const test = base.extend<AuthFixtures>({
  proprioPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, TEST_USERS.proprio);
    await use(page);
    await context.close();
  },

  locatairePage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, TEST_USERS.locataire);
    await use(page);
    await context.close();
  },
});

export { expect };
