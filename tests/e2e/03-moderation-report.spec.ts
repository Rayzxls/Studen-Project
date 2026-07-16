import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;
let adminUserId = "";
let adminIdentifier = "";
let lessonId = "";
let assignmentId = "";
let assignmentTitle = "";
let caseId = "";

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
  await db.user.update({
    where: { id: ctx.studentUserId },
    data: { themeMode: "CREAM" },
  });

  const passwordHash = await hashPassword(PASSWORD);
  adminIdentifier = `${ctx.prefix}_admin@test.local`;
  const admin = await db.user.create({
    data: {
      identifier: adminIdentifier,
      passwordHash,
      role: "ADMIN",
      themeMode: "DARK",
      admin: { create: { firstName: "QA", lastName: "Moderator" } },
    },
    select: { id: true },
  });
  adminUserId = admin.id;

  const lesson = await db.lesson.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      title: "QA Moderation Lesson",
      description: "Lesson used to verify report controls and Admin evidence.",
      createdById: ctx.teacherUserId,
    },
    select: { id: true },
  });
  lessonId = lesson.id;

  await db.material.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      lessonId,
      title: "QA reportable material",
      body: "Material evidence for Moderation QA.",
      postedById: ctx.teacherUserId,
    },
  });

  assignmentTitle = `QA reportable assignment ${Date.now()}`;
  const assignment = await db.assignment.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      lessonId,
      title: assignmentTitle,
      description: "Assignment evidence for Moderation QA.",
      createdById: ctx.teacherUserId,
    },
    select: { id: true },
  });
  assignmentId = assignment.id;
});

test.beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({
    where: { id: { startsWith: "login:" } },
  });
});

test.afterAll(async () => {
  try {
    if (caseId) {
      await db.moderationCaseEvent.deleteMany({ where: { caseId } });
      await db.moderationReport.deleteMany({ where: { caseId } });
      await db.auditLog.deleteMany({
        where: { targetType: "ModerationCase", targetId: caseId },
      });
      await db.moderationCase.deleteMany({ where: { id: caseId } });
    }
    if (adminUserId) {
      await db.auditLog.deleteMany({ where: { actorId: adminUserId } });
      await db.user.deleteMany({ where: { id: adminUserId } });
    }
    await ctx?.cleanup();
  } finally {
    await db.$disconnect();
  }
});

test("student reports a Lesson checkpoint and Admin receives its evidence", async ({
  page,
}) => {
  const courseId = ctx!.courseOfferingId;
  const studentIdentifier = `${ctx!.prefix}_s1`;

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, studentIdentifier, PASSWORD);
  await page.goto(`/student/courses/${courseId}/lessons/${lessonId}`);

  const assignmentRow = page.locator(`#assignment-${assignmentId}`);
  await expect(assignmentRow).toBeVisible();
  await expect(
    assignmentRow.getByRole("button", { name: "รายงานเนื้อหา" })
  ).toBeVisible();
  const mobileLayout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(
      document.querySelectorAll<HTMLElement>("body *")
    )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12);

    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });
  expect(
    mobileLayout.scrollWidth,
    `Mobile layout overflow: ${JSON.stringify(mobileLayout.offenders)}`
  ).toBeLessThanOrEqual(mobileLayout.viewportWidth);

  await assignmentRow.getByRole("button", { name: "รายงานเนื้อหา" }).click();
  const dialog = page.getByRole("dialog", { name: "รายงานเนื้อหา" });
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="category"]').selectOption("OTHER");
  await dialog
    .locator('textarea[name="details"]')
    .fill("QA ตรวจสอบการส่งรายงานจาก Student Lesson checkpoint");
  await dialog.getByRole("button", { name: "ส่งรายงาน" }).click();
  await expect(dialog.getByText("ส่งรายงานให้ผู้ดูแลแล้ว")).toBeVisible();
  await expect(dialog).toBeHidden();

  const moderationCase = await db.moderationCase.findUniqueOrThrow({
    where: { activeKey: `ASSIGNMENT:${assignmentId}` },
    select: { id: true, reportCount: true, targetLabel: true },
  });
  caseId = moderationCase.id;
  expect(moderationCase).toMatchObject({
    reportCount: 1,
    targetLabel: assignmentTitle,
  });

  await signOut(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, adminIdentifier, PASSWORD);
  await page.goto("/admin/moderation");
  const queueItem = page.getByRole("link", {
    name: new RegExp(assignmentTitle),
  });
  await expect(queueItem).toBeVisible();
  await queueItem.click();
  await expect(page.getByText("หลักฐาน ณ เวลาที่รับรายงาน")).toBeVisible();
  await expect(page.getByText(assignmentTitle).first()).toBeVisible();
});
