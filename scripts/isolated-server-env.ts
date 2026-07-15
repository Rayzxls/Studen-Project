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
    // Moderation has already been migrated to the isolated QA database. Keep
    // its user-reporting and Admin review surfaces available during QA while
    // preserving an explicit override for fail-closed acceptance checks.
    MODERATION_CENTER_ENABLED: env.MODERATION_CENTER_ENABLED ?? "1",
  };
}
