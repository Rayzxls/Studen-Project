import { describe, expect, it } from "vitest";
import {
  quizCourseEnabled,
  quizCourseMutationsEnabled,
  quizEnabled,
  quizMutationsEnabled,
} from "@/lib/quiz/feature-flags";

describe("Quiz feature flags", () => {
  it("fails closed when flags or the pilot allowlist are absent", () => {
    expect(quizEnabled({})).toBe(false);
    expect(quizEnabled({ QUIZ_ENABLED: "true" })).toBe(false);
    expect(quizCourseEnabled("course-a", { QUIZ_ENABLED: "1" })).toBe(false);
  });

  it("enables only exact pilot course ids", () => {
    const env = {
      QUIZ_ENABLED: "1",
      QUIZ_PILOT_COURSE_IDS: " course-a,course-b ",
    };
    expect(quizCourseEnabled("course-a", env)).toBe(true);
    expect(quizCourseEnabled("course-b", env)).toBe(true);
    expect(quizCourseEnabled("course", env)).toBe(false);
  });

  it("supports an isolated-QA wildcard without weakening the read flag", () => {
    expect(
      quizCourseEnabled("qa-course", {
        QUIZ_ENABLED: "1",
        QUIZ_PILOT_COURSE_IDS: "*",
      })
    ).toBe(true);
    expect(
      quizCourseEnabled("qa-course", {
        QUIZ_PILOT_COURSE_IDS: "*",
      })
    ).toBe(false);
  });

  it("requires read, mutation, and pilot gates together", () => {
    expect(quizMutationsEnabled({ QUIZ_MUTATIONS_ENABLED: "1" })).toBe(false);
    expect(
      quizMutationsEnabled({
        QUIZ_ENABLED: "1",
        QUIZ_MUTATIONS_ENABLED: "1",
      })
    ).toBe(true);
    expect(
      quizCourseMutationsEnabled("course-a", {
        QUIZ_ENABLED: "1",
        QUIZ_MUTATIONS_ENABLED: "1",
        QUIZ_PILOT_COURSE_IDS: "course-b",
      })
    ).toBe(false);
  });
});
