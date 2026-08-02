/**
 * Adopts, verifies, and can roll back the squashed migration baseline on QA or
 * Production. QA is the default target; Production requires an explicit target
 * flag, a separate current backup, and Production-only confirmation tokens.
 */
import { createHash } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
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
  assertProductionBaselineAdoptionDatabase,
  assertQaBaselineAdoptionDatabase,
  prepareProductionBaselineAdoptionEnv,
  prepareQaBaselineAdoptionEnv,
} from "../tests/helpers/database-safety";

type AdoptionTarget = "qa" | "production";

function parseTarget(): AdoptionTarget {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  if (!targetArg || targetArg === "--target=qa") return "qa";
  if (targetArg === "--target=production") return "production";
  throw new Error("baseline_adoption_target_must_be_qa_or_production");
}

const ADOPTION_TARGET = parseTarget();
const TARGET_DISPLAY = ADOPTION_TARGET === "qa" ? "QA" : "Production";
const TARGET_ERROR_PREFIX = ADOPTION_TARGET === "qa" ? "qa" : "production";

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
const MIGRATION_BACKUP_SCHEMA =
  ADOPTION_TARGET === "qa"
    ? "beagle_baseline_qa_backup_20260802"
    : "beagle_baseline_production_backup_20260803";
const EXPECTED_LEGACY_MIGRATION_COUNT = 14;
const EXPECTED_TABLE_COUNT = 41;
const ADOPTION_CONFIRMATION =
  ADOPTION_TARGET === "qa"
    ? "ADOPT_BASELINE_ON_QA_20260802"
    : "ADOPT_BASELINE_ON_PRODUCTION_20260803";
const ROLLBACK_CONFIRMATION =
  ADOPTION_TARGET === "qa"
    ? "ROLLBACK_BASELINE_ON_QA_20260802"
    : "ROLLBACK_BASELINE_ON_PRODUCTION_20260803";
const DEPLOY_CONFIRMATION =
  ADOPTION_TARGET === "qa"
    ? "DEPLOY_BASELINE_QA_MIGRATIONS"
    : "DEPLOY_BASELINE_PRODUCTION_MIGRATIONS";
const ADVISORY_LOCK_ID =
  ADOPTION_TARGET === "qa" ? "68434670120260804" : "68434670120260805";
const WORKSPACE_PREFIX = `beagle-${ADOPTION_TARGET}-baseline-adoption-`;

type Mode = "preflight" | "adopt" | "status" | "deploy" | "rollback";
type CommandResult = SpawnSyncReturns<string>;
type DataSnapshot = {
  tables: Array<{ tableName: string; rowCount: number; digest: string }>;
  sequences: Array<{ sequenceName: string; lastValue: string | null }>;
};

function parseMode(): Mode {
  const mode = process.argv[2];
  if (
    mode === "preflight" ||
    mode === "adopt" ||
    mode === "status" ||
    mode === "deploy" ||
    mode === "rollback"
  ) {
    return mode;
  }
  throw new Error(
    "usage: adopt-migration-baseline-qa <preflight|adopt|status|deploy|rollback> [--target=qa|production] [--confirm=TOKEN]"
  );
}

function assertConfirmation(mode: Mode): void {
  const expected =
    mode === "adopt"
      ? ADOPTION_CONFIRMATION
      : mode === "rollback"
        ? ROLLBACK_CONFIRMATION
        : mode === "deploy"
          ? DEPLOY_CONFIRMATION
          : null;
  if (!expected) return;
  if (!process.argv.includes(`--confirm=${expected}`)) {
    throw new Error(
      `${TARGET_ERROR_PREFIX}_baseline_${mode}_confirmation_required`
    );
  }
}

function withoutNeonPooler(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname.endsWith(".neon.tech")) {
    parsed.hostname = parsed.hostname.replace(/-pooler(?=\.)/, "");
  }
  return parsed.toString();
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
  return names;
}

async function assertCandidateHash(): Promise<void> {
  const sql = await readFile(BASELINE_PATH, "utf8");
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
  const root = await mkdtemp(join(tmpdir(), WORKSPACE_PREFIX));
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
    await removeWorkspace(root);
    throw error;
  }
}

