const ENABLED_VALUE = "1";

export type QuizFeatureFlagEnv = Readonly<Record<string, string | undefined>>;

export function quizEnabled(env: QuizFeatureFlagEnv = process.env): boolean {
  return env.QUIZ_ENABLED === ENABLED_VALUE;
}

/**
 * Quiz always requires an explicit pilot allowlist. Missing or empty values
 * enable no course. The wildcard exists for identity-checked isolated QA only.
 */
export function quizCourseEnabled(
  courseOfferingId: string,
  env: QuizFeatureFlagEnv = process.env
): boolean {
  if (!quizEnabled(env)) return false;

  const raw = env.QUIZ_PILOT_COURSE_IDS;
  if (raw === undefined || raw.trim() === "") return false;
  if (raw.trim() === "*") return true;

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(courseOfferingId);
}

export function quizMutationsEnabled(
  env: QuizFeatureFlagEnv = process.env
): boolean {
  return quizEnabled(env) && env.QUIZ_MUTATIONS_ENABLED === ENABLED_VALUE;
}

export function quizCourseMutationsEnabled(
  courseOfferingId: string,
  env: QuizFeatureFlagEnv = process.env
): boolean {
  return (
    quizCourseEnabled(courseOfferingId, env) &&
    env.QUIZ_MUTATIONS_ENABLED === ENABLED_VALUE
  );
}
