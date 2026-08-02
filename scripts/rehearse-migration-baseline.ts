/**
 * Rehearses migration-bookkeeping replacement and rollback in disposable QA
 * schemas. It never changes the active QA/Production schema or the repository's
 * active prisma/migrations directory.
 */
import { randomBytes } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  access,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

const PRISMA_CLI = resolve("node_modules/prisma/build/index.js");
const ACTIVE_SCHEMA_PATH = resolve("prisma/schema.prisma");
const ACTIVE_MIGRATIONS_PATH = resolve("prisma/migrations");
const ACTIVE_MIGRATION_LOCK_PATH = resolve(
  "prisma/migrations/migration_lock.toml"
);
const BASELINE_PATH = resolve(
  "prisma/baseline/20260802010000_squashed_baseline/migration.sql"
);
const BASELINE_MIGRATION_NAME = "00000000000000_squashed_baseline";
const EXPECTED_LEGACY_MIGRATION_COUNT = 14;
const EXPECTED_TABLE_COUNT = 41;
const VERIFIER_ADVISORY_LOCK_ID = "68434670120260802";
const DISABLE_PRISMA_SESSION_LOCK = {
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
};

type CommandResult = SpawnSyncReturns<string>;

function runPrisma(
  args: string[],
  databaseUrl: string,
  allowedExitCodes: number[] = [0],
  envOverrides: Record<string, string | undefined> = {}
): CommandResult {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...envOverrides, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  const status = result.status ?? 1;
  if (!allowedExitCodes.includes(status)) {
    throw new Error(
      [
        `prisma_command_failed_${status}`,
        redact(result.stdout ?? "", databaseUrl),
        redact(result.stderr ?? "", databaseUrl),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

function redact(value: string, databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const withoutUrl = value.replaceAll(databaseUrl, "[database-url-redacted]");
  return parsed.password
    ? withoutUrl.replaceAll(parsed.password, "[password-redacted]")
    : withoutUrl;
}

function withSchema(databaseUrl: string, schemaName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("schema", schemaName);
  parsed.searchParams.set("options", `-c search_path=${schemaName}`);
  return parsed.toString();
}

function withoutNeonPooler(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname.endsWith(".neon.tech")) {
    parsed.hostname = parsed.hostname.replace(/-pooler(?=\.)/, "");
  }
  return parsed.toString();
}

function assertTemporarySchemaName(schemaName: string): void {
  if (!/^beagle_baseline_[a-f0-9]{16}(?:_backup)?$/.test(schemaName)) {
    throw new Error("unsafe_temporary_schema_name");
  }
}

async function listLegacyMigrationNames(): Promise<string[]> {
  const entries = await readdir(ACTIVE_MIGRATIONS_PATH, {
    withFileTypes: true,
  });
  const names = entries
    .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (names.length !== EXPECTED_LEGACY_MIGRATION_COUNT) {
    throw new Error(
      `legacy_migration_count_changed_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${names.length}`
    );
  }
  await Promise.all(
    names.map((name) =>
      access(join(ACTIVE_MIGRATIONS_PATH, name, "migration.sql"))
    )
  );
  return names;
}

async function createProposedMigrationWorkspace(): Promise<{
  root: string;
  schemaPath: string;
}> {
  const root = await mkdtemp(
    join(resolve(tmpdir()), "beagle-baseline-rehearsal-")
  );
  try {
    const prismaDir = join(root, "prisma");
    const baselineDir = join(prismaDir, "migrations", BASELINE_MIGRATION_NAME);
    await mkdir(baselineDir, { recursive: true });
    await copyFile(ACTIVE_SCHEMA_PATH, join(prismaDir, "schema.prisma"));
    await copyFile(
      ACTIVE_MIGRATION_LOCK_PATH,
      join(prismaDir, "migrations", "migration_lock.toml")
    );
    await copyFile(BASELINE_PATH, join(baselineDir, "migration.sql"));
    return { root, schemaPath: join(prismaDir, "schema.prisma") };
  } catch (error) {
    await removeProposedMigrationWorkspace(root);
    throw error;
  }
}

async function removeProposedMigrationWorkspace(root: string): Promise<void> {
  const resolvedRoot = resolve(root);
  const resolvedTemp = resolve(tmpdir());
  if (
    dirname(resolvedRoot) !== resolvedTemp ||
    !basename(resolvedRoot).startsWith("beagle-baseline-rehearsal-")
  ) {
    throw new Error("unsafe_rehearsal_workspace_cleanup_target");
  }
  const stats = await lstat(resolvedRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("unsafe_rehearsal_workspace_type");
  }
  await rm(resolvedRoot, { recursive: true });
}

async function assertSchemaRemoved(
  admin: PrismaClient,
  schemaName: string
): Promise<void> {
  const remaining = await admin.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.schemata
    WHERE schema_name = ${schemaName}
  `;
  if (remaining[0]?.count !== 0) {
    throw new Error(`temporary_schema_cleanup_failed_${schemaName}`);
  }
}

function assertNames(
  actual: string[],
  expected: string[],
  label: string
): void {
  if (
    JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())
  ) {
    throw new Error(`${label}_migration_names_mismatch`);
  }
}

async function assertSchemaMatches(
  databaseUrl: string,
  schemaPath: string
): Promise<void> {
  const diff = runPrisma(
    [
      "migrate",
      "diff",
      "--from-schema-datasource",
      schemaPath,
      "--to-schema-datamodel",
      schemaPath,
      "--exit-code",
    ],
    databaseUrl,
    [0, 2]
  );
  if (diff.status !== 0) {
    throw new Error(
      `rehearsal_schema_diff_detected\n${redact(diff.stdout ?? "", databaseUrl)}`
    );
  }
}

async function verifyApplicationShape(database: PrismaClient): Promise<void> {
  const tables = await database.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `;
  if (tables[0]?.count !== EXPECTED_TABLE_COUNT) {
    throw new Error(
      `rehearsal_table_count_mismatch_expected_${EXPECTED_TABLE_COUNT}_actual_${tables[0]?.count ?? "missing"}`
    );
  }

  const indexes = await database.$queryRaw<Array<{ indexdef: string }>>`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'notification_post_once'
  `;
  const indexDefinition = indexes[0]?.indexdef ?? "";
  if (
    !indexDefinition.includes("UNIQUE INDEX") ||
    !indexDefinition.includes("WHERE")
  ) {
    throw new Error("rehearsal_partial_unique_index_missing");
  }

  await Promise.all([
    database.user.count(),
    database.courseOffering.count(),
    database.assignment.count(),
    database.notification.count(),
    database.webPushSubscription.count(),
  ]);
}

async function main(): Promise<void> {
  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  const isolatedQaUrl = isolatedEnv.QA_DATABASE_URL;
  if (!isolatedQaUrl) throw new Error("qa_database_url_required");

  // Transaction poolers may reuse a backend session whose search_path was set
  // by another disposable-schema process. Use Neon's direct endpoint after the
  // QA-vs-primary identity guard has passed; withSchema also pins search_path
  // as a connection startup option. Non-Neon hosts are unchanged.
  const qaUrl = withoutNeonPooler(isolatedQaUrl);

  const suffix = randomBytes(8).toString("hex");
  const targetSchema = `beagle_baseline_${suffix}`;
  const backupSchema = `${targetSchema}_backup`;
  assertTemporarySchemaName(targetSchema);
  assertTemporarySchemaName(backupSchema);

  const activeSchema = new URL(qaUrl).searchParams.get("schema") ?? "public";
  if (targetSchema === activeSchema || backupSchema === activeSchema) {
    throw new Error("temporary_schema_matches_active_schema");
  }

  const legacyMigrationNames = await listLegacyMigrationNames();
  const workspace = await createProposedMigrationWorkspace();
  const targetUrl = withSchema(qaUrl, targetSchema);
  const admin = new PrismaClient({ datasourceUrl: qaUrl });
  let targetCreated = false;
  let backupCreated = false;

  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${targetSchema}"`);
    targetCreated = true;
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${backupSchema}"`);
    backupCreated = true;

    // Serialize with the baseline verifier. The transaction-scoped lock is
    // safe through transaction poolers and replaces Prisma's session lock for
    // this disposable rehearsal only.
    await admin.$transaction(
      async (lock) => {
        await lock.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${VERIFIER_ADVISORY_LOCK_ID})::text AS lock`
        );

        runPrisma(
          [
            "db",
            "execute",
            "--file",
            BASELINE_PATH,
            "--schema",
            ACTIVE_SCHEMA_PATH,
          ],
          targetUrl
        );
        await assertSchemaMatches(targetUrl, ACTIVE_SCHEMA_PATH);

        for (const migrationName of legacyMigrationNames) {
          runPrisma(
            [
              "migrate",
              "resolve",
              "--applied",
              migrationName,
              "--schema",
              ACTIVE_SCHEMA_PATH,
            ],
            targetUrl,
            [0],
            DISABLE_PRISMA_SESSION_LOCK
          );
        }

        const target = new PrismaClient({ datasourceUrl: targetUrl });
        try {
          const legacyRows = await target.$queryRaw<
            Array<{ migration_name: string }>
          >`
            SELECT migration_name
            FROM "_prisma_migrations"
            ORDER BY migration_name
          `;
          assertNames(
            legacyRows.map((row) => row.migration_name),
            legacyMigrationNames,
            "legacy"
          );
          runPrisma(
            ["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH],
            targetUrl
          );

          await admin.$executeRawUnsafe(
            `CREATE TABLE "${backupSchema}"."_prisma_migrations" AS TABLE "${targetSchema}"."_prisma_migrations"`
          );

          const divergence = runPrisma(
            ["migrate", "status", "--schema", workspace.schemaPath],
            targetUrl,
            [0, 1]
          );
          if (divergence.status === 0) {
            throw new Error(
              "proposed_history_unexpectedly_clean_before_reconcile"
            );
          }

          runPrisma(
            [
              "migrate",
              "resolve",
              "--applied",
              BASELINE_MIGRATION_NAME,
              "--schema",
              workspace.schemaPath,
            ],
            targetUrl,
            [0],
            DISABLE_PRISMA_SESSION_LOCK
          );

          const transitionRows = await target.$queryRaw<
            Array<{ migration_name: string }>
          >`
            SELECT migration_name
            FROM "_prisma_migrations"
            ORDER BY migration_name
          `;
          assertNames(
            transitionRows.map((row) => row.migration_name),
            [...legacyMigrationNames, BASELINE_MIGRATION_NAME],
            "transition"
          );

          const deletedLegacy = await target.$executeRaw`
            DELETE FROM "_prisma_migrations"
            WHERE migration_name <> ${BASELINE_MIGRATION_NAME}
          `;
          if (deletedLegacy !== EXPECTED_LEGACY_MIGRATION_COUNT) {
            throw new Error(
              `legacy_bookkeeping_delete_count_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${deletedLegacy}`
            );
          }

          const forwardRows = await target.$queryRaw<
            Array<{ migration_name: string }>
          >`
            SELECT migration_name FROM "_prisma_migrations"
          `;
          assertNames(
            forwardRows.map((row) => row.migration_name),
            [BASELINE_MIGRATION_NAME],
            "forward"
          );
          runPrisma(
            ["migrate", "status", "--schema", workspace.schemaPath],
            targetUrl
          );
          runPrisma(
            ["migrate", "deploy", "--schema", workspace.schemaPath],
            targetUrl,
            [0],
            DISABLE_PRISMA_SESSION_LOCK
          );
          await assertSchemaMatches(targetUrl, workspace.schemaPath);
          await verifyApplicationShape(target);

          const deletedBaseline = await target.$executeRaw`
            DELETE FROM "_prisma_migrations"
            WHERE migration_name = ${BASELINE_MIGRATION_NAME}
          `;
          if (deletedBaseline !== 1) {
            throw new Error(
              `baseline_bookkeeping_delete_count_expected_1_actual_${deletedBaseline}`
            );
          }
          const restoredLegacy = await admin.$executeRawUnsafe(`
            INSERT INTO "${targetSchema}"."_prisma_migrations"
              ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
            SELECT
              "id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count"
            FROM "${backupSchema}"."_prisma_migrations"
          `);
          if (restoredLegacy !== EXPECTED_LEGACY_MIGRATION_COUNT) {
            throw new Error(
              `legacy_bookkeeping_restore_count_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${restoredLegacy}`
            );
          }

          const rollbackDelta = await admin.$queryRawUnsafe<
            Array<{ count: number }>
          >(`
            SELECT COUNT(*)::int AS count
            FROM (
              (TABLE "${targetSchema}"."_prisma_migrations"
               EXCEPT ALL
               TABLE "${backupSchema}"."_prisma_migrations")
              UNION ALL
              (TABLE "${backupSchema}"."_prisma_migrations"
               EXCEPT ALL
               TABLE "${targetSchema}"."_prisma_migrations")
            ) AS delta
          `);
          if (rollbackDelta[0]?.count !== 0) {
            throw new Error("legacy_bookkeeping_rollback_not_exact");
          }

          runPrisma(
            ["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH],
            targetUrl
          );
          runPrisma(
            ["migrate", "deploy", "--schema", ACTIVE_SCHEMA_PATH],
            targetUrl,
            [0],
            DISABLE_PRISMA_SESSION_LOCK
          );
          const rollbackDivergence = runPrisma(
            ["migrate", "status", "--schema", workspace.schemaPath],
            targetUrl,
            [0, 1]
          );
          if (rollbackDivergence.status === 0) {
            throw new Error(
              "baseline_history_unexpectedly_clean_after_rollback"
            );
          }
          await assertSchemaMatches(targetUrl, ACTIVE_SCHEMA_PATH);
          await verifyApplicationShape(target);

          console.log(
            `Synthetic adoption rehearsal passed: ${EXPECTED_LEGACY_MIGRATION_COUNT} legacy rows -> 1 baseline row -> exact rollback.`
          );
        } finally {
          await target.$disconnect();
        }
      },
      { maxWait: 300_000, timeout: 300_000 }
    );
  } finally {
    try {
      if (backupCreated) {
        await admin.$executeRawUnsafe(`DROP SCHEMA "${backupSchema}" CASCADE`);
        await assertSchemaRemoved(admin, backupSchema);
        console.log("Temporary bookkeeping-backup schema removed.");
      }
      if (targetCreated) {
        await admin.$executeRawUnsafe(`DROP SCHEMA "${targetSchema}" CASCADE`);
        await assertSchemaRemoved(admin, targetSchema);
        console.log("Temporary rehearsal schema removed.");
      }
    } finally {
      await admin.$disconnect();
      await removeProposedMigrationWorkspace(workspace.root);
      console.log("Temporary migration workspace removed.");
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
