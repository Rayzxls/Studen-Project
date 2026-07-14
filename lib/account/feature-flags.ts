const ENABLED_VALUE = "1";

export function accountLifecycleMutationsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.ACCOUNT_LIFECYCLE_MUTATIONS_ENABLED === ENABLED_VALUE;
}
