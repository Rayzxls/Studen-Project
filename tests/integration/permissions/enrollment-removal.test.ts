// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { removeMember } from "@/lib/course/enrollment";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Permission tests for lib/course/enrollment.removeMember.
 *
 * Verifies the ADR-0013 + CLAUDE.md § 3 invariants:
 *   - Only the owning teacher can soft-delete an enrollment
 *   - Reason validation (5–500 chars after trim)
 *   - Idempotency: removing twice rejects the second call
 *   - Audit event `COURSE_MEMBER_REMOVED` carries the reason
 *   - The mutation is transactional with the audit write
 */
describe("removeMember (ADR-0013)", () => {
  let ctx: TestCourseContext;
  let enrollmentId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    enrollmentId = e.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("owning teacher can remove a member with a valid reason", async () => {
    await removeMember({
      enrollmentId,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ย้ายไปห้องอื่น",
    });

    const e = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { removedAt: true, removedById: true, removedReason: true },
    });
    expect(e?.removedAt).not.toBeNull();
    expect(e?.removedById).toBe(ctx.teacherUserId);
    expect(e?.removedReason).toBe("ย้ายไปห้องอื่น");
  });

  it("writes a COURSE_MEMBER_REMOVED audit row with the reason", async () => {
    await removeMember({
      enrollmentId,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ทดสอบเหตุผล",
    });

    const log = await db.auditLog.findFirst({
      where: {
        action: "COURSE_MEMBER_REMOVED",
        targetId: enrollmentId,
      },
      select: { actorId: true, reason: true, actorRole: true },
    });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(ctx.teacherUserId);
    expect(log?.actorRole).toBe("TEACHER");
    expect(log?.reason).toBe("ทดสอบเหตุผล");
  });

  it("rejects a different teacher (not the course owner)", async () => {
    await expect(
      removeMember({
        enrollmentId,
        actorUserId: ctx.otherTeacherUserId,
        actorRole: "TEACHER",
        reason: "ไม่ใช่เจ้าของห้อง",
      })
    ).rejects.toBeInstanceOf(Forbidden);

    // Row untouched
    const e = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { removedAt: true },
    });
    expect(e?.removedAt).toBeNull();
  });

  it("rejects ADMIN actor (Phase 3 limits to TEACHER)", async () => {
    await expect(
      removeMember({
        enrollmentId,
        actorUserId: ctx.teacherUserId,
        actorRole: "ADMIN",
        reason: "admin moderation",
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects a missing enrollment with NotFound", async () => {
    await expect(
      removeMember({
        enrollmentId: "non_existent_cuid",
        actorUserId: ctx.teacherUserId,
        actorRole: "TEACHER",
        reason: "missing target",
      })
    ).rejects.toBeInstanceOf(NotFound);
  });

  it("rejects a reason shorter than 5 chars (after trim)", async () => {
    await expect(
      removeMember({
        enrollmentId,
        actorUserId: ctx.teacherUserId,
        actorRole: "TEACHER",
        reason: "  ย  ",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects double-remove as Conflict (idempotency boundary)", async () => {
    await removeMember({
      enrollmentId,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ครั้งแรก",
    });
    await expect(
      removeMember({
        enrollmentId,
        actorUserId: ctx.teacherUserId,
        actorRole: "TEACHER",
        reason: "ครั้งที่สอง",
      })
    ).rejects.toBeInstanceOf(Conflict);
  });
});
