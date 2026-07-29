import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";

type NameRow = { name: string };
type SchemaRow = { table_name: string; column_name: string };

const RETIRED_TABLES = [
  "AcademicYear", // dependency-gate-allow(academic-year-model): D0 verifier asserts that this retired table is absent
  "Term", // dependency-gate-allow(term-model): D0 verifier asserts that this retired table is absent
  "Class", // dependency-gate-allow(class-model): D0 verifier asserts that this retired table is absent
] as const;
const RETIRED_COLUMNS = [
  ["Teacher", "homeroomOfId"],
  ["Student", "classId"], // dependency-gate-allow(class-model): D0 verifier asserts that this retired column is absent
  ["CourseOffering", "classId"], // dependency-gate-allow(class-model): D0 verifier asserts that this retired column is absent
  ["CourseOffering", "termId"], // dependency-gate-allow(term-model): D0 verifier asserts that this retired column is absent
  ["CourseOffering", "gradeLevel"], // dependency-gate-allow(grade-level): D0 verifier asserts that this retired column is absent
] as const;
const REQUIRED_COLUMNS = [
  ["CourseOffering", "learnerGroupLabel"],
  ["CourseOffering", "academicPeriodLabel"],
  ["CourseOffering", "creditHours"],
] as const;
const RETIRED_DATABASE_OBJECTS = [
  "Teacher_homeroomOfId_key",
  "Teacher_homeroomOfId_fkey",
  "Student_classId_fkey",
  "CourseOffering_classId_fkey",
  "CourseOffering_termId_fkey",
  "CourseOffering_classId_termId_idx",
] as const;

async function main(): Promise<void> {
  Object.assign(process.env, prepareIsolatedDatabaseEnv(process.env));
  assertIsolatedTestDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    const schemaRows = await db.$queryRawUnsafe<SchemaRow[]>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const schema = new Set(
      schemaRows.map((row) => `${row.table_name}.${row.column_name}`)
    );
    const tables = new Set(schemaRows.map((row) => row.table_name));

    const databaseObjects = await db.$queryRawUnsafe<NameRow[]>(`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = 'public'
      UNION
      SELECT constraint_name AS name
      FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
    `);
    const objectNames = new Set(databaseObjects.map((row) => row.name));

    const presentRetiredTables = RETIRED_TABLES.filter((table) =>
      tables.has(table)
    );
    const presentRetiredColumns = RETIRED_COLUMNS.filter(([table, column]) =>
      schema.has(`${table}.${column}`)
    ).map(([table, column]) => `${table}.${column}`);
    const missingRequiredColumns = REQUIRED_COLUMNS.filter(
      ([table, column]) => !schema.has(`${table}.${column}`)
    ).map(([table, column]) => `${table}.${column}`);
    const presentRetiredObjects = RETIRED_DATABASE_OBJECTS.filter((name) =>
      objectNames.has(name)
    );

    const result = {
      mode: "VERIFY_ISOLATED_QA_D0",
      presentRetiredTables,
      presentRetiredColumns,
      presentRetiredObjects,
      missingRequiredColumns,
      verified:
        presentRetiredTables.length === 0 &&
        presentRetiredColumns.length === 0 &&
        presentRetiredObjects.length === 0 &&
        missingRequiredColumns.length === 0,
    };

    console.log(JSON.stringify(result, null, 2));

    if (!result.verified) {
      throw new Error("academic_compatibility_removal_verification_failed");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "academic_compatibility_removal_verification_failed"
  );
  process.exitCode = 1;
});
