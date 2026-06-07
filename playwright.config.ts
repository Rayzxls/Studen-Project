import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration — Phase 9 · P9-3
 *
 * Runs against a real local dev server on http://localhost:3000.
 * Tests share the Neon dev DB with the integration tests, so we keep
 * the suite serial (workers: 1) and let webServer reuse the dev
 * server the developer is already running.
 *
 * Chromium-only. Cross-browser + Lighthouse + axe-core sweep land in
 * a Phase 10 hardening pass.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
