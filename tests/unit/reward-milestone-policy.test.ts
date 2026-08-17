import { describe, expect, it } from "vitest";

import {
  courseRewardScoreSnapshot,
  highestEligibleCourseRewardTier,
  normalizeCourseRewardResolutionReason,
  normalizeCourseRewardTierInput,
  scoreSnapshotMeetsThreshold,
} from "@/lib/reward/milestone-policy";

const PUBLISHED = new Date("2026-08-17T00:00:00Z");

describe("Course Reward milestone policy", () => {
  it("normalizes tier copy and accepts only whole thresholds from 0 through 100", () => {
    expect(
      normalizeCourseRewardTierInput({
        title: "  Gold badge  ",
        description: "  Finish strong  ",
        fulfillmentInstructions: " ",
        requiredScore: 80,
      })
    ).toEqual({
      title: "Gold badge",
      description: "Finish strong",
      fulfillmentInstructions: null,
      requiredScore: 80,
    });
    for (const requiredScore of [-1, 50.5, 101, Number.NaN]) {
      expect(() =>
        normalizeCourseRewardTierInput({ title: "Tier", requiredScore })
      ).toThrow("required_score_invalid");
    }
  });

  it("uses only published score items and freezes the exact score shape", () => {
    const snapshot = courseRewardScoreSnapshot(
      [
        { id: "quiz", fullScore: 20, publishedAt: PUBLISHED },
        { id: "midterm", fullScore: 80, publishedAt: PUBLISHED },
        { id: "draft", fullScore: 100, publishedAt: null },
      ],
      [
        { scoreItemId: "quiz", value: 20 },
        { scoreItemId: "midterm", value: 60 },
        { scoreItemId: "draft", value: 100 },
      ]
    );
    expect(snapshot).toEqual({
      percent: 80,
      earnedScore: 80,
      publishedFullScore: 100,
    });
  });

  it("returns no eligibility before any score is published", () => {
    expect(
      courseRewardScoreSnapshot(
        [{ id: "draft", fullScore: 10, publishedAt: null }],
        [{ scoreItemId: "draft", value: 10 }]
      )
    ).toBeNull();
  });

  it("selects only the highest eligible tier at an exact boundary", () => {
    const snapshot = {
      percent: 80,
      earnedScore: 8,
      publishedFullScore: 10,
    };
    expect(scoreSnapshotMeetsThreshold(snapshot, 80)).toBe(true);
    expect(scoreSnapshotMeetsThreshold(snapshot, 81)).toBe(false);
    expect(
      highestEligibleCourseRewardTier(
        [
          { id: "50", requiredScore: 50 },
          { id: "80", requiredScore: 80 },
          { id: "90", requiredScore: 90 },
        ],
        snapshot
      )
    ).toEqual({ id: "80", requiredScore: 80 });
  });

  it("requires an explainable rejection reason but not a fulfilment note", () => {
    expect(
      normalizeCourseRewardResolutionReason(undefined, { required: false })
    ).toBeNull();
    expect(() =>
      normalizeCourseRewardResolutionReason("no", { required: true })
    ).toThrow("resolution_reason_too_short");
    expect(
      normalizeCourseRewardResolutionReason("  score corrected  ", {
        required: true,
      })
    ).toBe("score corrected");
  });
});
