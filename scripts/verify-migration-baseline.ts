/**
 * Proves the recorded migration history against an isolated PostgreSQL schema.
 *
 * The gate answers one question: does a database built only from
 * `prisma/migrations` match `prisma/schema.prisma`? It applies the whole folder
 * with `migrate deploy`, not the squashed baseline file alone. Applying the
 * baseline alone would silently assume nothing is ever added after it, which
 * stopped being true with `20260811000000_add_meeting_url`. Every schema change
 * from here on arrives as a migration after the baseline and is proven this way.
 *
 * The baseline file itself is never edited: QA and Production have both recorded
 * it as applied, so changing it would make the deployed databases disagree with
 * their own migration history.
 *
 * This script never touches the active `public` schema. It requires the same
 * DATABASE_URL/QA_DATABASE_URL isolation guard as mutating integration tests,
 * creates a random QA schema, and drops that exact schema in `finally`.
 *
 */
import { randomBytes } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

const PRISMA_CLI = resolve("node_modules/prisma/build/index.js");
const SCHEMA_PATH = resolve("prisma/schema.prisma");
const MIGRATIONS_DIR = resolve("prisma/migrations");
const RAW_SQL_PATH = resolve(
  "prisma/raw-sql/0001-notification-partial-unique.sql"
);
// Bumped deliberately, never to make a red gate green: the count exists so a
// table that disappears from a migration is caught. 42 → 46 adds the four
// persistent Chat foundation tables (ADR-0050). 46 → 47 adds the immutable
// Reward ledger table (ADR-0051).
const EXPECTED_TABLE_COUNT = 47;
const VERIFIER_ADVISORY_LOCK_ID = "68434670120260802";

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

async function main(): Promise<void> {
  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  const isolatedQaUrl = isolatedEnv.QA_DATABASE_URL;
  if (!isolatedQaUrl) throw new Error("qa_database_url_required");

  // Transaction poolers may reuse a backend session whose search_path was set
  // by another disposable-schema process. Use Neon's direct endpoint after the
  // QA-vs-primary identity guard has passed; withSchema also pins search_path
  // as a connection startup option. Non-Neon hosts are unchanged.
  const qaUrl = withoutNeonPooler(isolatedQaUrl);

  const expectedMigrationCount = readdirSync(MIGRATIONS_DIR, {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory()).length;
  if (expectedMigrationCount === 0) throw new Error("no_migrations_found");

  const schemaName = `beagle_baseline_${randomBytes(8).toString("hex")}`;
  if (!/^beagle_baseline_[a-f0-9]{16}$/.test(schemaName)) {
    throw new Error("unsafe_temporary_schema_name");
  }

  const activeSchema = new URL(qaUrl).searchParams.get("schema") ?? "public";
  if (schemaName === activeSchema || activeSchema === schemaName) {
    throw new Error("temporary_schema_matches_active_schema");
  }

  const temporaryUrl = withSchema(qaUrl, schemaName);
  const admin = new PrismaClient({ datasourceUrl: qaUrl });
  let schemaCreated = false;

  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;

    // Prisma's migration advisory lock is database-wide, while Neon pooled
    // connections can also reuse session state across schemas. Serialize this
    // verifier's modes with a separate transaction-scoped lock so parallel
    // local/CI invocations cannot contaminate each other's search_path.
    await admin.$transaction(
      async (lock) => {
        await lock.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${VERIFIER_ADVISORY_LOCK_ID})::text AS lock`
        );

        runPrisma(["migrate", "deploy", "--schema", SCHEMA_PATH], temporaryUrl);

        const diff = runPrisma(
          [
            "migrate",
            "diff",
            "--from-schema-datasource",
            SCHEMA_PATH,
            "--to-schema-datamodel",
            SCHEMA_PATH,
            "--exit-code",
          ],
          temporaryUrl,
          [0, 2]
        );
        if (diff.status !== 0) {
          throw new Error(
            `migration_history_does_not_match_schema\n${redact(diff.stdout ?? "", temporaryUrl)}`
          );
        }

        const temporary = new PrismaClient({ datasourceUrl: temporaryUrl });
        try {
          // `migrate deploy` also creates its own bookkeeping table. Counting
          // application tables only keeps this number comparable with the
          // deployed databases, which report the same 41.
          const tables = await temporary.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_type = 'BASE TABLE'
              AND table_name <> '_prisma_migrations'
          `;
          if (tables[0]?.count !== EXPECTED_TABLE_COUNT) {
            throw new Error(
              `migration_history_table_count_mismatch_expected_${EXPECTED_TABLE_COUNT}_actual_${tables[0]?.count ?? "missing"}`
            );
          }

          // Every directory under prisma/migrations must have been applied, so
          // a migration that is present but silently skipped cannot pass.
          const applied = await temporary.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM "_prisma_migrations"
            WHERE finished_at IS NOT NULL
              AND rolled_back_at IS NULL
          `;
          if (applied[0]?.count !== expectedMigrationCount) {
            throw new Error(
              `migration_history_applied_count_mismatch_expected_${expectedMigrationCount}_actual_${applied[0]?.count ?? "missing"}`
            );
          }

          const indexes = await temporary.$queryRaw<
            Array<{ indexdef: string }>
          >`
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND indexname = 'notification_post_once'
          `;
          const definition = indexes[0]?.indexdef ?? "";
          if (
            !definition.includes("UNIQUE INDEX") ||
            !definition.includes("WHERE")
          ) {
            throw new Error(
              "notification_post_once_partial_unique_index_missing"
            );
          }

          await temporary.$executeRawUnsafe(
            `DROP INDEX "notification_post_once"`
          );
          runPrisma(
            ["db", "execute", "--file", RAW_SQL_PATH, "--schema", SCHEMA_PATH],
            temporaryUrl
          );
          const rawIndexes = await temporary.$queryRaw<
            Array<{ indexdef: string }>
          >`
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND indexname = 'notification_post_once'
          `;
          if (
            normalizeSql(rawIndexes[0]?.indexdef ?? "") !==
            normalizeSql(definition)
          ) {
            throw new Error(
              "migration_history_partial_index_differs_from_raw_sql_source"
            );
          }

          console.log(
            `Migration history verified: ${expectedMigrationCount} migrations applied, ${EXPECTED_TABLE_COUNT} tables, schema diff empty, partial index matches raw SQL.`
          );
        } finally {
          await temporary.$disconnect();
        }
      },
      { maxWait: 120_000, timeout: 120_000 }
    );
  } finally {
    try {
      if (schemaCreated) {
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
        const remaining = await admin.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM information_schema.schemata
          WHERE schema_name = ${schemaName}
        `;
        if (remaining[0]?.count !== 0) {
          throw new Error("temporary_baseline_schema_cleanup_failed");
        }
        console.log("Temporary baseline schema removed.");
      }
    } finally {
      await admin.$disconnect();
    }
  }
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
