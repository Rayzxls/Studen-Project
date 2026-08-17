const ENABLED_VALUE = "1";

export type RewardFeatureFlagEnv = Readonly<Record<string, string | undefined>>;

/** Reward reads stay closed until the additive ledger migration is deployed. */
export function rewardEnabled(
  env: RewardFeatureFlagEnv = process.env
): boolean {
  return env.REWARD_ENABLED === ENABLED_VALUE;
}

/** Mutations require both the read gate and the independent write gate. */
export function rewardMutationsEnabled(
  env: RewardFeatureFlagEnv = process.env
): boolean {
  return rewardEnabled(env) && env.REWARD_MUTATIONS_ENABLED === ENABLED_VALUE;
}

/** Reward V2 Course Score Milestone reads use an independent fail-closed gate. */
export function courseRewardMilestonesEnabled(
  env: RewardFeatureFlagEnv = process.env
): boolean {
  return env.COURSE_REWARD_MILESTONES_ENABLED === ENABLED_VALUE;
}

/** Course Score Milestone writes require both V2 read and mutation gates. */
export function courseRewardMilestoneMutationsEnabled(
  env: RewardFeatureFlagEnv = process.env
): boolean {
  return (
    courseRewardMilestonesEnabled(env) &&
    env.COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED === ENABLED_VALUE
  );
}
