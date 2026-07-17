const ENABLED_VALUE = "1";
export type FeatureFlagEnv = Readonly<Record<string, string | undefined>>;

export function lessonWorkspaceEnabled(
  env: FeatureFlagEnv = process.env
): boolean {
  return env.LESSON_WORKSPACE_ENABLED === ENABLED_VALUE;
}

/**
 * Optional course-level rollout gate.
 *
 * When `LESSON_WORKSPACE_PILOT_COURSE_IDS` is absent, the read flag keeps its
 * existing all-course behaviour. Once the variable is present, only exact
 * comma-separated CourseOffering ids are enabled; an empty value enables no
 * courses. This lets Production pilot one course without another data model.
 */
export function lessonWorkspaceCourseEnabled(
  courseOfferingId: string,
  env: FeatureFlagEnv = process.env
): boolean {
  if (!lessonWorkspaceEnabled(env)) return false;
  const raw = env.LESSON_WORKSPACE_PILOT_COURSE_IDS;
  if (raw === undefined) return true;
  if (raw.trim() === "*") return true;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(courseOfferingId);
}

export function lessonWorkspaceMutationsEnabled(
  env: FeatureFlagEnv = process.env
): boolean {
  return (
    lessonWorkspaceEnabled(env) &&
    env.LESSON_WORKSPACE_MUTATIONS_ENABLED === ENABLED_VALUE
  );
}

export function lessonWorkspaceCourseMutationsEnabled(
  courseOfferingId: string,
  env: FeatureFlagEnv = process.env
): boolean {
  return (
    lessonWorkspaceCourseEnabled(courseOfferingId, env) &&
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
