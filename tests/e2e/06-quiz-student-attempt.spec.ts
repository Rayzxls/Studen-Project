import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;
let lessonId = "";
let quizId = "";

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
  const lesson = await db.lesson.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      title: "QA Student Quiz Lesson",
      description: "Isolated QA acceptance for a student Quiz attempt.",
      createdById: ctx.teacherUserId,
    },
    select: { id: true },
  });
  lessonId = lesson.id;
  const quiz = await db.quiz.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      lessonId,
      title: "QA Practice Quiz",
      description: "Choose the correct answer and submit.",
      mode: "PRACTICE",
      status: "OPEN",
      maxAttempts: 2,
      createdById: ctx.teacherUserId,
      questions: {
        create: {
          type: "SINGLE_CHOICE",
          prompt: "ข้อใดคือคำตอบที่ถูกต้อง",
          points: 1,
          position: 0,
          options: {
            create: [
              { text: "คำตอบที่ถูกต้อง", isCorrect: true, position: 0 },
              { text: "คำตอบที่ไม่ถูกต้อง", isCorrect: false, position: 1 },
            ],
          },
        },
      },
    },
    select: { id: true },
  });
  quizId = quiz.id;
});

test.beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({
    where: { id: { startsWith: "login:" } },
  });
});

test.afterAll(async () => {
  try {
    if (quizId) {
      await db.quizAttemptMutation.deleteMany({
        where: { attempt: { quizId } },
      });
      await db.quizAnswer.deleteMany({ where: { attempt: { quizId } } });
      await db.quizAttempt.deleteMany({ where: { quizId } });
      await db.quizOption.deleteMany({ where: { question: { quizId } } });
      await db.quizQuestion.deleteMany({ where: { quizId } });
      await db.quiz.deleteMany({ where: { id: quizId } });
    }
    await ctx?.cleanup();
  } finally {
    await db.$disconnect();
  }
});

test("student completes a Practice Quiz with autosave and visible score", async ({
  page,
}, testInfo) => {
  const courseId = ctx!.courseOfferingId;
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `${ctx!.prefix}_s1`, PASSWORD);
  await page.goto(`/student/courses/${courseId}/quizzes`);

  await expect(
    page.locator(`a[href="/student/courses/${courseId}/quizzes/${quizId}"]`)
  ).toBeVisible();
  await page
    .locator(`a[href="/student/courses/${courseId}/quizzes/${quizId}"]`)
    .click();

  const startForm = page.locator("form").filter({
    has: page.locator(`input[name="quizId"][value="${quizId}"]`),
  });
  await startForm.locator('button[type="submit"]').click();
  await page.waitForURL(
    new RegExp(`/student/courses/${courseId}/quizzes/${quizId}/attempts/[^/?]+`)
  );

  await page.getByRole("button").filter({ hasText: "คำตอบที่ถูกต้อง" }).click();
  await expect
    .poll(async () => {
      const attempt = await db.quizAttempt.findFirstOrThrow({
        where: { quizId, enrollment: { studentId: ctx!.studentUserId } },
        select: { writeRevision: true, _count: { select: { answers: true } } },
      });
      return {
        revision: attempt.writeRevision,
        answers: attempt._count.answers,
      };
    })
    .toEqual({ revision: 1, answers: 1 });

  await page.screenshot({
    path: testInfo.outputPath("student-quiz-attempt-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const attemptLayout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(attemptLayout.scrollWidth).toBeLessThanOrEqual(
    attemptLayout.viewportWidth
  );
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-attempt-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("button", { name: "ตรวจและส่ง" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "ยืนยันส่ง" }).click();
  await expect(page.getByText("ส่งคำตอบแล้ว")).toBeVisible();
  await expect(page.getByText("ได้ 1 จาก 1 คะแนน")).toBeVisible();

  await expect
    .poll(async () => {
      const attempt = await db.quizAttempt.findFirstOrThrow({
        where: { quizId, enrollment: { studentId: ctx!.studentUserId } },
        select: { status: true, finalScore: true, leaseTokenHash: true },
      });
      return attempt;
    })
    .toEqual({ status: "SUBMITTED", finalScore: 1, leaseTokenHash: null });

  await page.screenshot({
    path: testInfo.outputPath("student-quiz-result-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/student/courses/${courseId}/quizzes`);
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  await expect(page.getByText("1/1 คะแนน")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-list-mobile.png"),
    fullPage: true,
  });
});
