import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { regenerateClassCode } from "@/lib/course/class-code";
import { removeMember } from "@/lib/course/enrollment";
import {
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await Promise.all([
    db.user.update({
      where: { id: ctx.teacherUserId },
      data: { themeMode: "DARK" },
    }),
    db.user.update({
      where: { id: ctx.studentUserId },
      data: { themeMode: "CREAM" },
    }),
  ]);
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

test("teacher hands off an invite and students can join or rejoin on mobile", async ({
  page,
}) => {
  const courseId = ctx!.courseOfferingId;
  const teacherIdentifier = `${ctx!.prefix}_t1@test.local`;
  const studentIdentifier = `${ctx!.prefix}_s1`;
  const inviteUrl = `http://localhost:3100/join?code=${encodeURIComponent(ctx!.classCode)}`;

  await signIn(page, teacherIdentifier, PASSWORD);
  await page.goto(`/teacher/courses/${courseId}/settings`);

  const inviteCard = page.getByTestId("class-invite-card");
  await expect(inviteCard).toBeVisible();
  await expect(inviteCard.getByTestId("class-invite-qr")).toBeVisible();
  await expect(inviteCard.getByTestId("class-invite-code")).toHaveText(
    ctx!.classCode
  );
  await expect(inviteCard.getByTestId("class-invite-url")).toHaveText(
    inviteUrl
  );
  await expect(inviteCard.getByText("พร้อมเข้าร่วม")).toBeVisible();

  await signOut(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, studentIdentifier, PASSWORD);
  await page.goto(inviteUrl);

  await expect(page.locator('input[name="code"], input#code')).toHaveValue(
    ctx!.classCode
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "เข้าร่วมห้องเรียน" }).click();
  await expect(page.getByText("เข้าห้องเรียนสำเร็จ")).toBeVisible();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
  await expect(
    page.getByRole("link", {
      name: new RegExp(`Test Course ${ctx!.prefix}`),
    })
  ).toBeVisible();

  const enrollment = await db.enrollment.findFirstOrThrow({
    where: {
      courseOfferingId: courseId,
      studentId: ctx!.studentUserId,
      removedAt: null,
    },
    select: { id: true },
  });
  await removeMember({
    enrollmentId: enrollment.id,
    actorUserId: ctx!.teacherUserId,
    actorRole: "TEACHER",
    reason: "QA invite rejoin acceptance",
  });

  await page.goto(inviteUrl);
  await page.getByRole("button", { name: "เข้าร่วมห้องเรียน" }).click();
  await expect(page.getByText("เข้าห้องเรียนสำเร็จ")).toBeVisible();
  const restored = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollment.id },
    select: { removedAt: true },
  });
  expect(restored.removedAt).toBeNull();

  await page.goto(`/student/courses/${courseId}/feed`);
  await expect(page.getByTestId("class-invite-card")).toHaveCount(0);
  await expect(page.getByText("สร้างรหัสใหม่")).toHaveCount(0);
});

test("expired, disabled, and regenerated codes fail closed before a fresh join", async ({
  page,
}) => {
  const courseId = ctx!.courseOfferingId;
  const studentIdentifier = `${ctx!.prefix}_s2`;
  const oldCode = ctx!.classCode;

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, studentIdentifier, PASSWORD);

  await db.courseOffering.update({
    where: { id: courseId },
    data: { codeExpiresAt: new Date(Date.now() - 60_000) },
  });
  await page.goto(`/join?code=${encodeURIComponent(oldCode)}`);
  await page.getByRole("button", { name: "เข้าร่วมห้องเรียน" }).click();
  await expect(page.getByText("รหัสห้องเรียนนี้หมดอายุแล้ว")).toBeVisible();

  await db.courseOffering.update({
    where: { id: courseId },
    data: { codeExpiresAt: null, codeActive: false },
  });
  await page.getByRole("button", { name: "เข้าร่วมห้องเรียน" }).click();
  await expect(
    page.getByText("รหัสห้องเรียนนี้ถูกปิดใช้งานแล้ว")
  ).toBeVisible();

  await db.courseOffering.update({
    where: { id: courseId },
    data: { codeActive: true },
  });
  const { classCode: newCode } = await regenerateClassCode({
    courseOfferingId: courseId,
    actorUserId: ctx!.teacherUserId,
  });

  await page.getByRole("button", { name: "เข้าร่วมห้องเรียน" }).click();
  await expect(
    page.getByText("ไม่พบรหัสห้องเรียนนี้ ตรวจสอบรหัสอีกครั้ง")
  ).toBeVisible();

  await page.locator("input#code").fill(newCode);
  await page.getByRole("button", { name: "เข้าร่วมห้องเรียน" }).click();
  await expect(page.getByText("เข้าห้องเรียนสำเร็จ")).toBeVisible();
});
