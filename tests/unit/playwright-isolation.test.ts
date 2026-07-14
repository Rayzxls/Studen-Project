import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("browser and HTTP QA isolation contract", () => {
  it("uses a dedicated non-reused QA server", () => {
    const source = readFileSync(resolve("playwright.config.ts"), "utf8");

    expect(source).toContain("assertIsolatedTestDatabase()");
    expect(source).toContain('baseURL: "http://localhost:3100"');
    expect(source).toContain('url: "http://localhost:3100"');
    expect(source).toContain("reuseExistingServer: false");
    expect(source).not.toContain("reuseExistingServer: !process.env.CI");
  });

  it("isolates the QA Next.js build directory from the normal dev server", () => {
    const runner = readFileSync(
      resolve("scripts/run-isolated-server.ts"),
      "utf8"
    );
    const testRunner = readFileSync(
      resolve("scripts/run-isolated-tests.ts"),
      "utf8"
    );
    const config = readFileSync(resolve("next.config.ts"), "utf8");

    expect(runner).toContain('NEXT_DIST_DIR: ".next-qa"');
    expect(testRunner).toContain('NEXT_DIST_DIR: ".next-qa"');
    expect(runner).toContain('AUTH_URL: "http://localhost:3100"');
    expect(runner).toContain('NEXTAUTH_URL: "http://localhost:3100"');
    expect(testRunner).toContain('AUTH_URL: "http://localhost:3100"');
    expect(testRunner).toContain('NEXTAUTH_URL: "http://localhost:3100"');
    expect(config).toContain('distDir: process.env.NEXT_DIST_DIR ?? ".next"');
  });

  it("guards the legacy mutating smoke suite and keeps it on QA port 3100", () => {
    const smokeSource = readFileSync(resolve("scripts/smoke-test.ts"), "utf8");
    const packageSource = readFileSync(resolve("package.json"), "utf8");

    expect(smokeSource).toContain("assertIsolatedTestDatabase()");
    expect(smokeSource).toContain('const BASE = "http://localhost:3100"');
    expect(packageSource).toContain('"dev:qa"');
    expect(packageSource).toContain('"test:smoke"');
  });
});
