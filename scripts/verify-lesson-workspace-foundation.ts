import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";

type ScalarCount = { count: bigint };

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
    const lessonCount = await count(
      db,
      `SELECT COUNT(*)::bigint AS count FROM "Lesson"`
    );
    const linkedAssignmentCount = await count(
      db,
      `SELECT COUNT(*)::bigint AS count FROM "Assignment" WHERE "lessonId" IS NOT NULL`
    );
    const linkedMaterialCount = await count(
      db,
      `SELECT COUNT(*)::bigint AS count FROM "Material" WHERE "lessonId" IS NOT NULL`
    );
    const crossCourseAssignmentCount = await count(
      db,
      `SELECT COUNT(*)::bigint AS count
       FROM "Assignment" AS content
       JOIN "Lesson" AS lesson ON lesson."id" = content."lessonId"
       WHERE content."courseOfferingId" <> lesson."courseOfferingId"`
    );
    const crossCourseMaterialCount = await count(
      db,
      `SELECT COUNT(*)::bigint AS count
       FROM "Material" AS content
       JOIN "Lesson" AS lesson ON lesson."id" = content."lessonId"
       WHERE content."courseOfferingId" <> lesson."courseOfferingId"`
    );

    console.log(
      JSON.stringify(
        {
          lessonCount: lessonCount.toString(),
          linkedAssignmentCount: linkedAssignmentCount.toString(),
          linkedMaterialCount: linkedMaterialCount.toString(),
          crossCourseAssignmentCount: crossCourseAssignmentCount.toString(),
          crossCourseMaterialCount: crossCourseMaterialCount.toString(),
        },
        null,
        2
      )
    );

    if (
      crossCourseAssignmentCount !== BigInt(0) ||
      crossCourseMaterialCount !== BigInt(0)
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
