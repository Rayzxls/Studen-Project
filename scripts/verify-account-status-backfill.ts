import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";

type StatusCount = { status: string; count: bigint };
type ScalarCount = { count: bigint };

async function main(): Promise<void> {
  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  process.env = isolatedEnv;
  assertIsolatedTestDatabase(process.env);

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    const statusCounts = await db.$queryRawUnsafe<StatusCount[]>(`
      SELECT "accountStatus"::text AS status, COUNT(*)::bigint AS count
      FROM "User"
      GROUP BY "accountStatus"
      ORDER BY "accountStatus"
    `);

    const [mismatch] = await db.$queryRawUnsafe<ScalarCount[]>(`
      SELECT COUNT(*)::bigint AS count
      FROM "User" AS target
      WHERE target."accountStatus" <> CASE
        WHEN EXISTS (
          SELECT 1
          FROM "Student" AS student
          WHERE student."userId" = target."id"
            AND student."anonymized" = TRUE
        ) THEN 'ANONYMIZED'::"AccountStatus"
        WHEN target."deletedAt" IS NOT NULL
          THEN 'TERMINATED'::"AccountStatus"
        WHEN target."isActive" = FALSE
          THEN 'SUSPENDED'::"AccountStatus"
        ELSE 'ACTIVE'::"AccountStatus"
      END
    `);

    const [history] = await db.$queryRawUnsafe<ScalarCount[]>(`
      SELECT COUNT(*)::bigint AS count
      FROM "AccountLifecycleEvent"
    `);

    const result = {
      statusCounts: statusCounts.map((row) => ({
        status: row.status,
        count: row.count.toString(),
      })),
      legacyMismatchCount: mismatch.count.toString(),
      lifecycleHistoryCount: history.count.toString(),
    };

    console.log(JSON.stringify(result, null, 2));
    if (mismatch.count !== BigInt(0)) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "verification_failed");
  process.exitCode = 1;
});
