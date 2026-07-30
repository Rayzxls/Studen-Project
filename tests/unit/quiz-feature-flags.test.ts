import { describe, expect, it } from "vitest";
import { quizEnabled, quizMutationsEnabled } from "@/lib/quiz/feature-flags";

describe("Quiz feature flags", () => {
  it("fails closed on anything but the exact enabled value", () => {
    expect(quizEnabled({})).toBe(false);
    expect(quizEnabled({ QUIZ_ENABLED: "true" })).toBe(false);
    expect(quizEnabled({ QUIZ_ENABLED: "0" })).toBe(false);
    expect(quizEnabled({ QUIZ_ENABLED: "1" })).toBe(true);
  });

  it("covers every course alike, with no per-course allowlist", () => {
    // ADR-0045 retired QUIZ_PILOT_COURSE_IDS. A leftover value in a deployment
    // environment must not resurrect per-course gating or disable anything.
    const env = { QUIZ_ENABLED: "1", QUIZ_PILOT_COURSE_IDS: "course-a" };
    expect(quizEnabled(env)).toBe(true);
    expect(quizEnabled({ QUIZ_ENABLED: "1", QUIZ_PILOT_COURSE_IDS: "" })).toBe(
      true
    );
  });

  it("requires the read flag before mutations are enabled", () => {
    expect(quizMutationsEnabled({ QUIZ_MUTATIONS_ENABLED: "1" })).toBe(false);
    expect(
      quizMutationsEnabled({ QUIZ_ENABLED: "1", QUIZ_MUTATIONS_ENABLED: "1" })
    ).toBe(true);
    expect(
      quizMutationsEnabled({ QUIZ_ENABLED: "1", QUIZ_MUTATIONS_ENABLED: "0" })
    ).toBe(false);
  });
});
