/**
 * Proves the candidate squashed baseline against an isolated PostgreSQL schema.
 *
 * This script never touches the active `public` schema. It requires the same
 * DATABASE_URL/QA_DATABASE_URL isolation guard as mutating integration tests,
 * creates a random QA schema, and drops that exact schema in `finally`.
 *
 * Modes:
 *   candidate          Apply and verify prisma/baseline (default)
 *   current-history    Confirm the active migration history fails from empty
 */
import { randomBytes } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

import { prepareIsolatedDatabaseEnv } from "../tests/helpers/database-safety";

const PRISMA_CLI = resolve("node_modules/prisma/build/index.js");
const SCHEMA_PATH = resolve("prisma/schema.prisma");
const BASELINE_PATH = resolve(
  "prisma/baseline/20260802010000_squashed_baseline/migration.sql"
);
const RAW_SQL_PATH = resolve(
  "prisma/raw-sql/0001-notification-partial-unique.sql"
);
const EXPECTED_TABLE_COUNT = 41;
const VERIFIER_ADVISORY_LOCK_ID = "68434670120260802";

type Mode = "candidate" | "current-history";
type CommandResult = SpawnSyncReturns<string>;

function parseMode(raw: string | undefined): Mode {
  if (!raw || raw === "candidate") return "candidate";
  if (raw === "current-history") return raw;
  throw new Error(
    "usage: verify-migration-baseline [candidate|current-history]"
  );
}

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
  return parsed.toString();
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv[2]);
  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  const qaUrl = isolatedEnv.QA_DATABASE_URL;
  if (!qaUrl) throw new Error("qa_database_url_required");

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

        if (mode === "current-history") {
          const result = runPrisma(
            ["migrate", "deploy", "--schema", SCHEMA_PATH],
            temporaryUrl,
            [0, 1],
            // The outer transaction-scoped verifier lock already serializes
            // this disposable proof. Prisma's session lock is unsafe through
            // transaction poolers and can outlive the client connection.
            { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" }
          );
          const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
          if (result.status === 0) {
            throw new Error("active_history_unexpectedly_succeeded_from_empty");
          }
          if (!/does not exist|P3018/i.test(output)) {
            throw new Error(
              `active_history_failed_for_unexpected_reason\n${redact(output, temporaryUrl)}`
            );
          }
          const missingRelation =
            /relation [`"]?([^`"\r\n]+)[`"]? does not exist/i.exec(
              output
            )?.[1] ?? "unknown";
          console.log(
            `Confirmed: active migration history cannot build from empty (first missing relation: ${missingRelation}).`
          );
          return;
        }

        runPrisma(
          ["db", "execute", "--file", BASELINE_PATH, "--schema", SCHEMA_PATH],
          temporaryUrl
        );

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
            `candidate_baseline_does_not_match_schema\n${redact(diff.stdout ?? "", temporaryUrl)}`
          );
        }

        const temporary = new PrismaClient({ datasourceUrl: temporaryUrl });
        try {
          const tables = await temporary.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_type = 'BASE TABLE'
          `;
          if (tables[0]?.count !== EXPECTED_TABLE_COUNT) {
            throw new Error(
              `candidate_table_count_mismatch_expected_${EXPECTED_TABLE_COUNT}_actual_${tables[0]?.count ?? "missing"}`
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
              "candidate_partial_index_differs_from_raw_sql_source"
            );
          }

          console.log(
            `Candidate baseline verified: ${EXPECTED_TABLE_COUNT} tables, schema diff empty, partial index matches raw SQL.`
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
