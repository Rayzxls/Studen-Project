const ENABLED_VALUE = "1";

export type IdentityFeatureFlagEnv = Readonly<
  Record<string, string | undefined>
>;

export function identityFoundationEnabled(
  env: IdentityFeatureFlagEnv = process.env
): boolean {
  return env.IDENTITY_FOUNDATION_ENABLED === ENABLED_VALUE;
}

export function identityFoundationMutationsEnabled(
  env: IdentityFeatureFlagEnv = process.env
): boolean {
  return (
    identityFoundationEnabled(env) &&
    env.IDENTITY_FOUNDATION_MUTATIONS_ENABLED === ENABLED_VALUE
  );
}
