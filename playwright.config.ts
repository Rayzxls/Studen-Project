import { defineConfig, devices } from "@playwright/test";
import { assertIsolatedTestDatabase } from "./tests/helpers/database-safety";

assertIsolatedTestDatabase();

/**
 * Playwright E2E configuration — Phase 9 · P9-3
 *
 * Runs against a dedicated local dev server on http://localhost:3100.
 * Tests mutate data and therefore require a separate QA_DATABASE_URL.
 * The package runner swaps DATABASE_URL before this config is loaded;
 * this assertion also blocks direct Playwright commands from bypassing it.
 *
 * The suite remains serial because its fixtures share one isolated QA DB.
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
    baseURL: "http://localhost:3100",
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
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
