type ServerEnv = Readonly<Record<string, string | undefined>>;

export function prepareIsolatedServerEnv<T extends ServerEnv>(
  env: T
): T & ServerEnv {
  return {
    ...env,
    // The isolated server always points DATABASE_URL at QA_DATABASE_URL.
    // Enable the Lesson pilot here so local QA can exercise real mutations
    // without ever enabling them on the normal Production-backed dev server.
    LESSON_WORKSPACE_ENABLED: env.LESSON_WORKSPACE_ENABLED ?? "1",
    LESSON_WORKSPACE_MUTATIONS_ENABLED:
      env.LESSON_WORKSPACE_MUTATIONS_ENABLED ?? "1",
    LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED:
      env.LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED ?? "0",
    // Next.js loads .env.local again when the dev server starts. An explicit
    // wildcard prevents Production pilot ids from being reintroduced into QA.
    LESSON_WORKSPACE_PILOT_COURSE_IDS: "*",
    // Moderation has already been migrated to the isolated QA database. Keep
    // its user-reporting and Admin review surfaces available during QA while
    // preserving an explicit override for fail-closed acceptance checks.
    MODERATION_CENTER_ENABLED: env.MODERATION_CENTER_ENABLED ?? "1",
    // Quiz covers every course of an environment that enables it (ADR-0045),
    // which is safe to default on here because run-isolated-server first proves
    // that DATABASE_URL was replaced with a distinct QA_DATABASE_URL.
    QUIZ_ENABLED: env.QUIZ_ENABLED ?? "1",
    QUIZ_MUTATIONS_ENABLED: env.QUIZ_MUTATIONS_ENABLED ?? "1",
    // Persistent Chat is separate from the live-room data channel. Only the
    // isolated server opts into the new additive tables by default.
    CHAT_ENABLED: env.CHAT_ENABLED ?? "1",
    CHAT_MUTATIONS_ENABLED: env.CHAT_MUTATIONS_ENABLED ?? "1",
    // Reward V1 is retired. Keep its manual Course points UI closed even in
    // isolated QA, and exercise V2 through its independent additive gates.
    REWARD_ENABLED: env.REWARD_ENABLED ?? "0",
    REWARD_MUTATIONS_ENABLED: env.REWARD_MUTATIONS_ENABLED ?? "0",
    COURSE_REWARD_MILESTONES_ENABLED:
      env.COURSE_REWARD_MILESTONES_ENABLED ?? "1",
    COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED:
      env.COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED ?? "1",
  };
}
