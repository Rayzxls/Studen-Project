import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";

type CountRow = { count: bigint };
type ColumnRow = { table_name: string; column_name: string };
type PreserveRow = {
  account_status: string;
  email_verified: boolean;
  has_real_name: boolean;
  role: string;
};

async function count(
  db: { $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> },
  query: string,
  ...values: unknown[]
): Promise<bigint> {
  const [row] = await db.$queryRawUnsafe<CountRow[]>(query, ...values);
  return row?.count ?? BigInt(0);
}

async function main(): Promise<void> {
  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  process.env = isolatedEnv;
  assertIsolatedTestDatabase(process.env);

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    const columns = await db.$queryRawUnsafe<ColumnRow[]>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'User' AND column_name IN (
            'mustResetPwd', -- dependency-gate-allow(temporary-password): read-only QA preflight inventories the compatibility column before its approved drop
            'displayName', -- dependency-gate-allow(legacy-display-name): read-only QA preflight inventories the compatibility column before its approved drop
            'identifier',
            'email',
            'emailVerifiedAt',
            'firstName',
            'lastName'
          ))
          OR (table_name = 'Student' AND column_name = 'studentId') -- dependency-gate-allow(student-id-symbol-review): this is the retired human Student Number column, not an internal User foreign key; dependency-gate-allow(student-number-copy): read-only preflight inventories the field before its approved drop
        )
      ORDER BY table_name, column_name
    `);
    const existingColumns = new Set(
      columns.map((column) => `${column.table_name}.${column.column_name}`)
    );
    const hasColumn = (table: string, column: string) =>
      existingColumns.has(`${table}.${column}`);

    const [
      users,
      usersMissingCanonicalEmail,
      usersWithUnverifiedEmail,
      usersMissingRealName,
      identifiersDifferentFromEmail,
      mustResetPasswordUsers,
      usersWithLegacyDisplayName,
      students,
      syntheticStudentNumbers,
      humanLikeStudentNumbers,
    ] = await Promise.all([
      count(db, `SELECT COUNT(*)::bigint AS count FROM "User"`),
      count(
        db,
        `SELECT COUNT(*)::bigint AS count
         FROM "User"
         WHERE "email" IS NULL OR BTRIM("email") = ''`
      ),
      count(
        db,
        `SELECT COUNT(*)::bigint AS count
         FROM "User"
         WHERE "email" IS NOT NULL AND "emailVerifiedAt" IS NULL`
      ),
      count(
        db,
        `SELECT COUNT(*)::bigint AS count
         FROM "User"
         WHERE "firstName" IS NULL OR BTRIM("firstName") = ''
            OR "lastName" IS NULL OR BTRIM("lastName") = ''`
      ),
      count(
        db,
        `SELECT COUNT(*)::bigint AS count
         FROM "User"
         WHERE "email" IS NOT NULL
           AND LOWER(BTRIM("identifier")) <> LOWER(BTRIM("email"))`
      ),
      hasColumn("User", "mustResetPwd") // dependency-gate-allow(temporary-password): read-only QA preflight inventories the compatibility column before its approved drop
        ? count(
            db,
            `SELECT COUNT(*)::bigint AS count
             FROM "User"
             WHERE "mustResetPwd" = true` // dependency-gate-allow(temporary-password): aggregate-only compatibility readiness check
          )
        : BigInt(0),
      hasColumn("User", "displayName") // dependency-gate-allow(legacy-display-name): read-only QA preflight inventories the compatibility column before its approved drop
        ? count(
            db,
            `SELECT COUNT(*)::bigint AS count
             FROM "User"
             WHERE "displayName" IS NOT NULL -- dependency-gate-allow(legacy-display-name): aggregate-only compatibility readiness check
               AND BTRIM("displayName") <> ''` // dependency-gate-allow(legacy-display-name): aggregate-only compatibility readiness check
          )
        : BigInt(0),
      count(db, `SELECT COUNT(*)::bigint AS count FROM "Student"`),
      hasColumn("Student", "studentId") // dependency-gate-allow(student-id-symbol-review): this explicitly inspects the retired human Student Number column; dependency-gate-allow(student-number-copy): read-only preflight inventories the field before its approved drop
        ? count(
            db,
            `SELECT COUNT(*)::bigint AS count
             FROM "Student"
             WHERE "studentId" LIKE 'identity-v2-unassigned:%' -- dependency-gate-allow(student-id-symbol-review): classify only synthetic compatibility values
                OR "studentId" LIKE 'compat-%'` // dependency-gate-allow(student-id-symbol-review): classify only synthetic compatibility values
          )
        : BigInt(0),
      hasColumn("Student", "studentId") // dependency-gate-allow(student-id-symbol-review): this explicitly inspects the retired human Student Number column; dependency-gate-allow(student-number-copy): read-only preflight inventories the field before its approved drop
        ? count(
            db,
            `SELECT COUNT(*)::bigint AS count
             FROM "Student"
             WHERE "studentId" NOT LIKE 'identity-v2-unassigned:%' -- dependency-gate-allow(student-id-symbol-review): classify human-like compatibility values before deletion
               AND "studentId" NOT LIKE 'compat-%'` // dependency-gate-allow(student-id-symbol-review): classify human-like compatibility values before deletion
          )
        : BigInt(0),
    ]);

    const preserveEmail = process.env.IDENTITY_PRESERVE_EMAIL?.trim();
    let preserveAdmin:
      | { configured: false }
      | {
          configured: true;
          found: boolean;
          role?: string;
          accountStatus?: string;
          emailVerified?: boolean;
          hasRealName?: boolean;
        } = { configured: false };

    if (preserveEmail) {
      const rows = await db.$queryRawUnsafe<PreserveRow[]>(
        `SELECT
           "role"::text AS role,
           "accountStatus"::text AS account_status,
           ("emailVerifiedAt" IS NOT NULL) AS email_verified,
           (
             "firstName" IS NOT NULL AND BTRIM("firstName") <> ''
             AND "lastName" IS NOT NULL AND BTRIM("lastName") <> ''
           ) AS has_real_name
         FROM "User"
         WHERE LOWER("email") = LOWER($1)
         LIMIT 2`,
        preserveEmail
      );
      const row = rows.length === 1 ? rows[0] : undefined;
      preserveAdmin = {
        configured: true,
        found: Boolean(row),
        ...(row
          ? {
              role: row.role,
              accountStatus: row.account_status,
              emailVerified: row.email_verified,
              hasRealName: row.has_real_name,
            }
          : {}),
      };
    }

    const result = {
      mode: "READ_ONLY_ISOLATED_QA",
      schema: {
        userMustResetPwd: hasColumn("User", "mustResetPwd"), // dependency-gate-allow(temporary-password): schema-presence evidence only
        userDisplayName: hasColumn("User", "displayName"), // dependency-gate-allow(legacy-display-name): schema-presence evidence only
        studentStudentId: hasColumn("Student", "studentId"), // dependency-gate-allow(student-id-symbol-review): schema-presence evidence for the retired human value only
      },
      readiness: {
        users: users.toString(),
        usersMissingCanonicalEmail: usersMissingCanonicalEmail.toString(),
        usersWithUnverifiedEmail: usersWithUnverifiedEmail.toString(),
        usersMissingRealName: usersMissingRealName.toString(),
        identifiersDifferentFromEmail: identifiersDifferentFromEmail.toString(),
        mustResetPasswordUsers: mustResetPasswordUsers.toString(),
        usersWithLegacyDisplayName: usersWithLegacyDisplayName.toString(),
        students: students.toString(),
        syntheticStudentNumbers: syntheticStudentNumbers.toString(),
        humanLikeStudentNumbers: humanLikeStudentNumbers.toString(),
      },
      preserveAdmin,
      destructiveQaMigrationReady:
        mustResetPasswordUsers === BigInt(0) &&
        usersWithLegacyDisplayName === BigInt(0) &&
        humanLikeStudentNumbers === BigInt(0) &&
        usersMissingCanonicalEmail === BigInt(0) &&
        usersMissingRealName === BigInt(0),
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "identity_compatibility_preflight_failed"
  );
  process.exitCode = 1;
});
