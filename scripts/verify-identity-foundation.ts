import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";

type ScalarCount = { count: bigint };
type EnumValue = { value: string };

async function count(
  db: {
    $queryRawUnsafe<T>(query: string): Promise<T>;
  },
  query: string
): Promise<bigint> {
  const [row] = await db.$queryRawUnsafe<ScalarCount[]>(query);
  return row.count;
}

async function main(): Promise<void> {
  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  process.env = isolatedEnv;
  assertIsolatedTestDatabase(process.env);

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    const [
      userCount,
      migratedIdentityUserCount,
      nonDefaultSessionVersionCount,
      authIdentityCount,
      teacherInviteCount,
      consentAcceptanceCount,
      identityTokenCount,
      realNameHistoryCount,
      accountStatusValues,
    ] = await Promise.all([
      count(db, `SELECT COUNT(*)::bigint AS count FROM "User"`),
      count(
        db,
        `SELECT COUNT(*)::bigint AS count
         FROM "User"
         WHERE "email" IS NOT NULL
            OR "emailVerifiedAt" IS NOT NULL
            OR "firstName" IS NOT NULL
            OR "lastName" IS NOT NULL
            OR "deletionRequestedAt" IS NOT NULL
            OR "deletionScheduledFor" IS NOT NULL
            OR "anonymizedAt" IS NOT NULL`
      ),
      count(
        db,
        `SELECT COUNT(*)::bigint AS count
         FROM "User"
         WHERE "sessionVersion" <> 0`
      ),
      count(db, `SELECT COUNT(*)::bigint AS count FROM "AuthIdentity"`),
      count(db, `SELECT COUNT(*)::bigint AS count FROM "TeacherInvite"`),
      count(db, `SELECT COUNT(*)::bigint AS count FROM "ConsentAcceptance"`),
      count(db, `SELECT COUNT(*)::bigint AS count FROM "IdentityToken"`),
      count(db, `SELECT COUNT(*)::bigint AS count FROM "RealNameHistory"`),
      db.$queryRawUnsafe<EnumValue[]>(`
        SELECT value
        FROM (
          SELECT enumlabel AS value, enumsortorder
          FROM pg_enum
          JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
          WHERE pg_type.typname = 'AccountStatus'
        ) AS values
        ORDER BY enumsortorder
      `),
    ]);

    const result = {
      userCount: userCount.toString(),
      migratedIdentityUserCount: migratedIdentityUserCount.toString(),
      nonDefaultSessionVersionCount: nonDefaultSessionVersionCount.toString(),
      foundationRows: {
        authIdentity: authIdentityCount.toString(),
        teacherInvite: teacherInviteCount.toString(),
        consentAcceptance: consentAcceptanceCount.toString(),
        identityToken: identityTokenCount.toString(),
        realNameHistory: realNameHistoryCount.toString(),
      },
      accountStatusValues: accountStatusValues.map((row) => row.value),
    };

    console.log(JSON.stringify(result, null, 2));

    const foundationRowCount =
      authIdentityCount +
      teacherInviteCount +
      consentAcceptanceCount +
      identityTokenCount +
      realNameHistoryCount;
    const deletionPendingExists = accountStatusValues.some(
      (row) => row.value === "DELETION_PENDING"
    );

    if (
      migratedIdentityUserCount !== BigInt(0) ||
      nonDefaultSessionVersionCount !== BigInt(0) ||
      foundationRowCount !== BigInt(0) ||
      !deletionPendingExists
    ) {
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "verification_failed");
  process.exitCode = 1;
});
