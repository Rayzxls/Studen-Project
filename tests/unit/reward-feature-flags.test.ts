import { describe, expect, it } from "vitest";

import {
  courseRewardMilestoneMutationsEnabled,
  courseRewardMilestonesEnabled,
  rewardEnabled,
  rewardMutationsEnabled,
} from "@/lib/reward/feature-flags";

describe("reward feature flags", () => {
  it("keeps reads closed unless REWARD_ENABLED is exactly 1", () => {
    expect(rewardEnabled({})).toBe(false);
    expect(rewardEnabled({ REWARD_ENABLED: "true" })).toBe(false);
    expect(rewardEnabled({ REWARD_ENABLED: "1" })).toBe(true);
  });

  it("requires both the read and mutation gates for writes", () => {
    expect(rewardMutationsEnabled({ REWARD_MUTATIONS_ENABLED: "1" })).toBe(
      false
    );
    expect(
      rewardMutationsEnabled({
        REWARD_ENABLED: "1",
        REWARD_MUTATIONS_ENABLED: "0",
      })
    ).toBe(false);
    expect(
      rewardMutationsEnabled({
        REWARD_ENABLED: "1",
        REWARD_MUTATIONS_ENABLED: "1",
      })
    ).toBe(true);
  });

  it("keeps Course Score Milestones independent from legacy Reward V1", () => {
    expect(
      courseRewardMilestonesEnabled({
        REWARD_ENABLED: "1",
        COURSE_REWARD_MILESTONES_ENABLED: "0",
      })
    ).toBe(false);
    expect(
      courseRewardMilestonesEnabled({
        REWARD_ENABLED: "0",
        COURSE_REWARD_MILESTONES_ENABLED: "1",
      })
    ).toBe(true);
  });

  it("requires both Course Score Milestone gates for V2 writes", () => {
    expect(
      courseRewardMilestoneMutationsEnabled({
        COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "1",
      })
    ).toBe(false);
    expect(
      courseRewardMilestoneMutationsEnabled({
        COURSE_REWARD_MILESTONES_ENABLED: "1",
        COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "0",
      })
    ).toBe(false);
    expect(
      courseRewardMilestoneMutationsEnabled({
        COURSE_REWARD_MILESTONES_ENABLED: "1",
        COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "1",
      })
    ).toBe(true);
  });
});
