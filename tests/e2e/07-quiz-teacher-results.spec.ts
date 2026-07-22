import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "../integration/permissions/_fixtures";
import { signIn, signOut } from "./helpers";

const db = new PrismaClient();
const PASSWORD = "Test1234!";

let ctx: TestCourseContext | undefined;
let lessonId = "";
let quizId = "";
let scoreItemId = "";
let submittedEnrollmentId = "";
let missingEnrollmentId = "";

test.beforeAll(async () => {
  ctx = await setupTestCourse();
  const [submittedEnrollment, missingEnrollment] = await Promise.all([
    enrollStudent(ctx.courseOfferingId, ctx.studentUserId),
    enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId),
  ]);
  submittedEnrollmentId = submittedEnrollment.id;
  missingEnrollmentId = missingEnrollment.id;

  const lesson = await db.lesson.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      title: "QA Quiz Results Lesson",
      description: "Isolated QA acceptance for the teacher results workflow.",
      createdById: ctx.teacherUserId,
    },
    select: { id: true },
  });
  lessonId = lesson.id;

  const scoreItem = await db.scoreItem.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      name: "QA Scored Quiz Results",
      fullScore: 2,
      source: "QUIZ_LINKED",
    },
    select: { id: true },
  });
  scoreItemId = scoreItem.id;

  const quiz = await db.quiz.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      lessonId,
      scoreItemId,
      title: "QA Scored Quiz Results",
      description: "Close, reopen, grant an exception, and publish.",
      mode: "SCORED",
      status: "OPEN",
      maxAttempts: 2,
      passThresholdPercent: 50,
      closesAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      createdById: ctx.teacherUserId,
      questions: {
        create: {
          type: "SINGLE_CHOICE",
          prompt: "Which answer is correct?",
          points: 2,
          position: 0,
          options: {
            create: [
              { text: "Correct", isCorrect: true, position: 0 },
              { text: "Incorrect", isCorrect: false, position: 1 },
            ],
          },
        },
      },
    },
    include: { questions: { include: { options: true } } },
  });
  quizId = quiz.id;

  const question = quiz.questions[0];
  const correct = question.options.find((option) => option.isCorrect)!;
  const startedAt = new Date(Date.now() - 5 * 60 * 1_000);
  const submittedAt = new Date(Date.now() - 2 * 60 * 1_000);
  const attempt = await db.quizAttempt.create({
    data: {
      quizId,
      enrollmentId: submittedEnrollmentId,
      attemptNumber: 1,
      status: "SUBMITTED",
      startedAt,
      submittedAt,
      submissionTrigger: "MANUAL",
      snapshotRevision: 1,
      snapshotJson: {
        quizId,
        revision: 1,
        title: quiz.title,
        description: quiz.description,
        mode: "SCORED",
        hideExplanations: false,
        totalPoints: 2,
        questions: [],
      },
      autoScore: 2,
      finalScore: 2,
      leaseTokenHash: null,
      leaseExpiresAt: null,
    },
    select: { id: true },
  });
  await Promise.all([
    db.quizAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        answerJson: { selectedOptionIds: [correct.id] },
        isCorrect: true,
        awardedPoints: 2,
      },
    }),
    db.scoreEntry.create({
      data: {
        scoreItemId,
        enrollmentId: submittedEnrollmentId,
        value: 2,
        markedById: ctx.teacherUserId,
      },
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
    if (quizId) {
      await db.quizStudentException.deleteMany({ where: { quizId } });
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

test("teacher manages Quiz results and publishes explicit zero scores", async ({
  page,
}, testInfo) => {
  const courseId = ctx!.courseOfferingId;
  const resultUrl = `/teacher/courses/${courseId}/quizzes/${quizId}/results`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `${ctx!.prefix}_t1@test.local`, PASSWORD);
  await page.goto(resultUrl);

  await expect(
    page.getByRole("heading", { name: "QA Scored Quiz Results" })
  ).toBeVisible();
  await expect(
    page.locator(`article:has-text("${ctx!.prefix}_s1")`)
  ).toBeVisible();
  await expect(
    page.locator(`article:has-text("${ctx!.prefix}_s2")`)
  ).toBeVisible();

  const missingStudent = page.locator(`article:has-text("${ctx!.prefix}_s2")`);
  await missingStudent.locator("summary").last().click();
  const exceptionForm = missingStudent.locator(
    `form:has(input[name="enrollmentId"][value="${missingEnrollmentId}"])`
  );
  await exceptionForm
    .locator('input[name="extendedDeadline"]')
    .fill(toDateTimeLocal(new Date(Date.now() + 48 * 60 * 60 * 1_000)));
  await exceptionForm.locator('input[name="extraAttempts"]').fill("1");
  await exceptionForm
    .locator('textarea[name="reason"]')
    .fill("QA approved accommodation");
  await exceptionForm.locator('button[type="submit"]').click();
  await expect
    .poll(() => db.quizStudentException.count({ where: { quizId } }))
    .toBe(1);
  await expect
    .poll(() =>
      db.notification.count({
        where: {
          recipientId: ctx!.otherStudentUserId,
          kind: "QUIZ_EXCEPTION_GRANTED",
          sourceEntityId: quizId,
        },
      })
    )
    .toBe(1);

  await closeQuizFromResults(page, quizId);
  await expect
    .poll(
      async () =>
        (
          await db.quiz.findUniqueOrThrow({
            where: { id: quizId },
            select: { status: true },
          })
        ).status
    )
    .toBe("CLOSED");

  const reopenDetails = page.locator("details").filter({
    has: page.locator("svg.lucide-rotate-ccw"),
  });
  await reopenDetails.locator("summary").click();
  const reopenForm = reopenDetails.locator("form");
  await reopenForm
    .locator('input[name="newClosesAt"]')
    .fill(toDateTimeLocal(new Date(Date.now() + 72 * 60 * 60 * 1_000)));
  await reopenForm
    .locator('textarea[name="reason"]')
    .fill("QA reopen validation");
  await reopenForm.locator('button[type="submit"]').click();
  await expect
    .poll(
      async () =>
        (
          await db.quiz.findUniqueOrThrow({
            where: { id: quizId },
            select: { status: true },
          })
        ).status
    )
    .toBe("OPEN");
  await expect
    .poll(() =>
      db.notification.count({
        where: { kind: "QUIZ_REOPENED", sourceEntityId: quizId },
      })
    )
    .toBe(2);

  await closeQuizFromResults(page, quizId);
  const publishForm = page.locator("form").filter({
    has: page.locator("svg.lucide-send"),
  });
  await publishForm.locator('input[name="missingStudentsConfirmed"]').check();
  await publishForm.locator('button[type="submit"]').click();

  await expect
    .poll(async () => {
      const [item, missingScore] = await Promise.all([
        db.scoreItem.findUniqueOrThrow({
          where: { id: scoreItemId },
          select: { publishedAt: true },
        }),
        db.scoreEntry.findUnique({
          where: {
            scoreItemId_enrollmentId: {
              scoreItemId,
              enrollmentId: missingEnrollmentId,
            },
          },
          select: { value: true },
        }),
      ]);
      return { published: item.publishedAt !== null, missingScore };
    })
    .toEqual({ published: true, missingScore: { value: 0 } });

  await expect(
    page.locator("section.grid").getByText("1/2", { exact: true })
  ).toBeVisible();
  await expect(
    page
      .locator('article:has-text("Bob Tester")')
      .getByText("0/2", { exact: true })
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("teacher-quiz-results-published-desktop.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  await page.screenshot({
    path: testInfo.outputPath("teacher-quiz-results-published-mobile.png"),
    fullPage: true,
    caret: "initial",
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await signOut(page);
  await signIn(page, `${ctx!.prefix}_s2`, PASSWORD);
  await page.goto(`/student/courses/${courseId}/scores`);
  await expect(
    page.getByText("QA Scored Quiz Results", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("0 / 2", { exact: true })).toBeVisible();
});

async function closeQuizFromResults(
  page: import("@playwright/test").Page,
  expectedQuizId: string
) {
  const closeForm = page.locator("form").filter({
    has: page.locator(
      `input[name="quizId"][value="${expectedQuizId}"] ~ button svg.lucide-square`
    ),
  });
  if ((await closeForm.count()) === 0) {
    await page
      .locator("form")
      .filter({ has: page.locator("svg.lucide-square") })
      .locator('button[type="submit"]')
      .click();
    return;
  }
  await closeForm.locator('button[type="submit"]').click();
}

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
