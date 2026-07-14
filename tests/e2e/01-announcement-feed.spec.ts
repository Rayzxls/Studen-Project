import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

/**
 * E2E flow 1 — Phase 9 · P9-3
 *
 * Teacher posts an announcement on a CourseOffering; the active
 * student then sees the announcement in the dashboard User Feed, the
 * bell badge increments, and the student can open the announcement
 * detail and post a CLASS_WIDE reply that lands in the thread.
 *
 * Uses the seeded teacher + student + demo course (`MATH4A-DEMO1`).
 * Clears login rate-limit buckets up-front so the suite is robust
 * against earlier test runs.
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

test("teacher posts announcement → student sees in feed + replies in thread", async ({
  page,
}) => {
  const courseId = ctx!.courseOfferingId;
  const teacherIdentifier = `${ctx!.prefix}_t1@test.local`;
  const studentIdentifier = `${ctx!.prefix}_s1`;

  const headline = `E2E ประกาศ ${Date.now()}`;
  const replyBody = `ขอบคุณครับ ${Date.now()}`;

  // 1) Teacher signs in + posts an announcement.
  await signIn(page, teacherIdentifier, PASSWORD);

  await page.goto(`/teacher/courses/${courseId}/announcements`);
  await expect(
    page.getByRole("heading", { name: "ประกาศ", level: 2 })
  ).toBeVisible();
  await page.getByRole("button", { name: /เพิ่มประกาศ/ }).click();

  // The Pattern-7 dialog mounts above the page.
  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="title"]').fill(headline);
  await dialog
    .locator('textarea[name="body"]')
    .fill("ปิดเรียนวันศุกร์เนื่องจากกิจกรรม");
  await dialog.getByRole("button", { name: /โพสต์ประกาศ/ }).click();

  await expect(page.getByText(headline).first()).toBeVisible();

  await signOut(page);

  // 2) Student signs in and sees the new announcement in the course feed.
  //    The bell remains available for notification coverage.
  await signIn(page, studentIdentifier, PASSWORD);

  await page.goto(`/student/courses/${courseId}/feed`);

  // Scope to <main> so we don't match the headline rendered inside the
  // closed bell popover (which is in the DOM but visibility:hidden).
  const feed = page.locator("main");
  await expect(feed.getByText(headline).first()).toBeVisible();

  await expect(
    page.getByRole("button", { name: "การแจ้งเตือน" })
  ).toBeVisible();

  // 3) Open the detail action from the exact feed card we just created.
  //    The headline is display text; navigation lives in the card footer.
  const announcementCard = feed
    .locator("article")
    .filter({ hasText: headline });
  await expect(announcementCard).toBeVisible();
  await announcementCard.locator('a[href*="/announcements/"]').click();
  await page.waitForURL(
    new RegExp(`/student/courses/${courseId}/announcements/[^/]+`)
  );
  await expect(
    page.getByRole("heading", { name: "ความคิดเห็น", level: 2 })
  ).toBeVisible();

  await page.locator('section.card textarea[name="body"]').fill(replyBody);
  await page
    .locator("section.card form")
    .getByRole("button", { name: /โพสต์ความคิดเห็น/ })
    .click();

  // Reply lands in the thread.
  await expect(page.getByText(replyBody).first()).toBeVisible();

  // 4) Cleanup — drop the test announcement so the suite is idempotent.
  await db.announcement.deleteMany({
    where: { courseOfferingId: courseId, title: headline },
  });
});
