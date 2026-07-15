const ENABLED_VALUE = "1";
type FeatureFlagEnv = Readonly<Record<string, string | undefined>>;

export function lessonWorkspaceEnabled(
  env: FeatureFlagEnv = process.env
): boolean {
  return env.LESSON_WORKSPACE_ENABLED === ENABLED_VALUE;
}

export function lessonWorkspaceMutationsEnabled(
  env: FeatureFlagEnv = process.env
): boolean {
  return (
    lessonWorkspaceEnabled(env) &&
    env.LESSON_WORKSPACE_MUTATIONS_ENABLED === ENABLED_VALUE
  );
}

export function lessonWorkspaceDefaultRouteEnabled(
  env: FeatureFlagEnv = process.env
): boolean {
  return (
    lessonWorkspaceEnabled(env) &&
    env.LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED === ENABLED_VALUE
  );
}
