import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;
let lessonId = "";

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  const lesson = await db.lesson.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      title: "QA Quiz Builder Lesson",
      description: "Isolated QA acceptance for Teacher Quiz drafts.",
      createdById: ctx.teacherUserId,
    },
    select: { id: true },
  });
  lessonId = lesson.id;
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

test("teacher creates, auto-saves, scores, and previews a Quiz draft", async ({
  page,
}, testInfo) => {
  const courseId = ctx!.courseOfferingId;
  const teacherIdentifier = `${ctx!.prefix}_t1@test.local`;
  const quizTitle = `QA Quiz ${Date.now()}`;
  const questionPrompt = "ข้อใดเป็นคำตอบสำหรับ Quiz QA";

  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, teacherIdentifier, PASSWORD);
  await page.goto(`/teacher/courses/${courseId}/lessons/${lessonId}`);

  const newQuizLink = page.locator(
    `a[href="/teacher/courses/${courseId}/lessons/${lessonId}/quizzes/new"]`
  );
  await expect(newQuizLink).toBeVisible();
  await newQuizLink.click();

  const builder = page.locator("form").filter({
    has: page.locator('input[name="payload"]'),
  });
  await expect(builder).toBeVisible();
  await page.locator('input[aria-label="ชื่อแบบทดสอบ"]').fill(quizTitle);
  await builder.locator("main textarea").first().fill(questionPrompt);
  const optionInputs = builder.locator('main input[placeholder^="ตัวเลือก"]');
  await optionInputs.nth(0).fill("คำตอบที่ถูก");
  await optionInputs.nth(1).fill("คำตอบที่ไม่ถูก");
  await builder.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();

  await page.waitForURL(
    new RegExp(`/teacher/courses/${courseId}/quizzes/[^/?]+`)
  );
  const quiz = await db.quiz.findFirstOrThrow({
    where: { courseOfferingId: courseId, title: quizTitle },
    select: {
      id: true,
      mode: true,
      scoreItemId: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });
  expect(quiz).toMatchObject({
    mode: "PRACTICE",
    scoreItemId: null,
    _count: { questions: 1, attempts: 0 },
  });

  const description = page
    .locator("label")
    .filter({ hasText: "คำอธิบายแบบทดสอบ" })
    .locator("textarea");
  await description.fill("รายละเอียดที่บันทึกผ่าน autosave");
  await expect(page.getByText("บันทึกอัตโนมัติแล้ว")).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(
      async () =>
        (
          await db.quiz.findUniqueOrThrow({
            where: { id: quiz.id },
            select: { description: true },
          })
        ).description
    )
    .toBe("รายละเอียดที่บันทึกผ่าน autosave");

  await page.getByRole("button", { name: "มีคะแนน", exact: true }).click();
  await expect
    .poll(async () => {
      const row = await db.quiz.findUniqueOrThrow({
        where: { id: quiz.id },
        select: { mode: true, scoreItemId: true },
      });
      return `${row.mode}:${row.scoreItemId ? "linked" : "missing"}`;
    })
    .toBe("SCORED:linked");

  await page.getByTitle("ทำสำเนา").click();
  await expect
    .poll(async () => {
      const row = await db.quiz.findUniqueOrThrow({
        where: { id: quiz.id },
        select: {
          _count: { select: { questions: true } },
          scoreItem: { select: { fullScore: true } },
        },
      });
      return {
        questions: row._count.questions,
        fullScore: row.scoreItem?.fullScore ?? null,
      };
    })
    .toEqual({ questions: 2, fullScore: 2 });

  await page.screenshot({
    path: testInfo.outputPath("quiz-builder-desktop.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.getByRole("button", { name: "ดูตัวอย่าง" }).click();
  await expect(page.getByText("ตัวอย่างสำหรับนักเรียน")).toBeVisible();
  await expect(page.getByText(questionPrompt).first()).toBeVisible();
  await expect
    .poll(async () => db.quizAttempt.count({ where: { quizId: quiz.id } }))
    .toBe(0);

  await page.getByRole("link", { name: "ดูเต็มหน้า" }).click();
  await page.waitForURL(
    `/teacher/courses/${courseId}/quizzes/${quiz.id}/preview`
  );
  await expect(page.getByText(quizTitle).first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/teacher/courses/${courseId}/quizzes/${quiz.id}`);
  await expect(page.locator('input[aria-label="ชื่อแบบทดสอบ"]')).toBeVisible();
  const mobileLayout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(
    mobileLayout.viewportWidth
  );
  await page.screenshot({
    path: testInfo.outputPath("quiz-builder-mobile.png"),
    fullPage: true,
    caret: "initial",
  });
});
