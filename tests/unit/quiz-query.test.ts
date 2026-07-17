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
});
