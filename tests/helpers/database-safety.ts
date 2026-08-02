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

export function prepareBaselineRehearsalEnv(
  env: DatabaseEnvironment
): NodeJS.ProcessEnv {
  const primaryUrl = required(env, "DATABASE_URL");
  const qaUrl = required(env, "QA_DATABASE_URL");
  const rehearsalUrl = required(env, "BASELINE_REHEARSAL_DATABASE_URL");
  const rehearsalIdentity = databaseIdentity(rehearsalUrl);

  if (rehearsalIdentity === databaseIdentity(primaryUrl)) {
    throw new Error("baseline_rehearsal_database_matches_primary");
  }
  if (rehearsalIdentity === databaseIdentity(qaUrl)) {
    throw new Error("baseline_rehearsal_database_matches_qa");
  }

  const parsed = new URL(rehearsalUrl);
  if (
    parsed.hostname.toLowerCase().endsWith(".neon.tech") &&
    parsed.hostname.toLowerCase().includes("-pooler.")
  ) {
    throw new Error("baseline_rehearsal_database_must_use_direct_connection");
  }

  const schema = parsed.searchParams.get("schema");
  if (schema && schema !== "public") {
    throw new Error("baseline_rehearsal_database_must_use_public_schema");
  }
  const options = parsed.searchParams.get("options");
  if (options && /search_path\s*=\s*(?!public(?:\s|$))/i.test(options)) {
    throw new Error("baseline_rehearsal_database_must_use_public_schema");
  }

  return {
    ...env,
    NODE_ENV: "test",
    DATABASE_URL: rehearsalUrl,
    BEAGLE_PRIMARY_DATABASE_URL: primaryUrl,
    BEAGLE_QA_DATABASE_URL: qaUrl,
    BEAGLE_BASELINE_REHEARSAL_DATABASE: "1",
  };
}

export function assertBaselineRehearsalDatabase(
  env: DatabaseEnvironment = process.env
): void {
  if (env.BEAGLE_BASELINE_REHEARSAL_DATABASE !== "1") {
    throw new Error("baseline_rehearsal_database_gate_not_enabled");
  }

  const activeUrl = required(env, "DATABASE_URL");
  const rehearsalUrl = required(env, "BASELINE_REHEARSAL_DATABASE_URL");
  const primaryUrl = required(env, "BEAGLE_PRIMARY_DATABASE_URL");
  const qaUrl = required(env, "BEAGLE_QA_DATABASE_URL");
  const activeIdentity = databaseIdentity(activeUrl);

  if (activeIdentity !== databaseIdentity(rehearsalUrl)) {
    throw new Error("active_database_is_not_baseline_rehearsal_database");
  }
  if (activeIdentity === databaseIdentity(primaryUrl)) {
    throw new Error("baseline_rehearsal_database_matches_primary");
  }
  if (activeIdentity === databaseIdentity(qaUrl)) {
    throw new Error("baseline_rehearsal_database_matches_qa");
  }
}

export function prepareQaBaselineAdoptionEnv(
  env: DatabaseEnvironment
): NodeJS.ProcessEnv {
  const isolated = prepareIsolatedDatabaseEnv(env);
  const primaryUrl = required(env, "DATABASE_URL");
  const qaUrl = required(env, "QA_DATABASE_URL");
  const backupUrl = required(env, "QA_BASELINE_BACKUP_DATABASE_URL");
  const backupIdentity = databaseIdentity(backupUrl);

  if (backupIdentity === databaseIdentity(primaryUrl)) {
    throw new Error("qa_baseline_backup_matches_primary");
  }
  if (backupIdentity === databaseIdentity(qaUrl)) {
    throw new Error("qa_baseline_backup_matches_qa");
  }

  for (const [label, rawUrl] of [
    ["qa", qaUrl],
    ["qa_baseline_backup", backupUrl],
  ] as const) {
    const parsed = new URL(rawUrl);
    const schema = parsed.searchParams.get("schema");
    if (schema && schema !== "public") {
      throw new Error(`${label}_database_must_use_public_schema`);
    }
  }

  const backup = new URL(backupUrl);
  if (
    backup.hostname.toLowerCase().endsWith(".neon.tech") &&
    backup.hostname.toLowerCase().includes("-pooler.")
  ) {
    throw new Error("qa_baseline_backup_must_use_direct_connection");
  }

  return {
    ...isolated,
    QA_BASELINE_BACKUP_DATABASE_URL: backupUrl,
    BEAGLE_QA_BASELINE_ADOPTION: "1",
  };
}

export function assertQaBaselineAdoptionDatabase(
  env: DatabaseEnvironment = process.env
): void {
  if (env.BEAGLE_QA_BASELINE_ADOPTION !== "1") {
    throw new Error("qa_baseline_adoption_gate_not_enabled");
  }

  const activeUrl = required(env, "DATABASE_URL");
  const qaUrl = required(env, "QA_DATABASE_URL");
  const primaryUrl = required(env, "BEAGLE_PRIMARY_DATABASE_URL");
  const backupUrl = required(env, "QA_BASELINE_BACKUP_DATABASE_URL");
  const activeIdentity = databaseIdentity(activeUrl);

  if (activeIdentity !== databaseIdentity(qaUrl)) {
    throw new Error("active_database_is_not_qa_database");
  }
  if (activeIdentity === databaseIdentity(primaryUrl)) {
    throw new Error("qa_database_matches_primary");
  }
  if (activeIdentity === databaseIdentity(backupUrl)) {
    throw new Error("qa_database_matches_baseline_backup");
  }
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
