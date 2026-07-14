type DatabaseEnvironment = Record<string, string | undefined>;

function required(env: DatabaseEnvironment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key.toLowerCase()}_required`);
  return value;
}

export function databaseIdentity(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("database_url_invalid");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("database_url_must_be_postgresql");
  }

  // A Neon pooled and direct URL can point to the same branch. Ignore that
  // transport-only hostname suffix so they cannot masquerade as two databases.
  const hostname = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const username = decodeURIComponent(url.username);
  return `${username}@${hostname}:${port}/${database}`;
}

export function prepareIsolatedDatabaseEnv(
  env: DatabaseEnvironment
): NodeJS.ProcessEnv {
  const primaryUrl = required(env, "DATABASE_URL");
  const qaUrl = required(env, "QA_DATABASE_URL");
  const nodeEnv =
    env.NODE_ENV === "development" || env.NODE_ENV === "production"
      ? env.NODE_ENV
      : "test";

  if (databaseIdentity(primaryUrl) === databaseIdentity(qaUrl)) {
    throw new Error("qa_database_matches_primary");
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    DATABASE_URL: qaUrl,
    BEAGLE_PRIMARY_DATABASE_URL: primaryUrl,
    BEAGLE_MUTATING_TEST_DATABASE: "1",
  };
}

export function assertIsolatedTestDatabase(
  env: DatabaseEnvironment = process.env
): void {
  if (env.BEAGLE_MUTATING_TEST_DATABASE !== "1") {
    throw new Error("mutating_test_database_gate_not_enabled");
  }

  const activeUrl = required(env, "DATABASE_URL");
  const qaUrl = required(env, "QA_DATABASE_URL");
  const primaryUrl = required(env, "BEAGLE_PRIMARY_DATABASE_URL");

  if (databaseIdentity(primaryUrl) === databaseIdentity(qaUrl)) {
    throw new Error("qa_database_matches_primary");
  }
  if (databaseIdentity(activeUrl) !== databaseIdentity(qaUrl)) {
    throw new Error("active_database_is_not_qa_database");
  }
}
