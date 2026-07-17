import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

/**
 * E2E flow 2 — Phase 9 · P9-3
 *
 * Teacher posts a Material → student's bell surfaces the row → clicking
 * deep-links to the student Material detail (P7-8 routes live, P9-1
 * navigation upgrade).
 *
 * Covers:
 *  - lib/notification fan-out + lib/material createMaterial → bell row
 *  - lib/notification/navigation MATERIAL_POSTED → student detail URL
 *    (was a course-root fallback pre-P9-1, now lands on the entity)
 *  - shared TopNav bell popover + per-row markReadAndNavigate action
 */

const db = new PrismaClient();
const PASSWORD = "Test1234!";
let ctx: TestCourseContext | undefined;

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
});

test.beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({
    where: { id: { startsWith: "login:" } },
  });
});

test.afterAll(async () => {
  try {
    await ctx?.cleanup();
  } finally {
    await db.$disconnect();
  }
});

test("teacher posts material → student bell deep-links to material detail", async ({
  page,
}) => {
  const courseId = ctx!.courseOfferingId;
  const teacherIdentifier = `${ctx!.prefix}_t1@test.local`;
  const studentIdentifier = `${ctx!.prefix}_s1`;

  const title = `E2E เอกสาร ${Date.now()}`;

  // 1) Teacher creates a Material.
  await signIn(page, teacherIdentifier, PASSWORD);
  await page.goto(`/teacher/courses/${courseId}/materials`);
  await page.getByRole("button", { name: /เพิ่มเอกสาร/ }).click();

  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="title"]').fill(title);
  await dialog.locator('textarea[name="body"]').fill("เนื้อหา");
  await dialog.getByRole("button", { name: /เพิ่มเอกสาร/ }).click();

  await expect(page.getByText(title).first()).toBeVisible();

  await signOut(page);

  // 2) Student signs in and opens the bell. The new MATERIAL_POSTED
  //    row should appear inside the popover and click through to the
  //    student-side material detail (P7-8 route).
  await signIn(page, studentIdentifier, PASSWORD);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "การแจ้งเตือน" }).click();

  // popover[open] is the panel's CSS selector under the HTML popover
  // API; matches the bell.tsx setup. We assert the title is rendered
  // somewhere inside it.
  const popover = page.locator("#notification-bell-panel");
  await expect(popover).toBeVisible();
  await expect(popover.getByText(title)).toBeVisible();
  await expect(popover.getByText("เปิดเอกสาร")).toBeVisible();
  await expect(popover.locator('input[name="href"]')).toHaveCount(0);

  // Click the row → server action marks read + redirects to the entity URL.
  await popover.getByText("เปิดเอกสาร").click();

  // P9-1: MATERIAL_POSTED now deep-links to the student detail page,
  // not the course root fallback.
  await expect(page).toHaveURL(
    new RegExp(`/student/courses/${courseId}/materials/[^/]+$`)
  );
  await expect(
    page.getByRole("heading", { name: title, level: 1 })
  ).toBeVisible();

  // 3) Cleanup.
  await db.material.deleteMany({
    where: { courseOfferingId: courseId, title },
  });
});
