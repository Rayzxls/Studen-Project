const ENABLED_VALUE = "1";

export type QuizFeatureFlagEnv = Readonly<Record<string, string | undefined>>;

/**
 * Quiz gates are course-independent (ADR-0045). `QUIZ_ENABLED` withdraws every
 * read surface and `QUIZ_MUTATIONS_ENABLED` additionally withdraws writes while
 * leaving existing quizzes readable. Both fail closed: any value other than the
 * exact enabled string disables the feature.
 *
 * The retired `QUIZ_PILOT_COURSE_IDS` allowlist bounded a grade-writing feature
 * to one named CourseOffering during its pilot. That pilot has been accepted, and
 * keeping it would have required an environment change and a redeploy for every
 * course a teacher creates.
 */
export function quizEnabled(env: QuizFeatureFlagEnv = process.env): boolean {
  return env.QUIZ_ENABLED === ENABLED_VALUE;
}

export function quizMutationsEnabled(
  env: QuizFeatureFlagEnv = process.env
): boolean {
  return quizEnabled(env) && env.QUIZ_MUTATIONS_ENABLED === ENABLED_VALUE;
}
