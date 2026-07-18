import { describe, expect, it, vi } from "vitest";
import {
  openQuiz,
  type QuizLifecycleRepository,
} from "@/lib/quiz/lifecycle-service";

const enabledEnv = {
  QUIZ_ENABLED: "1",
  QUIZ_MUTATIONS_ENABLED: "1",
  QUIZ_PILOT_COURSE_IDS: "course-1",
};

describe("Quiz lifecycle service", () => {
  it("fails closed before calling the repository", async () => {
    const repository: QuizLifecycleRepository = { openQuiz: vi.fn() };
    await expect(
      openQuiz(
        { courseOfferingId: "course-1", quizId: "quiz-1" },
        { actorUserId: "teacher-1", repository, env: {} }
      )
    ).rejects.toMatchObject({ code: "quiz_mutations_disabled" });
    expect(repository.openQuiz).not.toHaveBeenCalled();
  });

  it("passes actor identity and authoritative time", async () => {
    const repository: QuizLifecycleRepository = {
      openQuiz: vi.fn().mockResolvedValue({ id: "quiz-1" }),
    };
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
});
