import { describe, expect, it } from "vitest";

import {
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
});
