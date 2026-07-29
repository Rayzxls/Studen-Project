import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { databaseIdentity } from "../tests/helpers/database-safety";

type Target = "qa" | "production";
type Mode = "preflight" | "reset" | "verify";

const target = process.argv[2] as Target | undefined;
const mode = process.argv[3] as Mode | undefined;
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="));

if (
  (target !== "qa" && target !== "production") ||
  (mode !== "preflight" && mode !== "reset" && mode !== "verify")
) {
  throw new Error(
    "usage: reset-to-single-admin <qa|production> <preflight|reset|verify>"
  );
}

const primaryUrl = required("DATABASE_URL");
const qaUrl = required("QA_DATABASE_URL");
const primaryIdentity = databaseIdentity(primaryUrl);
const qaIdentity = databaseIdentity(qaUrl);

if (primaryIdentity === qaIdentity) {
  throw new Error("qa_database_matches_primary");
}

const activeUrl = target === "qa" ? qaUrl : primaryUrl;
const activeIdentity = databaseIdentity(activeUrl);
const expectedIdentity = target === "qa" ? qaIdentity : primaryIdentity;
if (activeIdentity !== expectedIdentity) {
  throw new Error("active_database_identity_mismatch");
}

process.env.DATABASE_URL = activeUrl;
const db = new PrismaClient();

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key.toLowerCase()}_required`);
  return value;
}

function expectedConfirmation(): string {
  return target === "qa"
    ? "--confirm=RESET_QA_TO_SINGLE_ADMIN"
    : "--confirm=RESET_PRODUCTION_TO_SINGLE_ADMIN";
}

function sqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function applicationTables(): Promise<string[]> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  if (rows.length === 0) {
    throw new Error("no_application_tables_found");
  }
  return rows.map(({ tablename }) => tablename);
}

async function tableCounts(tables: string[]): Promise<Record<string, number>> {
  const entries: [string, number][] = [];
  for (const table of tables) {
    const rows = await db.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "public".${sqlIdentifier(table)}`
    );
    entries.push([table, Number(rows[0]?.count ?? "0")]);
  }
  return Object.fromEntries(entries);
}

async function writePreResetEvidence(
  tables: string[],
  counts: Record<string, number>
): Promise<string> {
  const migrations = await db.$queryRaw<
    {
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }[]
  >`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at
  `;
  const createdAt = new Date();
  const evidenceDir = path.join(
    process.cwd(),
    ".local-storage",
    "database-reset-evidence"
  );
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `${createdAt.toISOString().replaceAll(":", "-")}-${target}.json`;
  const evidencePath = path.join(evidenceDir, filename);
  const body = {
    version: 1,
    createdAt: createdAt.toISOString(),
    target,
    databaseIdentity: activeIdentity,
    note: "Inventory only. This file is not a database backup.",
    applicationTableCount: tables.length,
    rowCounts: counts,
    migrations: migrations.map((migration) => ({
      name: migration.migration_name,
      finishedAt: migration.finished_at?.toISOString() ?? null,
      rolledBackAt: migration.rolled_back_at?.toISOString() ?? null,
    })),
  };
  writeFileSync(evidencePath, `${JSON.stringify(body, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return evidencePath;
}

async function preflight(): Promise<void> {
  const tables = await applicationTables();
  const counts = await tableCounts(tables);
  const totalRows = Object.values(counts).reduce(
    (total, count) => total + count,
    0
  );
  console.log(`Target: ${target}`);
  console.log(`Database identity: ${activeIdentity}`);
  console.log(`Application tables: ${tables.length}`);
  console.log(`Current application rows: ${totalRows}`);
  console.log("No data was modified.");
}

async function reset(): Promise<void> {
  if (confirmation !== expectedConfirmation()) {
    throw new Error(`${target}_reset_confirmation_required`);
  }

  const identifier = required("RESET_ADMIN_IDENTIFIER");
  const password = required("RESET_ADMIN_PASSWORD");
  if (identifier.length < 3 || identifier.length > 254) {
    throw new Error("reset_admin_identifier_invalid");
  }
  if (password.length < 8 || password.length > 200) {
    throw new Error("reset_admin_password_length_invalid");
  }

  const firstName = process.env.RESET_ADMIN_FIRST_NAME?.trim() || identifier;
  const lastName = process.env.RESET_ADMIN_LAST_NAME?.trim() ?? "";
  const passwordHash = await bcrypt.hash(password, 12);
  const tables = await applicationTables();
  const counts = await tableCounts(tables);
  const evidencePath = await writePreResetEvidence(tables, counts);
  const qualifiedTables = tables.map(
    (table) => `"public".${sqlIdentifier(table)}`
  );

  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `TRUNCATE TABLE ${qualifiedTables.join(", ")} RESTART IDENTITY CASCADE`
      );
      await tx.user.create({
        data: {
          role: "ADMIN",
          identifier,
          passwordHash,
          email: null,
          emailVerifiedAt: null,
          firstName,
          lastName,
          accountStatus: "ACTIVE",
          isActive: true,
          consentedAt: new Date(),
          consentVersion:
            process.env.IDENTITY_TERMS_VERSION?.trim() || "2026-07",
          admin: {
            create: {
              firstName,
              lastName,
            },
          },
        },
      });
    },
    { maxWait: 10_000, timeout: 60_000 }
  );

  console.log(
    `Reset complete: ${tables.length} application tables were cleared.`
  );
  console.log("Created exactly one active Admin with no linked email.");
  console.log(
    `Pre-reset inventory: ${path.relative(process.cwd(), evidencePath)}`
  );
  console.log("The password was not printed or written to the evidence file.");
}

async function verify(): Promise<void> {
  const identifier = required("RESET_ADMIN_IDENTIFIER");
  const password = required("RESET_ADMIN_PASSWORD");
  const tables = await applicationTables();
  const counts = await tableCounts(tables);
  const nonEmptyUnexpected = Object.entries(counts).filter(
    ([table, count]) =>
      count !== 0 &&
      !((table === "User" && count === 1) || (table === "Admin" && count === 1))
  );
  const [users, admins, account] = await Promise.all([
    db.user.count(),
    db.admin.count(),
    db.user.findUnique({
      where: { identifier },
      select: {
        role: true,
        passwordHash: true,
        email: true,
        emailVerifiedAt: true,
        accountStatus: true,
        isActive: true,
        deletedAt: true,
        authIdentities: { select: { id: true } },
        admin: { select: { userId: true } },
      },
    }),
  ]);
  const passwordMatches = account
    ? await bcrypt.compare(password, account.passwordHash)
    : false;

  if (
    users !== 1 ||
    admins !== 1 ||
    nonEmptyUnexpected.length > 0 ||
    !account ||
    account.role !== "ADMIN" ||
    account.email !== null ||
    account.emailVerifiedAt !== null ||
    account.accountStatus !== "ACTIVE" ||
    account.isActive !== true ||
    account.deletedAt !== null ||
    account.authIdentities.length !== 0 ||
    !account.admin ||
    !passwordMatches
  ) {
    throw new Error("single_admin_verification_failed");
  }

  console.log(`Verification passed for ${target}.`);
  console.log("Users: 1; Admins: 1; all other application rows: 0.");
  console.log("Email: null; linked auth identities: 0; account: active.");
  console.log("Configured password matches the stored bcrypt hash.");
}

async function main(): Promise<void> {
  if (mode === "preflight") await preflight();
  if (mode === "reset") await reset();
  if (mode === "verify") await verify();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
