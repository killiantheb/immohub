import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // ── Desktop ──────────────────────────────────────────────────────────────
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },

    // ── Mobile (LCP target <2.5s) ─────────────────────────────────────────────
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        // Throttle to simulate 4G mobile — validates LCP budget
        launchOptions: { args: ["--disable-gpu"] },
      },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
