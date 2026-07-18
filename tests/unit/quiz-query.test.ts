import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    quiz: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
    },
  },
}));

import {
  getTeacherQuizDraft,
  getTeacherQuizResults,
  getTeacherQuizSummariesForLesson,
} from "@/lib/quiz/queries";

describe("Quiz teacher queries", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.findFirst.mockReset();
  });

  it("fails closed before querying an unlisted course", async () => {
    await expect(
      getTeacherQuizSummariesForLesson({
        courseOfferingId: "course-b",
        lessonId: "lesson-1",
        teacherId: "teacher-1",
        env: {
          QUIZ_ENABLED: "1",
          QUIZ_PILOT_COURSE_IDS: "course-a",
        },
      })
    ).rejects.toMatchObject({ code: "quiz_disabled" });

    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("returns a teacher-safe ordered draft projection", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "quiz-1",
      courseOfferingId: "course-a",
      lessonId: "lesson-1",
      title: "Checkpoint",
      description: null,
      mode: "PRACTICE",
      status: "DRAFT",
      required: false,
      opensAt: null,
      closesAt: null,
      timeLimitMinutes: null,
      maxAttempts: null,
      passThresholdPercent: null,
      shuffleQuestions: false,
      shuffleOptions: false,
      hideExplanations: false,
      revision: 1,
      lesson: { title: "Grammar", archivedAt: null },
      _count: { attempts: 0 },
      questions: [],
    });

    const result = await getTeacherQuizDraft({
      courseOfferingId: "course-a",
      quizId: "quiz-1",
      teacherId: "teacher-1",
      env: {
        QUIZ_ENABLED: "1",
        QUIZ_PILOT_COURSE_IDS: "course-a",
      },
    });

    expect(result).toMatchObject({
      id: "quiz-1",
      lessonTitle: "Grammar",
      attemptCount: 0,
      questions: [],
    });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseOfferingId: "course-a",
          course: { teacherId: "teacher-1", archivedAt: null },
        }),
      })
    );
  });

  it("summarizes best attempts and item analysis without exposing answers", async () => {
    const submittedAt = new Date("2026-07-18T02:10:00Z");
    mocks.findFirst.mockResolvedValue({
      id: "quiz-1",
      courseOfferingId: "course-a",
      lessonId: "lesson-1",
      title: "Checkpoint",
      mode: "SCORED",
      status: "CLOSED",
      closesAt: new Date("2026-07-18T02:00:00Z"),
      passThresholdPercent: 60,
      lesson: { title: "Grammar" },
      scoreItem: {
        publishedAt: new Date("2026-07-18T02:15:00Z"),
        entries: [
          { enrollmentId: "enrollment-1", value: 10 },
          { enrollmentId: "enrollment-2", value: 0 },
        ],
      },
      questions: [
        { id: "question-1", position: 0, prompt: "A?", points: 5 },
        { id: "question-2", position: 1, prompt: "B?", points: 5 },
      ],
      studentExceptions: [],
      course: {
        enrollments: [
          {
            id: "enrollment-1",
            studentId: "student-user-1",
            student: {
              studentId: "65001",
              firstName: "Ada",
              lastName: "Lovelace",
            },
          },
          {
            id: "enrollment-2",
            studentId: "student-user-2",
            student: {
              studentId: "65002",
              firstName: "Grace",
              lastName: "Hopper",
            },
          },
        ],
      },
      attempts: [
        {
          id: "attempt-low",
          enrollmentId: "enrollment-1",
          attemptNumber: 1,
          status: "SUBMITTED",
          startedAt: new Date("2026-07-18T01:00:00Z"),
          submittedAt: new Date("2026-07-18T01:05:00Z"),
          finalScore: 5,
          answers: [
            { questionId: "question-1", isCorrect: true },
            { questionId: "question-2", isCorrect: false },
          ],
        },
        {
          id: "attempt-best",
          enrollmentId: "enrollment-1",
          attemptNumber: 2,
          status: "AUTO_SUBMITTED",
          startedAt: new Date("2026-07-18T02:00:00Z"),
          submittedAt,
          finalScore: 10,
          answers: [
            { questionId: "question-1", isCorrect: true },
            { questionId: "question-2", isCorrect: true },
          ],
        },
      ],
    });

    const result = await getTeacherQuizResults({
      courseOfferingId: "course-a",
      quizId: "quiz-1",
      teacherId: "teacher-1",
      env: {
        QUIZ_ENABLED: "1",
        QUIZ_PILOT_COURSE_IDS: "course-a",
      },
    });

    expect(result.counts).toEqual({
      total: 2,
      notStarted: 1,
      inProgress: 0,
      submitted: 1,
    });
    expect(result.metrics).toMatchObject({
      average: 5,
      highest: 10,
      lowest: 0,
      passCount: 1,
      passRate: 50,
    });
    expect(result.students[0]).toMatchObject({
      name: "Ada Lovelace",
      bestScore: 10,
      status: "SUBMITTED",
    });
    expect(result.students[1]).toMatchObject({
      name: "Grace Hopper",
      bestScore: 0,
      status: "NOT_STARTED",
    });
    expect(result.questions).toEqual([
      expect.objectContaining({ id: "question-1", correctRate: 100 }),
      expect.objectContaining({ id: "question-2", correctRate: 100 }),
    ]);
    expect(result.students[0]).not.toHaveProperty("answers");
  });
});
