import type { Page } from "@playwright/test";

/**
 * Shared helpers for Playwright E2E flows — Phase 9 · P9-3
 *
 * Mirrors the auth posture in `scripts/smoke-test.ts`: every flow
 * starts by hitting `/login`, filling the credentials form, and
 * waiting for the post-login dashboard render. The Neon dev DB
 * accumulates rate-limit buckets from earlier runs, so callers can
 * invoke `clearLoginRateLimit()` (see the per-test setup) before
 * signing in.
 */

export async function signIn(
  page: Page,
  identifier: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', identifier);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for the post-login render — TopNav's sign-out button is a
  // stable signal that the credentials flow finished. The bell
  // popover also renders a submit button ("ทำเครื่องหมายว่าอ่านทั้งหมด"),
  // so we anchor on the unique Thai text instead of a CSS selector.
  await page.waitForSelector('header form button:has-text("ออกจากระบบ")', {
    timeout: 20_000,
  });
}

export async function signOut(page: Page): Promise<void> {
  await page.click('header form button:has-text("ออกจากระบบ")');
  await page.waitForURL("**/login", { timeout: 20_000 });
}
