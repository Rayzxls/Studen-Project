import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createCourseOffering } from "@/lib/course/create-course";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

describe("teacher-owned CourseOffering creation", () => {
  let ctx: TestCourseContext;
  const createdCourseIds: string[] = [];

  beforeEach(async () => {
    ctx = await setupTestCourse();
  });

  afterEach(async () => {
    if (!ctx) return;

    if (createdCourseIds.length > 0) {
      await db.auditLog.deleteMany({
        where: { targetId: { in: createdCourseIds } },
      });
      await db.courseOffering.deleteMany({
        where: { id: { in: createdCourseIds } },
      });
      createdCourseIds.length = 0;
    }

    await ctx.cleanup();
  });

  it("creates standalone courses without hidden Class or Term dependencies", async () => {
    const nameOnly = await createCourseOffering({
      teacherUserId: ctx.teacherUserId,
      name: `Independent Course ${ctx.prefix}`,
    });
    createdCourseIds.push(nameOnly.id);

    const withMetadata = await createCourseOffering({
      teacherUserId: ctx.teacherUserId,
      name: `Teacher Metadata ${ctx.prefix}`,
      subjectCode: "ENG-201",
      learnerGroupLabel: "Conversation Group A",
      academicPeriodLabel: "Summer 2026",
      creditHours: 1.5,
    });
    createdCourseIds.push(withMetadata.id);

    const courses = await db.courseOffering.findMany({
      where: { id: { in: createdCourseIds } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        classId: true, // dependency-gate-allow(class-model): regression assertion proves standalone courses have no legacy Class relation
        termId: true, // dependency-gate-allow(term-model): regression assertion proves standalone courses have no legacy Term relation
        gradeLevel: true, // dependency-gate-allow(grade-level): regression assertion proves grade level is not silently inferred
        learnerGroupLabel: true,
        academicPeriodLabel: true,
        creditHours: true,
      },
    });

    expect(courses).toHaveLength(2);
    expect(courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: nameOnly.id,
          classId: null, // dependency-gate-allow(class-model): expected absence of the legacy Class relation
          termId: null, // dependency-gate-allow(term-model): expected absence of the legacy Term relation
          gradeLevel: null, // dependency-gate-allow(grade-level): expected absence of inferred grade level
          learnerGroupLabel: null,
          academicPeriodLabel: null,
          creditHours: null,
        }),
        expect.objectContaining({
          id: withMetadata.id,
          classId: null, // dependency-gate-allow(class-model): optional labels do not recreate the legacy Class relation
          termId: null, // dependency-gate-allow(term-model): optional labels do not recreate the legacy Term relation
          gradeLevel: null, // dependency-gate-allow(grade-level): optional labels do not infer grade level
          learnerGroupLabel: "Conversation Group A",
          academicPeriodLabel: "Summer 2026",
          creditHours: 1.5,
        }),
      ])
    );

    const audits = await db.auditLog.findMany({
      where: {
        targetId: { in: createdCourseIds },
        action: "COURSE_OFFERING_CREATED",
      },
      select: { targetId: true },
    });
    expect(audits).toHaveLength(2);
  });
});
