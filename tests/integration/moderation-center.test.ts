// @vitest-environment node

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  appealModerationCase,
  applyModerationCaseAction,
  createModerationReport,
} from "@/lib/moderation/service";
import {
  getStudentQuizSummariesForCourse,
  startOrResumeQuizAttempt,
} from "@/lib/quiz";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./permissions/_fixtures";

describe("Moderation Center workflow", () => {
  let ctx: TestCourseContext;
  let adminUserId: string;
  let caseIds: string[] = [];

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    ctx = await setupTestCourse();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);

    const suffix = randomBytes(4).toString("hex");
    const admin = await db.user.create({
      data: {
        identifier: `${ctx.prefix}_moderator_${suffix}@test.local`,
        passwordHash: "integration-test-only",
        role: "ADMIN",
        admin: { create: { firstName: "QA", lastName: "Moderator" } },
      },
      select: { id: true },
    });
    adminUserId = admin.id;
  });

  afterEach(async () => {
    if (caseIds.length > 0) {
      await db.moderationCaseEvent.deleteMany({
        where: { caseId: { in: caseIds } },
      });
      await db.moderationReport.deleteMany({
        where: { caseId: { in: caseIds } },
      });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { targetType: "ModerationCase", targetId: { in: caseIds } },
            { actorId: adminUserId },
          ],
        },
      });
      await db.moderationCase.deleteMany({
        where: { id: { in: caseIds } },
      });
    }
    if (adminUserId) {
      await db.user.deleteMany({ where: { id: adminUserId } });
    }
    if (ctx) {
      await db.quizAttemptMutation.deleteMany({
        where: {
          attempt: { quiz: { courseOfferingId: ctx.courseOfferingId } },
        },
      });
      await db.quizAnswer.deleteMany({
        where: {
          attempt: { quiz: { courseOfferingId: ctx.courseOfferingId } },
        },
      });
      await db.quizAttempt.deleteMany({
        where: { quiz: { courseOfferingId: ctx.courseOfferingId } },
      });
      await db.quiz.deleteMany({
        where: { courseOfferingId: ctx.courseOfferingId },
      });
      await db.lesson.deleteMany({
        where: { courseOfferingId: ctx.courseOfferingId },
      });
      await ctx.cleanup();
    }
    caseIds = [];
  });

  it("aggregates reports, preserves evidence, restricts content and supports one appeal", async () => {
    const announcement = await db.announcement.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        title: "QA moderation announcement",
        body: "Evidence body captured before later edits.",
        linkUrls: ["https://example.com/evidence"],
        postedById: ctx.teacherUserId,
      },
      select: { id: true },
    });

    const first = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "ANNOUNCEMENT",
        targetId: announcement.id,
        category: "INAPPROPRIATE_CONTENT",
        details: "QA report from the first enrolled student.",
      },
      { enabled: true }
    );
    caseIds = [first.caseId];

    const duplicate = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "ANNOUNCEMENT",
        targetId: announcement.id,
        category: "SPAM",
        details: "This duplicate must not increment the case.",
      },
      { enabled: true }
    );
    const second = await createModerationReport(
      {
        actor: { userId: ctx.otherStudentUserId, role: "STUDENT" },
        targetType: "ANNOUNCEMENT",
        targetId: announcement.id,
        category: "PRIVACY",
        details: "QA report from another enrolled student.",
      },
      { enabled: true }
    );

    expect(duplicate).toMatchObject({
      caseId: first.caseId,
      duplicate: true,
      reportCount: 1,
    });
    expect(second).toMatchObject({
      caseId: first.caseId,
      duplicate: false,
      reportCount: 2,
    });

    await db.announcement.update({
      where: { id: announcement.id },
      data: { body: "Edited after the report." },
    });

    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: first.caseId,
        action: "START_REVIEW",
        internalReason: "QA moderator accepted the case for review.",
      },
      { enabled: true }
    );
    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: first.caseId,
        action: "HIDE",
        internalReason: "QA evidence requires temporary restriction.",
      },
      { enabled: true }
    );
    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: first.caseId,
        action: "RESOLVE",
        internalReason: "QA confirms the reported content violates policy.",
        userMessage: "เนื้อหาถูกจำกัดและสามารถยื่นอุทธรณ์ได้ภายใน 7 วัน",
      },
      { enabled: true }
    );

    const resolved = await db.moderationCase.findUniqueOrThrow({
      where: { id: first.caseId },
      select: {
        status: true,
        reportCount: true,
        restrictionKind: true,
        targetSnapshot: true,
        appealDeadline: true,
      },
    });
    expect(resolved).toMatchObject({
      status: "RESOLVED",
      reportCount: 2,
      restrictionKind: "HIDDEN",
      targetSnapshot: {
        title: "QA moderation announcement",
        body: "Evidence body captured before later edits.",
        linkUrls: ["https://example.com/evidence"],
        fileAttachmentIds: [],
      },
    });
    expect(resolved.appealDeadline).not.toBeNull();

    await appealModerationCase(
      {
        actor: { userId: ctx.teacherUserId, role: "TEACHER" },
        caseId: first.caseId,
        reason: "Please review the classroom context and attached evidence.",
      },
      { enabled: true }
    );

    const appealed = await db.moderationCase.findUniqueOrThrow({
      where: { id: first.caseId },
      select: { status: true, appealUsed: true, activeKey: true },
    });
    const reports = await db.moderationReport.count({
      where: { caseId: first.caseId },
    });
    const events = await db.moderationCaseEvent.findMany({
      where: { caseId: first.caseId },
      orderBy: { createdAt: "asc" },
      select: { type: true },
    });
    const auditCount = await db.auditLog.count({
      where: { targetType: "ModerationCase", targetId: first.caseId },
    });

    expect(appealed.status).toBe("APPEALED");
    expect(appealed.appealUsed).toBe(true);
    expect(appealed.activeKey).toBe(`ANNOUNCEMENT:${announcement.id}`);
    expect(reports).toBe(2);
    expect(events.map((event) => event.type)).toEqual([
      "REPORT_ADDED",
      "REPORT_ADDED",
      "REVIEW_STARTED",
      "TEMPORARILY_RESTRICTED",
      "RESOLVED",
      "APPEAL_SUBMITTED",
    ]);
    expect(auditCount).toBe(6);
  });

  it("captures Quiz evidence without answers, grading or correct-option secrets", async () => {
    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: {
        studentId_courseOfferingId: {
          studentId: ctx.studentUserId,
          courseOfferingId: ctx.courseOfferingId,
        },
      },
      select: { id: true },
    });
    const lesson = await db.lesson.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        title: "Moderation Quiz lesson",
        description: "QA only",
        createdById: ctx.teacherUserId,
      },
      select: { id: true },
    });
    const quiz = await db.quiz.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        lessonId: lesson.id,
        title: "Safety checkpoint",
        description: "Teacher-authored Quiz details",
        mode: "PRACTICE",
        status: "OPEN",
        createdById: ctx.teacherUserId,
        questions: {
          create: {
            type: "SINGLE_CHOICE",
            prompt: "Current source prompt",
            explanation: "Teacher-only explanation",
            points: 5,
            position: 0,
            options: {
              create: [
                { text: "Visible option A", isCorrect: true, position: 0 },
                { text: "Visible option B", isCorrect: false, position: 1 },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        questions: { select: { id: true, options: { select: { id: true } } } },
      },
    });
    const question = quiz.questions[0];
    expect(question).toBeDefined();
    const optionIds = question!.options.map((option) => option.id);

    const attempt = await db.quizAttempt.create({
      data: {
        quizId: quiz.id,
        enrollmentId: enrollment.id,
        attemptNumber: 1,
        status: "SUBMITTED",
        submittedAt: new Date(),
        submissionTrigger: "MANUAL",
        snapshotRevision: 1,
        autoScore: 5,
        finalScore: 5,
        snapshotJson: {
          quizId: quiz.id,
          revision: 1,
          title: "Safety checkpoint",
          description: "Teacher-authored Quiz details",
          mode: "PRACTICE",
          hideExplanations: false,
          totalPoints: 5,
          attachments: [],
          questions: [
            {
              id: question!.id,
              type: "SINGLE_CHOICE",
              prompt: "Prompt the student actually saw",
              explanation: "Must not enter moderation evidence",
              points: 5,
              attachments: [
                {
                  id: "captured-private-file",
                  originalFilename: "question.png",
                  mimeType: "image/png",
                  sizeBytes: 321,
                },
              ],
              options: [
                {
                  id: optionIds[0],
                  text: "Snapshot option A",
                  isCorrect: true,
                  attachments: [],
                },
                {
                  id: optionIds[1],
                  text: "Snapshot option B",
                  isCorrect: false,
                  attachments: [],
                },
              ],
            },
          ],
        },
        answers: {
          create: {
            questionId: question!.id,
            answerJson: { selectedOptionIds: [optionIds[0]] },
            isCorrect: true,
            awardedPoints: 5,
          },
        },
      },
      select: { id: true },
    });

    await db.quizQuestion.update({
      where: { id: question!.id },
      data: { prompt: "Edited after attempt snapshot" },
    });

    const quizReport = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "QUIZ",
        targetId: quiz.id,
        category: "INAPPROPRIATE_CONTENT",
        details: "Report the complete Quiz without exposing answer secrets.",
      },
      { enabled: true }
    );
    const questionReport = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "QUIZ_QUESTION",
        targetId: question!.id,
        category: "PRIVACY",
        details: "Report the exact question snapshot shown in my Attempt.",
      },
      { enabled: true }
    );
    caseIds = [quizReport.caseId, questionReport.caseId];

    const cases = await db.moderationCase.findMany({
      where: { id: { in: caseIds } },
      select: { targetType: true, ownerUserId: true, targetSnapshot: true },
    });
    const quizCase = cases.find((item) => item.targetType === "QUIZ");
    const questionCase = cases.find(
      (item) => item.targetType === "QUIZ_QUESTION"
    );
    expect(quizCase?.ownerUserId).toBe(ctx.teacherUserId);
    expect(quizCase?.targetSnapshot).toMatchObject({
      kind: "QUIZ",
      title: "Safety checkpoint",
      questions: [
        expect.objectContaining({
          prompt: "Edited after attempt snapshot",
          options: [
            expect.objectContaining({ text: "Visible option A" }),
            expect.objectContaining({ text: "Visible option B" }),
          ],
        }),
      ],
    });
    expect(questionCase?.targetSnapshot).toMatchObject({
      kind: "QUIZ_QUESTION",
      fileAttachmentIds: ["captured-private-file"],
      questions: [
        expect.objectContaining({
          prompt: "Prompt the student actually saw",
          options: [
            expect.objectContaining({ text: "Snapshot option A" }),
            expect.objectContaining({ text: "Snapshot option B" }),
          ],
        }),
      ],
    });

    const evidenceText = JSON.stringify(cases);
    expect(evidenceText).not.toContain("isCorrect");
    expect(evidenceText).not.toContain("Teacher-only explanation");
    expect(evidenceText).not.toContain("Must not enter moderation evidence");
    expect(evidenceText).not.toContain("finalScore");
    expect(evidenceText).not.toContain("selectedOptionIds");

    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: quizReport.caseId,
        action: "START_REVIEW",
        internalReason: "Review the reported Quiz before restricting access.",
      },
      { enabled: true }
    );
    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: quizReport.caseId,
        action: "HIDE",
        internalReason: "Temporarily hide this Quiz during safety review.",
      },
      { enabled: true }
    );

    const previousModerationFlag = process.env.MODERATION_CENTER_ENABLED;
    process.env.MODERATION_CENTER_ENABLED = "1";
    try {
      await expect(
        getStudentQuizSummariesForCourse({
          courseOfferingId: ctx.courseOfferingId,
          studentId: ctx.studentUserId,
          env: {
            QUIZ_ENABLED: "1",
            QUIZ_PILOT_COURSE_IDS: ctx.courseOfferingId,
          },
        })
      ).resolves.toEqual([]);
      await expect(
        startOrResumeQuizAttempt(
          { courseOfferingId: ctx.courseOfferingId, quizId: quiz.id },
          {
            studentUserId: ctx.studentUserId,
            env: {
              QUIZ_ENABLED: "1",
              QUIZ_MUTATIONS_ENABLED: "1",
              QUIZ_PILOT_COURSE_IDS: ctx.courseOfferingId,
            },
          }
        )
      ).rejects.toMatchObject({ code: "quiz_not_found" });
      await expect(
        db.quizAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
          select: {
            status: true,
            finalScore: true,
            answers: {
              select: {
                answerJson: true,
                isCorrect: true,
                awardedPoints: true,
              },
            },
          },
        })
      ).resolves.toMatchObject({
        status: "SUBMITTED",
        finalScore: 5,
        answers: [
          {
            answerJson: { selectedOptionIds: [optionIds[0]] },
            isCorrect: true,
            awardedPoints: 5,
          },
        ],
      });
    } finally {
      if (previousModerationFlag === undefined) {
        delete process.env.MODERATION_CENTER_ENABLED;
      } else {
        process.env.MODERATION_CENTER_ENABLED = previousModerationFlag;
      }
    }

    await expect(
      createModerationReport(
        {
          actor: { userId: ctx.otherStudentUserId, role: "STUDENT" },
          targetType: "QUIZ_QUESTION",
          targetId: question!.id,
          category: "OTHER",
          details: "I did not receive this question in an Attempt snapshot.",
        },
        { enabled: true }
      )
    ).rejects.toMatchObject({ code: "moderation_target_not_found" });
  });
});
