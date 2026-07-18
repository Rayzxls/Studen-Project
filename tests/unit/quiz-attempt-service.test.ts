import { describe, expect, it, vi } from "vitest";
import {
  getStudentQuizAttempt,
  hashLeaseToken,
  saveQuizAttemptAnswer,
  startOrResumeQuizAttempt,
  submitQuizAttempt,
  type QuizAttemptRepository,
  type StudentQuizAttemptView,
} from "@/lib/quiz/attempt-service";

const enabledEnv = {
  QUIZ_ENABLED: "1",
  QUIZ_MUTATIONS_ENABLED: "1",
  QUIZ_PILOT_COURSE_IDS: "course-1",
};

const view = {
  id: "attempt-1",
  quizId: "quiz-1",
  courseOfferingId: "course-1",
  lessonId: "lesson-1",
  lessonTitle: "บทนำ",
  attemptNumber: 1,
  status: "IN_PROGRESS",
  startedAt: new Date(),
  effectiveDeadline: null,
  submittedAt: null,
  autoScore: null,
  finalScore: null,
  leaseVersion: 1,
  writeRevision: 0,
  writable: true,
  scoreVisible: false,
  snapshot: {
    quizId: "quiz-1",
    revision: 1,
    title: "Quiz",
    description: null,
    mode: "PRACTICE",
    hideExplanations: false,
    totalPoints: 1,
    questions: [],
  },
  answers: {},
} satisfies StudentQuizAttemptView;

function repository(): QuizAttemptRepository {
  return {
    startOrResume: vi.fn().mockResolvedValue({
      attemptId: "attempt-1",
      leaseVersion: 1,
    }),
    saveAnswer: vi.fn().mockResolvedValue({
      revision: 1,
      selectedOptionIds: ["option-1"],
    }),
    submit: vi.fn().mockResolvedValue({
      status: "SUBMITTED",
      score: 1,
      scoreVisible: true,
    }),
    getAttempt: vi.fn().mockResolvedValue(view),
  };
}

describe("Quiz Attempt service", () => {
  it("fails closed before creating an Attempt", async () => {
    const repo = repository();
    await expect(
      startOrResumeQuizAttempt(
        { courseOfferingId: "course-1", quizId: "quiz-1" },
        { studentUserId: "student-1", repository: repo, env: {} }
      )
    ).rejects.toMatchObject({ code: "quiz_mutations_disabled" });
    expect(repo.startOrResume).not.toHaveBeenCalled();
  });

  it("never sends the raw lease token to persistence", async () => {
    const repo = repository();
    const result = await startOrResumeQuizAttempt(
      { courseOfferingId: "course-1", quizId: "quiz-1" },
      {
        studentUserId: "student-1",
        repository: repo,
        env: enabledEnv,
        leaseTokenFactory: () => "raw-secret",
        now: new Date("2026-07-18T01:00:00Z"),
      }
    );
    expect(result.leaseToken).toBe("raw-secret");
    expect(repo.startOrResume).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseTokenHash: hashLeaseToken("raw-secret"),
      })
    );
    expect(repo.startOrResume).not.toHaveBeenCalledWith(
      expect.objectContaining({ leaseTokenHash: "raw-secret" })
    );
  });

  it("validates and forwards autosave concurrency fields", async () => {
    const repo = repository();
    await saveQuizAttemptAnswer(
      {
        courseOfferingId: "course-1",
        attemptId: "attempt-1",
        questionId: "question-1",
        selectedOptionIds: ["option-1"],
        expectedRevision: 0,
        leaseVersion: 1,
        idempotencyKey: "answer-1",
        leaseToken: "raw-secret",
      },
      { studentUserId: "student-1", repository: repo, env: enabledEnv }
    );
    expect(repo.saveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "attempt-1",
        studentUserId: "student-1",
        leaseTokenHash: hashLeaseToken("raw-secret"),
        answer: expect.objectContaining({ expectedRevision: 0 }),
      })
    );
  });

  it("uses the same lease boundary for final submission", async () => {
    const repo = repository();
    await submitQuizAttempt(
      {
        courseOfferingId: "course-1",
        attemptId: "attempt-1",
        expectedRevision: 2,
        leaseVersion: 1,
        idempotencyKey: "submit-1",
        leaseToken: "raw-secret",
      },
      { studentUserId: "student-1", repository: repo, env: enabledEnv }
    );
    expect(repo.submit).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 2, leaseVersion: 1 })
    );
  });

  it("allows read projection while mutations stay disabled", async () => {
    const repo = repository();
    await getStudentQuizAttempt(
      {
        courseOfferingId: "course-1",
        attemptId: "attempt-1",
        leaseToken: null,
      },
      {
        studentUserId: "student-1",
        repository: repo,
        env: {
          QUIZ_ENABLED: "1",
          QUIZ_MUTATIONS_ENABLED: "0",
          QUIZ_PILOT_COURSE_IDS: "course-1",
        },
      }
    );
    expect(repo.getAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ allowFinalize: false })
    );
  });
});