async function removeWorkspace(root: string): Promise<void> {
  const resolvedRoot = resolve(root);
  if (
    dirname(resolvedRoot) !== resolve(tmpdir()) ||
    !basename(resolvedRoot).startsWith(WORKSPACE_PREFIX)
  ) {
    throw new Error(
      `unsafe_${TARGET_ERROR_PREFIX}_baseline_workspace_cleanup_target`
    );
  }
  const stats = await lstat(resolvedRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`unsafe_${TARGET_ERROR_PREFIX}_baseline_workspace_type`);
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

async function readMigrationRecords(
  database: PrismaClient
): Promise<Array<Record<string, string | null>>> {
  return database.$queryRaw`
    SELECT
      id::text,
      checksum::text,
      finished_at::text,
      migration_name::text,
      logs::text,
      rolled_back_at::text,
      started_at::text,
      applied_steps_count::text
    FROM public."_prisma_migrations"
    ORDER BY migration_name
  `;
}

async function readMigrationNames(database: PrismaClient): Promise<string[]> {
  const rows = await database.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name
    FROM public."_prisma_migrations"
    ORDER BY migration_name
  `;
  return rows.map((row) => row.migration_name);
}

async function assertLegacyHistory(
  database: PrismaClient,
  legacyNames: string[],
  label: string
): Promise<void> {
  assertNames(await readMigrationNames(database), legacyNames, label);
  const incomplete = await database.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM public."_prisma_migrations"
    WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
  `;
  if (incomplete[0]?.count !== 0) {
    throw new Error(`${label}_has_incomplete_or_rolled_back_migration`);
  }
}

async function assertBaselineHistory(database: PrismaClient): Promise<void> {
  assertNames(
    await readMigrationNames(database),
    [BASELINE_MIGRATION_NAME],
    `${TARGET_ERROR_PREFIX}_baseline`
  );
}

async function assertPublicSchema(
  database: PrismaClient,
  label: string
): Promise<void> {
  const rows = await database.$queryRaw<Array<{ schema_name: string }>>`
    SELECT current_schema()::text AS schema_name
  `;
  if (rows[0]?.schema_name !== "public") {
    throw new Error(`${label}_active_schema_is_not_public`);
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
      `${TARGET_ERROR_PREFIX}_table_count_mismatch_expected_${EXPECTED_TABLE_COUNT}_actual_${tables[0]?.count ?? "missing"}`
    );
  }
  const indexes = await database.$queryRaw<Array<{ indexdef: string }>>`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'notification_post_once'
  `;
  const definition = indexes[0]?.indexdef ?? "";
  if (!definition.includes("UNIQUE INDEX") || !definition.includes("WHERE")) {
    throw new Error(`${TARGET_ERROR_PREFIX}_partial_unique_index_missing`);
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
    throw new Error(`${TARGET_ERROR_PREFIX}_snapshot_table_count_mismatch`);
  }
  const tables: DataSnapshot["tables"] = [];
  for (const { table_name: tableName } of names) {
    const rows = await database.$queryRawUnsafe<
      Array<{ row_count: number; digest: string }>
    >(`
      SELECT
        COUNT(*)::int AS row_count,
        COALESCE(md5(string_agg(row_hash, '' ORDER BY row_hash)), md5('')) AS digest
      FROM (
        SELECT md5(to_jsonb(source_row)::text) AS row_hash
        FROM public.${quoteIdentifier(tableName)} AS source_row
      ) AS row_hashes
    `);
    const row = rows[0];
    if (!row) {
      throw new Error(`${TARGET_ERROR_PREFIX}_snapshot_failed_${tableName}`);
    }
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

function assertSameSnapshot(
  actual: DataSnapshot,
  expected: DataSnapshot,
  label: string
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}_application_data_or_sequences_changed`);
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
      `${TARGET_ERROR_PREFIX}_schema_diff_detected\n${redact(result.stdout ?? "", databaseUrl)}`
    );
  }
}

async function assertBackupSchemaAbsent(database: PrismaClient): Promise<void> {
  const rows = await database.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.schemata
    WHERE schema_name = ${MIGRATION_BACKUP_SCHEMA}
  `;
  if (rows[0]?.count !== 0) {
    throw new Error(
      `${TARGET_ERROR_PREFIX}_migration_backup_schema_already_exists`
    );
  }
}

async function assertMigrationBackupMatches(
  database: PrismaClient
): Promise<void> {
  const schema = quoteIdentifier(MIGRATION_BACKUP_SCHEMA);
  const rows = await database.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count
    FROM (
      (TABLE public."_prisma_migrations"
       EXCEPT ALL
       TABLE ${schema}."_prisma_migrations")
      UNION ALL
      (TABLE ${schema}."_prisma_migrations"
       EXCEPT ALL
       TABLE public."_prisma_migrations")
    ) AS delta
  `);
  if (rows[0]?.count !== 0) {
    throw new Error(`${TARGET_ERROR_PREFIX}_migration_backup_mismatch`);
  }
}

async function runPreflight(
  target: PrismaClient,
  backup: PrismaClient,
  targetUrl: string,
  backupUrl: string,
  legacyNames: string[],
  proposedSchemaPath: string
): Promise<DataSnapshot> {
  await Promise.all([
    assertPublicSchema(target, TARGET_ERROR_PREFIX),
    assertPublicSchema(backup, `${TARGET_ERROR_PREFIX}_backup`),
    assertLegacyHistory(target, legacyNames, `${TARGET_ERROR_PREFIX}_legacy`),
    assertLegacyHistory(
      backup,
      legacyNames,
      `${TARGET_ERROR_PREFIX}_backup_legacy`
    ),
    verifyApplicationShape(target),
    verifyApplicationShape(backup),
  ]);
  runPrisma(["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH], targetUrl);
  runPrisma(["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH], backupUrl);
  assertSchemaMatches(targetUrl, ACTIVE_SCHEMA_PATH);
  assertSchemaMatches(backupUrl, ACTIVE_SCHEMA_PATH);

  const proposed = runPrisma(
    ["migrate", "status", "--schema", proposedSchemaPath],
    targetUrl,
    [0, 1]
  );
  if (proposed.status === 0) {
    throw new Error(
      `${TARGET_ERROR_PREFIX}_proposed_history_unexpectedly_clean_before_adoption`
    );
  }

  const [targetSnapshot, backupSnapshot, targetMigrations, backupMigrations] =
    await Promise.all([
      captureDataSnapshot(target),
      captureDataSnapshot(backup),
      readMigrationRecords(target),
      readMigrationRecords(backup),
    ]);
  assertSameSnapshot(
    targetSnapshot,
    backupSnapshot,
    `${TARGET_ERROR_PREFIX}_backup`
  );
  if (JSON.stringify(targetMigrations) !== JSON.stringify(backupMigrations)) {
    throw new Error(`${TARGET_ERROR_PREFIX}_backup_migration_records_differ`);
  }
  console.log(
    `${TARGET_DISPLAY} baseline preflight passed: restorable backup matches ${legacyNames.length} migrations, ${targetSnapshot.tables.length} tables, and ${totalRows(targetSnapshot)} application rows.`
  );
  return targetSnapshot;
}

async function restoreLegacyHistory(
  target: PrismaClient,
  targetUrl: string,
  legacyNames: string[],
  before: DataSnapshot,
  dropBackupAfter: boolean
): Promise<void> {
  const schema = quoteIdentifier(MIGRATION_BACKUP_SCHEMA);
  await target.$executeRawUnsafe(`TRUNCATE TABLE public."_prisma_migrations"`);
  const restored = await target.$executeRawUnsafe(`
    INSERT INTO public."_prisma_migrations"
      ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
    SELECT
      "id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count"
    FROM ${schema}."_prisma_migrations"
  `);
  if (restored !== EXPECTED_LEGACY_MIGRATION_COUNT) {
    throw new Error(
      `${TARGET_ERROR_PREFIX}_legacy_restore_count_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${restored}`
    );
  }
  await assertMigrationBackupMatches(target);
  await assertLegacyHistory(
    target,
    legacyNames,
    `${TARGET_ERROR_PREFIX}_restored_legacy`
  );
  runPrisma(["migrate", "status", "--schema", ACTIVE_SCHEMA_PATH], targetUrl);
  assertSchemaMatches(targetUrl, ACTIVE_SCHEMA_PATH);
  await verifyApplicationShape(target);
  assertSameSnapshot(
    await captureDataSnapshot(target),
    before,
    `${TARGET_ERROR_PREFIX}_rollback`
  );
  if (dropBackupAfter) {
    await target.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
  }
}

async function adoptBaseline(
  target: PrismaClient,
  targetUrl: string,
  legacyNames: string[],
  proposedSchemaPath: string,
  before: DataSnapshot
): Promise<void> {
  await assertBackupSchemaAbsent(target);
  const schema = quoteIdentifier(MIGRATION_BACKUP_SCHEMA);
  let backupCreated = false;
  try {
    await target.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    backupCreated = true;
    await target.$executeRawUnsafe(
      `CREATE TABLE ${schema}."_prisma_migrations" AS TABLE public."_prisma_migrations"`
    );
    await assertMigrationBackupMatches(target);

    runPrisma(
      [
        "migrate",
        "resolve",
        "--applied",
        BASELINE_MIGRATION_NAME,
        "--schema",
        proposedSchemaPath,
      ],
      targetUrl
    );
    assertNames(
      await readMigrationNames(target),
      [...legacyNames, BASELINE_MIGRATION_NAME],
      `${TARGET_ERROR_PREFIX}_transition`
    );
    const deleted = await target.$executeRaw`
      DELETE FROM public."_prisma_migrations"
      WHERE migration_name <> ${BASELINE_MIGRATION_NAME}
    `;
    if (deleted !== EXPECTED_LEGACY_MIGRATION_COUNT) {
      throw new Error(
        `${TARGET_ERROR_PREFIX}_legacy_delete_count_expected_${EXPECTED_LEGACY_MIGRATION_COUNT}_actual_${deleted}`
      );
    }
    await assertBaselineHistory(target);
    runPrisma(["migrate", "status", "--schema", proposedSchemaPath], targetUrl);
    runPrisma(["migrate", "deploy", "--schema", proposedSchemaPath], targetUrl);
    assertSchemaMatches(targetUrl, proposedSchemaPath);
    await verifyApplicationShape(target);
    assertSameSnapshot(
      await captureDataSnapshot(target),
      before,
      `${TARGET_ERROR_PREFIX}_adoption`
    );
    console.log(
      `${TARGET_DISPLAY} baseline adoption passed: ${legacyNames.length} legacy rows -> 1 baseline row; schema and application data unchanged.`
    );
    console.log(
      `Rollback bookkeeping retained in schema ${MIGRATION_BACKUP_SCHEMA}.`
    );
  } catch (error) {
    if (backupCreated) {
      await restoreLegacyHistory(target, targetUrl, legacyNames, before, true);
      console.error(
        `${TARGET_DISPLAY} adoption failed; legacy bookkeeping restored exactly.`
      );
    }
    throw error;
  }
}

async function verifyAdoptedState(
  target: PrismaClient,
  targetUrl: string,
  proposedSchemaPath: string,
  deploy: boolean
): Promise<void> {
  await assertPublicSchema(target, TARGET_ERROR_PREFIX);
  await assertBaselineHistory(target);
  runPrisma(["migrate", "status", "--schema", proposedSchemaPath], targetUrl);
  if (deploy) {
    runPrisma(["migrate", "deploy", "--schema", proposedSchemaPath], targetUrl);
  }
  assertSchemaMatches(targetUrl, proposedSchemaPath);
  await verifyApplicationShape(target);
  console.log(
    `${TARGET_DISPLAY} baseline ${deploy ? "deploy" : "status"} verification passed.`
  );
}

async function main(): Promise<void> {
  const mode = parseMode();
  assertConfirmation(mode);
  const adoptionEnv =
    ADOPTION_TARGET === "qa"
      ? prepareQaBaselineAdoptionEnv(process.env)
      : prepareProductionBaselineAdoptionEnv(process.env);
  if (ADOPTION_TARGET === "qa") {
    assertQaBaselineAdoptionDatabase(adoptionEnv);
  } else {
    assertProductionBaselineAdoptionDatabase(adoptionEnv);
  }
  const targetUrl = withoutNeonPooler(adoptionEnv.DATABASE_URL ?? "");
  const backupUrl =
    adoptionEnv[
      ADOPTION_TARGET === "qa"
        ? "QA_BASELINE_BACKUP_DATABASE_URL"
        : "PRODUCTION_BASELINE_BACKUP_DATABASE_URL"
    ] ?? "";
  if (!targetUrl || !backupUrl) {
    throw new Error(`${TARGET_ERROR_PREFIX}_or_backup_database_url_missing`);
  }

  await assertCandidateHash();
  const legacyNames = await listLegacyMigrationNames();
  const workspace = await createProposedMigrationWorkspace();
  const target = new PrismaClient({ datasourceUrl: targetUrl });
  const backup = new PrismaClient({ datasourceUrl: backupUrl });

  try {
    await target.$transaction(
      async (lock) => {
        await lock.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ID})::text AS lock`
        );
        if (mode === "preflight" || mode === "adopt") {
          const before = await runPreflight(
            target,
            backup,
            targetUrl,
            backupUrl,
            legacyNames,
            workspace.schemaPath
          );
          if (mode === "adopt") {
            await adoptBaseline(
              target,
              targetUrl,
              legacyNames,
              workspace.schemaPath,
              before
            );
          }
          return;
        }
        if (mode === "status" || mode === "deploy") {
          await verifyAdoptedState(
            target,
            targetUrl,
            workspace.schemaPath,
            mode === "deploy"
          );
          return;
        }

        await assertBaselineHistory(target);
        const before = await captureDataSnapshot(target);
        await restoreLegacyHistory(
          target,
          targetUrl,
          legacyNames,
          before,
          true
        );
        console.log(
          `${TARGET_DISPLAY} baseline rollback passed: original ${legacyNames.length} migration rows restored byte-for-byte; application data unchanged.`
        );
      },
      { maxWait: 600_000, timeout: 600_000 }
    );
  } finally {
    await Promise.all([target.$disconnect(), backup.$disconnect()]);
    await removeWorkspace(workspace.root);
    console.log(`Temporary ${TARGET_DISPLAY} baseline workspace removed.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
