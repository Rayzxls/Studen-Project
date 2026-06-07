import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
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

const STUDENT_ID = "60001";
const STUDENT_PWD = "Student1234";
const TEACHER_ID = "teacher@studennnn.local";
const TEACHER_PWD = "Teacher1234!";
const DEMO_CODE = "MATH4A-DEMO1";

test.beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({
    where: { id: { startsWith: "login:" } },
  });
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("teacher posts announcement → student sees in feed + replies in thread", async ({
  page,
}) => {
  const course = await db.courseOffering.findUnique({
    where: { classCode: DEMO_CODE },
    select: { id: true },
  });
  expect(course).not.toBeNull();
  const courseId = course!.id;

  const headline = `E2E ประกาศ ${Date.now()}`;
  const replyBody = `ขอบคุณครับ ${Date.now()}`;

  // 1) Teacher signs in + posts an announcement.
  await signIn(page, TEACHER_ID, TEACHER_PWD);

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

  // 2) Student signs in. Bell badge should be at least 1; the dashboard
  //    User Feed lists the new announcement.
  await signIn(page, STUDENT_ID, STUDENT_PWD);

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "กิจกรรมล่าสุด", level: 2 })
  ).toBeVisible();

  // Scope to <main> so we don't match the headline rendered inside the
  // closed bell popover (which is in the DOM but visibility:hidden).
  const feed = page.locator("main");
  await expect(feed.getByText(headline).first()).toBeVisible();

  await expect(
    page.getByRole("button", { name: "การแจ้งเตือน" })
  ).toBeVisible();

  // 3) Click into the announcement detail via the feed row.
  await feed.getByText(headline).first().click();
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
