/**
 * Rehearses baseline bookkeeping against a dedicated deployment clone.
 *
 * The preflight mode is read-only. The rehearse mode temporarily replaces the
 * clone's public._prisma_migrations rows, proves the baseline-only history, and
 * restores the original rows byte-for-byte in finally. Production and QA URLs
 * are rejected before a connection is opened.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  access,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

import {
  assertBaselineRehearsalDatabase,
  prepareBaselineRehearsalEnv,
} from "../tests/helpers/database-safety";

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
const BASELINE_SHA256 =
  "e6ae697be28775d536bf613652522b213056f2d7096a4c3add20b551a76f135e";
const EXPECTED_LEGACY_MIGRATION_COUNT = 14;
const EXPECTED_TABLE_COUNT = 41;
const CONFIRMATION = "REHEARSE_BASELINE_ON_DEPLOYMENT_CLONE";
const REHEARSAL_ADVISORY_LOCK_ID = "68434670120260803";

type Mode = "preflight" | "rehearse";
type CommandResult = SpawnSyncReturns<string>;
type DataSnapshot = {
  tables: Array<{ tableName: string; rowCount: number; digest: string }>;
  sequences: Array<{ sequenceName: string; lastValue: string | null }>;
};

function parseMode(): Mode {
  const mode = process.argv[2];
  if (mode === "preflight" || mode === "rehearse") return mode;
  throw new Error(
    "usage: rehearse-migration-baseline-clone <preflight|rehearse> [--confirm=REHEARSE_BASELINE_ON_DEPLOYMENT_CLONE]"
  );
}

function assertConfirmation(mode: Mode): void {
  if (mode === "preflight") return;
  const supplied = process.argv.find((arg) => arg.startsWith("--confirm="));
  if (supplied !== `--confirm=${CONFIRMATION}`) {
    throw new Error("deployment_clone_rehearsal_confirmation_required");
  }
}

function redact(value: string, databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  let redacted = value.replaceAll(databaseUrl, "[database-url-redacted]");
  if (parsed.password) {
    redacted = redacted.replaceAll(parsed.password, "[password-redacted]");
  }
  return redacted;
}

function runPrisma(
  args: string[],
  databaseUrl: string,
  allowedExitCodes: number[] = [0]
): CommandResult {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
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

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
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

async function assertCandidateHash(): Promise<void> {
  const sql = await readFile(BASELINE_PATH, "utf8");
  // Git may check this file out with CRLF on Windows. The reviewed evidence
  // hash is over the repository's LF-normalized SQL content.
  const actual = createHash("sha256")
    .update(sql.replaceAll("\r\n", "\n"))
    .digest("hex");
  if (actual !== BASELINE_SHA256) {
    throw new Error(
      `baseline_checksum_changed_expected_${BASELINE_SHA256}_actual_${actual}`
    );
  }
}

async function createProposedMigrationWorkspace(): Promise<{
  root: string;
  schemaPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "beagle-clone-rehearsal-"));
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
    !basename(resolvedRoot).startsWith("beagle-clone-rehearsal-")
  ) {
    throw new Error("unsafe_clone_rehearsal_workspace_cleanup_target");
  }
  const stats = await lstat(resolvedRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("unsafe_clone_rehearsal_workspace_type");
  }
  await rm(resolvedRoot, { recursive: true });
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

async function readMigrationRows(database: PrismaClient): Promise<
  Array<{
    migration_name: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>
> {
  return database.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM public."_prisma_migrations"
    ORDER BY migration_name
  `;
}

async function assertLegacyHistory(
  database: PrismaClient,
  legacyNames: string[]
): Promise<void> {
  const rows = await readMigrationRows(database);
  assertNames(
    rows.map((row) => row.migration_name),
    legacyNames,
    "deployment_clone_legacy"
  );
  if (rows.some((row) => !row.finished_at || row.rolled_back_at)) {
    throw new Error("deployment_clone_has_incomplete_or_rolled_back_migration");
  }
}

async function assertPublicSchema(database: PrismaClient): Promise<void> {
  const rows = await database.$queryRaw<Array<{ schema_name: string }>>`
    SELECT current_schema()::text AS schema_name
  `;
  if (rows[0]?.schema_name !== "public") {
    throw new Error("deployment_clone_active_schema_is_not_public");
  }
}

async function verifyApplicationShape(database: PrismaClient): Promise<void> {
  const tables = await database.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `;
  if (tables[0]?.count !== EXPECTED_TABLE_COUNT) {
    throw new Error(
      `deployment_clone_table_count_mismatch_expected_${EXPECTED_TABLE_COUNT}_actual_${tables[0]?.count ?? "missing"}`
    );
  }

  const indexes = await database.$queryRaw<Array<{ indexdef: string }>>`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'notification_post_once'
  `;
  const definition = indexes[0]?.indexdef ?? "";
  if (!definition.includes("UNIQUE INDEX") || !definition.includes("WHERE")) {
    throw new Error("deployment_clone_partial_unique_index_missing");
  }

  await Promise.all([
    database.user.count(),
    database.courseOffering.count(),
    database.assignment.count(),
    database.notification.count(),
    database.webPushSubscription.count(),
  ]);
}

async function captureDataSnapshot(
  database: PrismaClient
): Promise<DataSnapshot> {
  const names = await database.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;
  if (names.length !== EXPECTED_TABLE_COUNT) {
    throw new Error("deployment_clone_snapshot_table_count_mismatch");
  }

  const tables: DataSnapshot["tables"] = [];
  for (const { table_name: tableName } of names) {
    const identifier = quoteIdentifier(tableName);
    const rows = await database.$queryRawUnsafe<
      Array<{ row_count: number; digest: string }>
    >(`
      SELECT
        COUNT(*)::int AS row_count,
        COALESCE(md5(string_agg(row_hash, '' ORDER BY row_hash)), md5('')) AS digest
      FROM (
        SELECT md5(to_jsonb(source_row)::text) AS row_hash
        FROM public.${identifier} AS source_row
      ) AS row_hashes
    `);
    const row = rows[0];
    if (!row) throw new Error(`deployment_clone_snapshot_failed_${tableName}`);
    tables.push({ tableName, rowCount: row.row_count, digest: row.digest });
  }

  const sequences = await database.$queryRaw<
    Array<{ sequence_name: string; last_value: bigint | null }>
  >`
    SELECT sequencename AS sequence_name, last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
    ORDER BY sequencename
  `;

  return {
    tables,
    sequences: sequences.map((row) => ({
      sequenceName: row.sequence_name,
      lastValue: row.last_value?.toString() ?? null,
    })),
  };
}

function assertDataSnapshot(
  actual: DataSnapshot,
  expected: DataSnapshot,
  label: string
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}_application_data_changed`);
  }
}

function totalRows(snapshot: DataSnapshot): number {
  return snapshot.tables.reduce((sum, table) => sum + table.rowCount, 0);
}

function assertSchemaMatches(databaseUrl: string, schemaPath: string): void {
  const result = runPrisma(
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
  if (result.status !== 0) {
    throw new Error(
      `deployment_clone_schema_diff_detected\n${redact(result.stdout ?? "", databaseUrl)}`
    );
  }
}

async function assertBackupMatches(
  database: PrismaClient,
  backupSchema: string
): Promise<void> {
  const quoted = quoteIdentifier(backupSchema);
  const rows = await database.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count
    FROM (
      (TABLE public."_prisma_migrations"
       EXCEPT ALL
       TABLE ${quoted}."_prisma_migrations")
      UNION ALL
      (TABLE ${quoted}."_prisma_migrations"
       EXCEPT ALL
       TABLE public."_prisma_migrations")
    ) AS delta
  `);
  if (rows[0]?.count !== 0) {
    throw new Error("deployment_clone_migration_backup_mismatch");
  }
}

async function runPreflight(
  database: PrismaClient,
  databaseUrl: string,
  legacyNames: string[],
  proposedSchemaPath: string
): Promise<DataSnapshot> {
  await assertPublicSchema(database);
  await assertLegacyHistory(database, legacyNames);
  await verifyApplicationShape(database);
  runPrisma(["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH], databaseUrl);
  assertSchemaMatches(databaseUrl, ACTIVE_SCHEMA_PATH);

  const proposedStatus = runPrisma(
    ["migrate", "status", "--schema", proposedSchemaPath],
    databaseUrl,
    [0, 1]
  );
  if (proposedStatus.status === 0) {
    throw new Error("deployment_clone_proposed_history_unexpectedly_clean");
  }

  const snapshot = await captureDataSnapshot(database);
  console.log(
    `Deployment clone preflight passed: ${legacyNames.length} migrations, ${snapshot.tables.length} application tables, ${totalRows(snapshot)} application rows.`
  );
  return snapshot;
}

async function rehearse(
  database: PrismaClient,
  databaseUrl: string,
  legacyNames: string[],
  proposedSchemaPath: string,
  before: DataSnapshot
): Promise<void> {
  const backupSchema = `beagle_clone_rehearsal_${randomBytes(8).toString("hex")}_backup`;
  if (!/^beagle_clone_rehearsal_[a-f0-9]{16}_backup$/.test(backupSchema)) {
    throw new Error("unsafe_clone_rehearsal_backup_schema_name");
  }
  const quotedBackup = quoteIdentifier(backupSchema);
  let backupCreated = false;
  let rollbackVerified = false;

  try {
    await database.$executeRawUnsafe(`CREATE SCHEMA ${quotedBackup}`);
    backupCreated = true;
    await database.$executeRawUnsafe(
      `CREATE TABLE ${quotedBackup}."_prisma_migrations" AS TABLE public."_prisma_migrations"`
    );
    await assertBackupMatches(database, backupSchema);

    runPrisma(
      [
        "migrate",
        "resolve",
        "--applied",
        BASELINE_MIGRATION_NAME,
        "--schema",
        proposedSchemaPath,
      ],
      databaseUrl
    );

    const transitionRows = await readMigrationRows(database);
    assertNames(
      transitionRows.map((row) => row.migration_name),
      [...legacyNames, BASELINE_MIGRATION_NAME],
      "deployment_clone_transition"
    );

    const deleted = await database.$executeRaw`
      DELETE FROM public."_prisma_migrations"
      WHERE migration_name <> ${BASELINE_MIGRATION_NAME}
    `;
    if (deleted !== EXPECTED_LEGACY_MIGRATION_COUNT) {
      throw new Error(
        `deployment_clone_legacy_delete_count_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${deleted}`
      );
    }

    const baselineRows = await readMigrationRows(database);
    assertNames(
      baselineRows.map((row) => row.migration_name),
      [BASELINE_MIGRATION_NAME],
      "deployment_clone_baseline"
    );
    runPrisma(
      ["migrate", "status", "--schema", proposedSchemaPath],
      databaseUrl
    );
    runPrisma(
      ["migrate", "deploy", "--schema", proposedSchemaPath],
      databaseUrl
    );
    assertSchemaMatches(databaseUrl, proposedSchemaPath);
    await verifyApplicationShape(database);
    assertDataSnapshot(
      await captureDataSnapshot(database),
      before,
      "deployment_clone_forward"
    );
    console.log(
      `Deployment clone forward proof passed: ${legacyNames.length} legacy rows -> 1 baseline row; schema and application data unchanged.`
    );
  } finally {
    if (backupCreated) {
      try {
        await database.$executeRawUnsafe(
          `TRUNCATE TABLE public."_prisma_migrations"`
        );
        const restored = await database.$executeRawUnsafe(`
          INSERT INTO public."_prisma_migrations"
            ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
          SELECT
            "id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count"
          FROM ${quotedBackup}."_prisma_migrations"
        `);
        if (restored !== EXPECTED_LEGACY_MIGRATION_COUNT) {
          throw new Error(
            `deployment_clone_legacy_restore_count_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${restored}`
          );
        }
        await assertBackupMatches(database, backupSchema);
        await assertLegacyHistory(database, legacyNames);
        runPrisma(
          ["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH],
          databaseUrl
        );
        assertSchemaMatches(databaseUrl, ACTIVE_SCHEMA_PATH);
        await verifyApplicationShape(database);
        assertDataSnapshot(
          await captureDataSnapshot(database),
          before,
          "deployment_clone_rollback"
        );
        rollbackVerified = true;
        console.log(
          `Deployment clone rollback passed: original ${legacyNames.length} migration rows restored byte-for-byte; schema and application data unchanged.`
        );
      } finally {
        if (rollbackVerified) {
          await database.$executeRawUnsafe(
            `DROP SCHEMA ${quotedBackup} CASCADE`
          );
          const remaining = await database.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM information_schema.schemata
            WHERE schema_name = ${backupSchema}
          `;
          if (remaining[0]?.count !== 0) {
            throw new Error("deployment_clone_backup_schema_cleanup_failed");
          }
          console.log("Temporary clone bookkeeping backup removed.");
        } else {
          console.error(
            `Rollback could not be verified. Preserved recovery schema: ${backupSchema}`
          );
        }
      }
    }
  }
}

async function main(): Promise<void> {
  const mode = parseMode();
  assertConfirmation(mode);
  const rehearsalEnv = prepareBaselineRehearsalEnv(process.env);
  assertBaselineRehearsalDatabase(rehearsalEnv);
  const databaseUrl = rehearsalEnv.DATABASE_URL;
  if (!databaseUrl) throw new Error("baseline_rehearsal_database_url_required");

  await assertCandidateHash();
  const legacyNames = await listLegacyMigrationNames();
  const workspace = await createProposedMigrationWorkspace();
  const database = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    await database.$transaction(
      async (lock) => {
        await lock.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REHEARSAL_ADVISORY_LOCK_ID})::text AS lock`
        );
        const before = await runPreflight(
          database,
          databaseUrl,
          legacyNames,
          workspace.schemaPath
        );
        if (mode === "preflight") return;
        await rehearse(
          database,
          databaseUrl,
          legacyNames,
          workspace.schemaPath,
          before
        );
      },
      { maxWait: 600_000, timeout: 600_000 }
    );
  } finally {
    await database.$disconnect();
    await removeProposedMigrationWorkspace(workspace.root);
    console.log("Temporary clone migration workspace removed.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
