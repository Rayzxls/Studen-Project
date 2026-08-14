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
