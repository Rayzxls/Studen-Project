const ENABLED_VALUE = "1";

export type QuizFeatureFlagEnv = Readonly<Record<string, string | undefined>>;

export function quizEnabled(env: QuizFeatureFlagEnv = process.env): boolean {
  return env.QUIZ_ENABLED === ENABLED_VALUE;
}

export type QuizPilotAllowlist = {
  /** Every course is allowed — identity-checked isolated QA only. */
  wildcard: boolean;
  /** Explicitly allowed CourseOffering ids, in configured order. */
  ids: readonly string[];
};

/**
 * Reads the pilot allowlist without deciding anything, so the runtime check and
 * the operational verifier agree on what a given value means. A missing, blank,
 * or separator-only value yields no wildcard and no ids, which allows nothing.
 */
export function parseQuizPilotAllowlist(
  env: QuizFeatureFlagEnv = process.env
): QuizPilotAllowlist {
  const raw = env.QUIZ_PILOT_COURSE_IDS?.trim();
  if (!raw) return { wildcard: false, ids: [] };
  if (raw === "*") return { wildcard: true, ids: [] };

  return {
    wildcard: false,
    ids: raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
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

  const allowlist = parseQuizPilotAllowlist(env);
  return allowlist.wildcard || allowlist.ids.includes(courseOfferingId);
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
