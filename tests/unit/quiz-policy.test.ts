import { describe, expect, it } from "vitest";
import {
  canCancelQuiz,
  canDeleteQuiz,
  canEditQuizContent,
  canPublishScoredQuiz,
  canReopenQuiz,
  decideAttemptWrite,
  effectiveAttemptDeadline,
  scoreObjectiveAnswer,
  selectBestAttempt,
} from "@/lib/quiz/policy";

describe("Quiz domain policy", () => {
  it("locks editing and deletion after the first Attempt", () => {
    expect(canEditQuizContent({ attemptCount: 0 })).toBe(true);
    expect(canEditQuizContent({ attemptCount: 1 })).toBe(false);
    expect(canDeleteQuiz({ attemptCount: 0 })).toBe(true);
    expect(canDeleteQuiz({ attemptCount: 1 })).toBe(false);
  });

  it("uses exact-match objective grading", () => {
    expect(
      scoreObjectiveAnswer({
        correctOptionIds: ["a", "b"],
        selectedOptionIds: ["b", "a"],
        points: 4,
      })
    ).toBe(4);
    expect(
      scoreObjectiveAnswer({
        correctOptionIds: ["a", "b"],
        selectedOptionIds: ["a"],
        points: 4,
      })
    ).toBe(0);
  });

  it("chooses the earliest applicable deadline", () => {
    expect(
      effectiveAttemptDeadline([
        new Date("2026-07-17T12:00:00Z"),
        null,
        new Date("2026-07-17T11:30:00Z"),
      ])?.toISOString()
    ).toBe("2026-07-17T11:30:00.000Z");
  });

  it("rejects stale devices, stale revisions, and expired writes", () => {
    const base = {
      status: "IN_PROGRESS" as const,
      currentLeaseVersion: 2,
      expectedLeaseVersion: 2,
      currentRevision: 4,
      expectedRevision: 4,
      deadline: new Date("2026-07-17T12:00:00Z"),
      now: new Date("2026-07-17T11:00:00Z"),
    };
    expect(decideAttemptWrite(base)).toEqual({ allowed: true });
    expect(decideAttemptWrite({ ...base, expectedLeaseVersion: 1 })).toEqual({
      allowed: false,
      code: "stale_lease",
    });
    expect(decideAttemptWrite({ ...base, expectedRevision: 3 })).toEqual({
      allowed: false,
      code: "stale_revision",
    });
    expect(
      decideAttemptWrite({ ...base, now: new Date("2026-07-17T12:00:00Z") })
    ).toEqual({ allowed: false, code: "attempt_expired" });
  });

  it("selects the highest submitted Attempt and keeps the earliest tie", () => {
    expect(
      selectBestAttempt([
        { id: "a", status: "SUBMITTED", score: 8, submittedAtMs: 20 },
        { id: "b", status: "SUBMITTED", score: 9, submittedAtMs: 30 },
        { id: "c", status: "SUBMITTED", score: 9, submittedAtMs: 10 },
        { id: "d", status: "IN_PROGRESS", score: 10, submittedAtMs: null },
      ])?.id
    ).toBe("c");
  });

  it("requires closed state and missing-student confirmation to publish", () => {
    expect(
      canPublishScoredQuiz({
        status: "CLOSED",
        cancelledAt: null,
        missingStudentCount: 2,
        missingStudentsConfirmed: false,
      })
    ).toBe(false);
    expect(
      canPublishScoredQuiz({
        status: "CLOSED",
        cancelledAt: null,
        missingStudentCount: 2,
        missingStudentsConfirmed: true,
      })
    ).toBe(true);
  });

  it("allows cancellation and reopen only before publication", () => {
    expect(canCancelQuiz({ publishedAt: null })).toBe(true);
    expect(canCancelQuiz({ publishedAt: new Date() })).toBe(false);
    expect(
      canReopenQuiz({
        status: "CLOSED",
        publishedAt: null,
        newClosesAt: new Date("2026-07-18T12:00:00Z"),
        now: new Date("2026-07-17T12:00:00Z"),
      })
    ).toBe(true);
  });
});
