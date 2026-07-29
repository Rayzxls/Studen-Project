import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";

type CountRow = { count: bigint };
type SchemaRow = { table_name: string; column_name: string };

async function count(
  db: { $queryRawUnsafe<T>(query: string): Promise<T> },
  query: string
): Promise<bigint> {
  const [row] = await db.$queryRawUnsafe<CountRow[]>(query);
  return row?.count ?? BigInt(0);
}

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
        AND (
          table_name IN (
            'AcademicYear', -- dependency-gate-allow(academic-year-model): read-only D0 preflight inventories the compatibility table
            'Term', -- dependency-gate-allow(term-model): read-only D0 preflight inventories the compatibility table
            'Class' -- dependency-gate-allow(class-model): read-only D0 preflight inventories the compatibility table
          )
          OR (
            table_name = 'Teacher'
            AND column_name = 'homeroomOfId' -- dependency-gate-allow(homeroom): read-only D0 preflight inventories the compatibility column
          )
          OR (
            table_name = 'Student'
            AND column_name = 'classId' -- dependency-gate-allow(class-model): read-only D0 preflight inventories the compatibility column
          )
          OR (
            table_name = 'CourseOffering'
            AND column_name IN (
              'classId', -- dependency-gate-allow(class-model): read-only D0 preflight inventories the compatibility column
              'termId', -- dependency-gate-allow(term-model): read-only D0 preflight inventories the compatibility column
              'gradeLevel', -- dependency-gate-allow(grade-level): read-only D0 preflight inventories the compatibility column
              'learnerGroupLabel',
              'academicPeriodLabel'
            )
          )
        )
      ORDER BY table_name, column_name
    `);
    const schema = new Set(
      schemaRows.map((row) => `${row.table_name}.${row.column_name}`)
    );
    const hasTable = (table: string) =>
      schemaRows.some((row) => row.table_name === table);
    const hasColumn = (table: string, column: string) =>
      schema.has(`${table}.${column}`);

    const academicYears = hasTable("AcademicYear") // dependency-gate-allow(academic-year-model): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "AcademicYear"` // dependency-gate-allow(academic-year-model): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const terms = hasTable("Term") // dependency-gate-allow(term-model): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "Term"` // dependency-gate-allow(term-model): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const classes = hasTable("Class") // dependency-gate-allow(class-model): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "Class"` // dependency-gate-allow(class-model): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const teacherHomeroomLinks = hasColumn("Teacher", "homeroomOfId") // dependency-gate-allow(homeroom): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "Teacher" WHERE "homeroomOfId" IS NOT NULL` // dependency-gate-allow(homeroom): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const studentClassLinks = hasColumn("Student", "classId") // dependency-gate-allow(class-model): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "Student" WHERE "classId" IS NOT NULL` // dependency-gate-allow(class-model): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const courseClassLinks = hasColumn("CourseOffering", "classId") // dependency-gate-allow(class-model): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "CourseOffering" WHERE "classId" IS NOT NULL` // dependency-gate-allow(class-model): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const courseTermLinks = hasColumn("CourseOffering", "termId") // dependency-gate-allow(term-model): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "CourseOffering" WHERE "termId" IS NOT NULL` // dependency-gate-allow(term-model): aggregate-only compatibility readiness check
        )
      : BigInt(0);
    const courseGradeValues = hasColumn("CourseOffering", "gradeLevel") // dependency-gate-allow(grade-level): aggregate-only compatibility readiness check
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count FROM "CourseOffering" WHERE "gradeLevel" IS NOT NULL AND BTRIM("gradeLevel") <> ''` // dependency-gate-allow(grade-level): aggregate-only compatibility readiness check
        )
      : BigInt(0);

    const canCompareClassMetadata =
      hasTable("Class") && // dependency-gate-allow(class-model): preflight comparison requires the compatibility table
      hasColumn("CourseOffering", "classId") && // dependency-gate-allow(class-model): preflight comparison requires the compatibility relation
      hasColumn("CourseOffering", "learnerGroupLabel");
    const canCompareTermMetadata =
      hasTable("Term") && // dependency-gate-allow(term-model): preflight comparison requires the compatibility table
      hasColumn("CourseOffering", "termId") && // dependency-gate-allow(term-model): preflight comparison requires the compatibility relation
      hasColumn("CourseOffering", "academicPeriodLabel");

    const missingLearnerGroupLabels = canCompareClassMetadata
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count
           FROM "CourseOffering"
           WHERE "classId" IS NOT NULL -- dependency-gate-allow(class-model): aggregate-only metadata coverage check
             AND ("learnerGroupLabel" IS NULL OR BTRIM("learnerGroupLabel") = '')`
        )
      : BigInt(0);
    const mismatchedLearnerGroupLabels = canCompareClassMetadata
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count
           FROM "CourseOffering" course
           JOIN "Class" legacy_class ON legacy_class."id" = course."classId" -- dependency-gate-allow(class-model): aggregate-only backfill comparison
           WHERE course."learnerGroupLabel" IS NOT NULL
             AND BTRIM(course."learnerGroupLabel") <> BTRIM(legacy_class."name")`
        )
      : BigInt(0);
    const missingAcademicPeriodLabels = canCompareTermMetadata
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count
           FROM "CourseOffering"
           WHERE "termId" IS NOT NULL -- dependency-gate-allow(term-model): aggregate-only metadata coverage check
             AND ("academicPeriodLabel" IS NULL OR BTRIM("academicPeriodLabel") = '')`
        )
      : BigInt(0);
    const mismatchedAcademicPeriodLabels = canCompareTermMetadata
      ? await count(
          db,
          `SELECT COUNT(*)::bigint AS count
           FROM "CourseOffering" course
           JOIN "Term" legacy_term ON legacy_term."id" = course."termId" -- dependency-gate-allow(term-model): aggregate-only backfill comparison
           WHERE course."academicPeriodLabel" IS NOT NULL
             AND BTRIM(course."academicPeriodLabel") <> BTRIM(legacy_term."name")`
        )
      : BigInt(0);

    console.log(
      JSON.stringify(
        {
          mode: "READ_ONLY_ISOLATED_QA",
          schema: {
            academicYearTable: hasTable("AcademicYear"), // dependency-gate-allow(academic-year-model): schema-presence evidence only
            termTable: hasTable("Term"), // dependency-gate-allow(term-model): schema-presence evidence only
            classTable: hasTable("Class"), // dependency-gate-allow(class-model): schema-presence evidence only
            teacherHomeroomColumn: hasColumn("Teacher", "homeroomOfId"), // dependency-gate-allow(homeroom): schema-presence evidence only
            studentClassColumn: hasColumn("Student", "classId"), // dependency-gate-allow(class-model): schema-presence evidence only
            courseClassColumn: hasColumn("CourseOffering", "classId"), // dependency-gate-allow(class-model): schema-presence evidence only
            courseTermColumn: hasColumn("CourseOffering", "termId"), // dependency-gate-allow(term-model): schema-presence evidence only
            courseGradeLevelColumn: hasColumn("CourseOffering", "gradeLevel"), // dependency-gate-allow(grade-level): schema-presence evidence only
          },
          retainedRows: {
            academicYears: academicYears.toString(),
            terms: terms.toString(),
            classes: classes.toString(),
          },
          retiredAssociations: {
            teacherHomeroomLinks: teacherHomeroomLinks.toString(),
            studentClassLinks: studentClassLinks.toString(),
            courseClassLinks: courseClassLinks.toString(),
            courseTermLinks: courseTermLinks.toString(),
            courseGradeValues: courseGradeValues.toString(),
          },
          metadataCoverage: {
            missingLearnerGroupLabels: missingLearnerGroupLabels.toString(),
            mismatchedLearnerGroupLabels:
              mismatchedLearnerGroupLabels.toString(),
            missingAcademicPeriodLabels: missingAcademicPeriodLabels.toString(),
            mismatchedAcademicPeriodLabels:
              mismatchedAcademicPeriodLabels.toString(),
          },
          destructiveQaMigrationReady:
            missingLearnerGroupLabels === BigInt(0) &&
            mismatchedLearnerGroupLabels === BigInt(0) &&
            missingAcademicPeriodLabels === BigInt(0) &&
            mismatchedAcademicPeriodLabels === BigInt(0),
        },
        null,
        2
      )
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "academic_compatibility_preflight_failed"
  );
  process.exitCode = 1;
});
