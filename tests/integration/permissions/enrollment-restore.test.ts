// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { enrollByClassCode, removeMember } from "@/lib/course/enrollment";
import { Conflict, Forbidden } from "@/lib/errors";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

/**
 * Permission tests for the ADR-0013 auto-restore-by-rejoin flow.
 *
 * The flow lives inside `enrollByClassCode`: when the student already has
 * a soft-deleted Enrollment row and presents the same class code, the row
 * is restored (removedAt/removedById/removedReason cleared) and a
 * `COURSE_MEMBER_RESTORED_BY_REJOIN` audit event is written instead of a
 * fresh `COURSE_MEMBER_JOINED`.
 *
 * Also verifies the kill switch (deactivating the code blocks both new
 * joins and rejoin-restores — ADR-0013 § 2).
 */
describe("enrollByClassCode — restore-by-rejoin (ADR-0013)", () => {
  let ctx: TestCourseContext;

  beforeEach(async () => {
    ctx = await setupTestCourse();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("first-time join creates a row + emits COURSE_MEMBER_JOINED", async () => {
    const result = await enrollByClassCode({
      studentUserId: ctx.studentUserId,
      rawCode: ctx.classCode,
    });

    expect(result.restored).toBe(false);
    expect(result.courseOfferingId).toBe(ctx.courseOfferingId);

    const log = await db.auditLog.findFirst({
      where: {
        actorId: ctx.studentUserId,
        action: "COURSE_MEMBER_JOINED",
      },
      select: { id: true },
    });
    expect(log).not.toBeNull();
  });

  it("rejoin of a removed enrollment restores it + emits RESTORED_BY_REJOIN", async () => {
    // 1. First join
    await enrollByClassCode({
      studentUserId: ctx.studentUserId,
      rawCode: ctx.classCode,
    });

    // 2. Teacher removes
    const enrollment = await db.enrollment.findFirstOrThrow({
      where: {
        studentId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { id: true },
    });
    await removeMember({
      enrollmentId: enrollment.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ทดสอบ remove",
    });

    // 3. Student rejoins with the same code → restore
    const rejoin = await enrollByClassCode({
      studentUserId: ctx.studentUserId,
      rawCode: ctx.classCode,
    });
    expect(rejoin.restored).toBe(true);

    // Row is the SAME id (no second insert)
    const fresh = await db.enrollment.findFirstOrThrow({
      where: {
        studentId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
      },
      select: {
        id: true,
        removedAt: true,
        removedById: true,
        removedReason: true,
      },
    });
    expect(fresh.id).toBe(enrollment.id);
    expect(fresh.removedAt).toBeNull();
    expect(fresh.removedById).toBeNull();
    expect(fresh.removedReason).toBeNull();

    // Audit trail has both REMOVED and RESTORED_BY_REJOIN
    const removed = await db.auditLog.findFirst({
      where: {
        action: "COURSE_MEMBER_REMOVED",
        targetId: enrollment.id,
      },
      select: { id: true },
    });
    const restored = await db.auditLog.findFirst({
      where: {
        action: "COURSE_MEMBER_RESTORED_BY_REJOIN",
        targetId: enrollment.id,
        actorId: ctx.studentUserId,
      },
      select: { id: true },
    });
    expect(removed).not.toBeNull();
    expect(restored).not.toBeNull();
  });

  it("rejoin of an ACTIVE enrollment throws Conflict (not silent restore)", async () => {
    await enrollByClassCode({
      studentUserId: ctx.studentUserId,
      rawCode: ctx.classCode,
    });

    await expect(
      enrollByClassCode({
        studentUserId: ctx.studentUserId,
        rawCode: ctx.classCode,
      })
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("deactivating the code blocks rejoin-restore (ADR-0013 § 2 kill switch)", async () => {
    // Setup: join + remove + deactivate code
    await enrollByClassCode({
      studentUserId: ctx.studentUserId,
      rawCode: ctx.classCode,
    });
    const enrollment = await db.enrollment.findFirstOrThrow({
      where: {
        studentId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { id: true },
    });
    await removeMember({
      enrollmentId: enrollment.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ก่อน deactivate",
    });
    await db.courseOffering.update({
      where: { id: ctx.courseOfferingId },
      data: { codeActive: false },
    });

    // The student can't rejoin
    await expect(
      enrollByClassCode({
        studentUserId: ctx.studentUserId,
        rawCode: ctx.classCode,
      })
    ).rejects.toBeInstanceOf(Forbidden);

    // Row still soft-deleted, no restore audit
    const fresh = await db.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { removedAt: true },
    });
    expect(fresh?.removedAt).not.toBeNull();
  });
});
