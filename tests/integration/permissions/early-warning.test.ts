// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { getTeacherEarlyWarnings } from "@/lib/early-warning/teacher";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

describe("Teacher early-warning ownership", () => {
  let ctx: TestCourseContext;
  let now: Date;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    const enrolled = await db.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
      select: { enrolledAt: true },
    });
    now = new Date(enrolled.enrolledAt.getTime() + 60 * 60 * 1000);
    const dueAt = new Date(enrolled.enrolledAt.getTime() + 30 * 60 * 1000);

    await db.assignment.createMany({
      data: [
        {
          courseOfferingId: ctx.courseOfferingId,
          title: "Missing one",
          description: "QA early-warning fixture",
          dueAt,
          createdById: ctx.teacherUserId,
        },
        {
          courseOfferingId: ctx.courseOfferingId,
          title: "Missing two",
          description: "QA early-warning fixture",
          dueAt,
          createdById: ctx.teacherUserId,
        },
        {
          courseOfferingId: ctx.courseOfferingId,
          title: "Still scheduled",
          description: "Must not count before publication",
          dueAt,
          publishAt: new Date(now.getTime() + 60 * 60 * 1000),
          createdById: ctx.teacherUserId,
        },
      ],
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("shows live missing work to the owner and nothing to another teacher", async () => {
    const owner = await getTeacherEarlyWarnings(ctx.teacherUserId, now);
    expect(owner).toMatchObject({
      total: 1,
      urgentCount: 0,
      watchCount: 1,
      rows: [
        {
          studentUserId: ctx.studentUserId,
          courseId: ctx.courseOfferingId,
          severity: "WATCH",
          signals: [{ kind: "MISSING_WORK", count: 2 }],
        },
      ],
    });

    await expect(
      getTeacherEarlyWarnings(ctx.otherTeacherUserId, now)
    ).resolves.toEqual({
      total: 0,
      urgentCount: 0,
      watchCount: 0,
      rows: [],
    });
  });
});
