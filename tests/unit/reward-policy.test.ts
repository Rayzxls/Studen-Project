import { describe, expect, it } from "vitest";

import {
  courseRewardAwardKey,
  courseRewardFrozen,
  normalizeRewardAchievementId,
  normalizeRewardPoints,
  normalizeRewardReason,
  REWARD_REASON_MAX_LENGTH,
} from "@/lib/reward/policy";

describe("reward policy", () => {
  it("accepts positive safe integer points only", () => {
    expect(normalizeRewardPoints(25)).toBe(25);
    for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => normalizeRewardPoints(invalid)).toThrow(
        "reward_points_must_be_positive_integer"
      );
    }
  });

  it("normalizes achievement ids and rejects missing or oversized ids", () => {
    expect(normalizeRewardAchievementId("  submit-42  ")).toBe("submit-42");
    expect(() => normalizeRewardAchievementId("  ")).toThrow(
      "reward_achievement_required"
    );
    expect(() => normalizeRewardAchievementId("x".repeat(201))).toThrow(
      "reward_achievement_too_long"
    );
  });

  it("requires a meaningful reason for reversals", () => {
    expect(
      normalizeRewardReason("  grading correction  ", { required: true })
    ).toBe("grading correction");
    expect(() => normalizeRewardReason(undefined, { required: true })).toThrow(
      "reward_reason_required"
    );
    expect(() => normalizeRewardReason("no", { required: true })).toThrow(
      "reward_reason_too_short"
    );
    expect(() =>
      normalizeRewardReason("x".repeat(REWARD_REASON_MAX_LENGTH + 1), {
        required: true,
      })
    ).toThrow("reward_reason_too_long");
  });

  it("builds a stable per-enrollment achievement award key", () => {
    const base = {
      enrollmentId: "enrollment-1",
      achievementType: "ASSIGNMENT_SUBMITTED" as const,
      achievementId: "submission-1",
    };
    expect(courseRewardAwardKey(base)).toBe(
      courseRewardAwardKey({
        ...base,
        achievementId: " submission-1 ",
      })
    );
    expect(courseRewardAwardKey(base)).not.toBe(
      courseRewardAwardKey({
        ...base,
        enrollmentId: "enrollment-2",
      })
    );
  });

  it("freezes history when either the course or enrollment is inactive", () => {
    expect(
      courseRewardFrozen({ courseArchivedAt: null, enrollmentRemovedAt: null })
    ).toBe(false);
    expect(
      courseRewardFrozen({
        courseArchivedAt: new Date(),
        enrollmentRemovedAt: null,
      })
    ).toBe(true);
    expect(
      courseRewardFrozen({
        courseArchivedAt: null,
        enrollmentRemovedAt: new Date(),
      })
    ).toBe(true);
  });
});
