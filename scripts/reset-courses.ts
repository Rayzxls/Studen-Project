/**
 * One-off: clear CourseOffering + Enrollment data
 * Used during the Phase 2 Subject → Workspace migration (ADR-0012)
 * so that `prisma db push` can drop the Subject table cleanly.
 * Users + audit log + classes + terms are preserved.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const enrollments = await db.enrollment.deleteMany({});
  const courses = await db.courseOffering.deleteMany({});
  console.log(
    `Deleted ${enrollments.count} enrollments + ${courses.count} courseOfferings`
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
