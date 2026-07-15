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
  };
}
