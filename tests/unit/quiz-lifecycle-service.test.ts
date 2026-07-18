import { describe, expect, it, vi } from "vitest";
import {
  closeQuiz,
  openQuiz,
  publishQuizResults,
  reopenQuiz,
  setQuizStudentException,
  type QuizLifecycleRepository,
} from "@/lib/quiz/lifecycle-service";

const enabledEnv = {
  QUIZ_ENABLED: "1",
  QUIZ_MUTATIONS_ENABLED: "1",
  QUIZ_PILOT_COURSE_IDS: "course-1",
};

function makeRepository(): QuizLifecycleRepository {
  return {
    openQuiz: vi.fn().mockResolvedValue({ id: "quiz-1" }),
    closeQuiz: vi.fn().mockResolvedValue({ id: "quiz-1", status: "CLOSED" }),
    reopenQuiz: vi.fn().mockResolvedValue({ id: "quiz-1", status: "OPEN" }),
    setStudentException: vi.fn().mockResolvedValue({ id: "exception-1" }),
    publishResults: vi.fn().mockResolvedValue({
      id: "quiz-1",
      status: "CLOSED",
      publishedAt: new Date("2026-07-18T02:00:00Z"),
      missingStudentCount: 0,
    }),
  };
}

describe("Quiz lifecycle service", () => {
  it("fails closed before calling the repository", async () => {
    const repository = makeRepository();
    await expect(
      openQuiz(
        { courseOfferingId: "course-1", quizId: "quiz-1" },
        { actorUserId: "teacher-1", repository, env: {} }
      )
    ).rejects.toMatchObject({ code: "quiz_mutations_disabled" });
    expect(repository.openQuiz).not.toHaveBeenCalled();
  });

  it("passes actor identity and authoritative time", async () => {
    const repository = makeRepository();
    const now = new Date("2026-07-18T01:00:00Z");
    await openQuiz(
      { courseOfferingId: "course-1", quizId: "quiz-1" },
      { actorUserId: "teacher-1", repository, env: enabledEnv, now }
    );
    expect(repository.openQuiz).toHaveBeenCalledWith({
      courseOfferingId: "course-1",
      quizId: "quiz-1",
      actorUserId: "teacher-1",
      now,
    });
  });

  it("passes the close command to the repository", async () => {
    const repository = makeRepository();
    const now = new Date("2026-07-18T01:00:00Z");
    await closeQuiz(
      { courseOfferingId: "course-1", quizId: "quiz-1" },
      { actorUserId: "teacher-1", repository, env: enabledEnv, now }
    );
    expect(repository.closeQuiz).toHaveBeenCalledWith({
      courseOfferingId: "course-1",
      quizId: "quiz-1",
      actorUserId: "teacher-1",
      now,
    });
  });

  it("parses the close time before reopening", async () => {
    const repository = makeRepository();
    const now = new Date("2026-07-18T01:00:00Z");
    await reopenQuiz(
      {
        courseOfferingId: "course-1",
        quizId: "quiz-1",
        newClosesAt: "2026-07-19T09:00:00Z",
        reason: "เพิ่มเวลาให้นักเรียน",
      },
      { actorUserId: "teacher-1", repository, env: enabledEnv, now }
    );
    expect(repository.reopenQuiz).toHaveBeenCalledWith({
      courseOfferingId: "course-1",
      quizId: "quiz-1",
      actorUserId: "teacher-1",
      now,
      newClosesAt: new Date("2026-07-19T09:00:00Z"),
      reason: "เพิ่มเวลาให้นักเรียน",
    });
  });

  it("normalizes a per-student exception", async () => {
    const repository = makeRepository();
    const now = new Date("2026-07-18T01:00:00Z");
    await setQuizStudentException(
      {
        courseOfferingId: "course-1",
        quizId: "quiz-1",
        enrollmentId: "enrollment-1",
        extendedDeadline: "2026-07-20T09:00:00Z",
        extraAttempts: 1,
        reason: "นักเรียนลาป่วย",
      },
      { actorUserId: "teacher-1", repository, env: enabledEnv, now }
    );
    expect(repository.setStudentException).toHaveBeenCalledWith({
      courseOfferingId: "course-1",
      quizId: "quiz-1",
      enrollmentId: "enrollment-1",
      extendedDeadline: new Date("2026-07-20T09:00:00Z"),
      extraAttempts: 1,
      reason: "นักเรียนลาป่วย",
      actorUserId: "teacher-1",
      now,
    });
  });

  it("forwards missing-student confirmation when publishing", async () => {
    const repository = makeRepository();
    const now = new Date("2026-07-18T01:00:00Z");
    await publishQuizResults(
      {
        courseOfferingId: "course-1",
        quizId: "quiz-1",
        missingStudentsConfirmed: true,
      },
      { actorUserId: "teacher-1", repository, env: enabledEnv, now }
    );
    expect(repository.publishResults).toHaveBeenCalledWith({
      courseOfferingId: "course-1",
      quizId: "quiz-1",
      actorUserId: "teacher-1",
      now,
      missingStudentsConfirmed: true,
    });
  });
});
