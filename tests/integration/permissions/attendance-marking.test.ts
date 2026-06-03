// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { bulkMarkAttendance } from "@/lib/attendance/mark";
import { cancelSession, findOrCreateSession } from "@/lib/attendance/session";
import { Conflict, Forbidden, ValidationError } from "@/lib/errors";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Integration tests for lib/attendance/mark.bulkMarkAttendance.
 *
 * Verifies ADR-0016 invariants:
 *   - Sparse semantics — no row = "ยังไม่เช็ค"
 *   - Removed enrollments cannot start a new record (cannot_mark_removed)
 *     but pre-existing records on them remain editable
 *   - Back-edit window (24h from scheduledStart) requires reason ≥ 5
 *   - Audit `ATTENDANCE_BACK_EDIT` fires only for status changes or new
 *     rows after the threshold (idempotent re-submit is silent)
 *   - editCount increments only on real status change
 *   - Cross-teacher rejection inside the $transaction (Pattern 2)
 *   - Cancelled Session rejects new marks (Conflict)
 */
describe("bulkMarkAttendance (ADR-0016)", () => {
  let ctx: TestCourseContext;
  let aliceEnrollmentId: string;
  let bobEnrollmentId: string;
  // Fresh Session (scheduledStart < 24h ago — no back-edit needed).
  let sessionId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const a = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const b = await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);
    aliceEnrollmentId = a.id;
    bobEnrollmentId = b.id;

    const s = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
      scheduledEnd: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      actorUserId: ctx.teacherUserId,
    });
    sessionId = s.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("owning teacher can mark active members", async () => {
    const result = await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [
        { enrollmentId: aliceEnrollmentId, status: "PRESENT" },
        { enrollmentId: bobEnrollmentId, status: "LATE" },
      ],
    });
    expect(result.marked).toBe(2);
    expect(result.audited).toBe(false); // < 24h threshold

    const rows = await db.attendanceRecord.findMany({
      where: { sessionId },
      select: { enrollmentId: true, status: true, editCount: true },
    });
    expect(rows.length).toBe(2);
    const alice = rows.find((r) => r.enrollmentId === aliceEnrollmentId);
    expect(alice?.status).toBe("PRESENT");
    expect(alice?.editCount).toBe(0);
  });

  it("idempotent — same status resubmit does not increment editCount", async () => {
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
    });
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
    });
    const row = await db.attendanceRecord.findUnique({
      where: {
        sessionId_enrollmentId: {
          sessionId,
          enrollmentId: aliceEnrollmentId,
        },
      },
      select: { editCount: true, status: true },
    });
    expect(row?.editCount).toBe(0);
    expect(row?.status).toBe("PRESENT");
  });

  it("increments editCount on real status change", async () => {
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
    });
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "LATE" }],
    });
    const row = await db.attendanceRecord.findUnique({
      where: {
        sessionId_enrollmentId: {
          sessionId,
          enrollmentId: aliceEnrollmentId,
        },
      },
      select: { editCount: true, status: true },
    });
    expect(row?.editCount).toBe(1);
    expect(row?.status).toBe("LATE");
  });

  it("rejects a non-owning teacher (Forbidden)", async () => {
    await expect(
      bulkMarkAttendance({
        sessionId,
        actorUserId: ctx.otherTeacherUserId,
        items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects empty items with ValidationError", async () => {
    await expect(
      bulkMarkAttendance({
        sessionId,
        actorUserId: ctx.teacherUserId,
        items: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects enrollmentId from a different course (ValidationError)", async () => {
    // Create another course owned by the same teacher with its own enrollment.
    const other = await db.courseOffering.create({
      data: {
        teacherId: ctx.teacherUserId,
        classId: ctx.classId,
        termId: ctx.termId,
        name: "Other Course",
        gradeLevel: "ม.4",
        creditHours: 1,
        classCode: `TST-OTHER-${Date.now().toString(36)}`,
      },
      select: { id: true },
    });
    const otherEnrollment = await db.enrollment.create({
      data: {
        studentId: ctx.studentUserId,
        courseOfferingId: other.id,
      },
      select: { id: true },
    });
    try {
      await expect(
        bulkMarkAttendance({
          sessionId,
          actorUserId: ctx.teacherUserId,
          items: [{ enrollmentId: otherEnrollment.id, status: "PRESENT" }],
        })
      ).rejects.toBeInstanceOf(ValidationError);
    } finally {
      await db.enrollment.delete({ where: { id: otherEnrollment.id } });
      await db.courseOffering.delete({ where: { id: other.id } });
    }
  });

  it("rejects new mark on a soft-removed enrollment (ADR-0016 § 3)", async () => {
    // Soft-delete Bob.
    await db.enrollment.update({
      where: { id: bobEnrollmentId },
      data: {
        removedAt: new Date(),
        removedById: ctx.teacherUserId,
        removedReason: "test_remove",
      },
    });
    // Bob has no AttendanceRecord for this session yet → fresh mark rejected.
    await expect(
      bulkMarkAttendance({
        sessionId,
        actorUserId: ctx.teacherUserId,
        items: [{ enrollmentId: bobEnrollmentId, status: "ABSENT" }],
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("allows editing an existing record on a soft-removed enrollment", async () => {
    // Mark Bob first (while active).
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: bobEnrollmentId, status: "PRESENT" }],
    });
    // Now soft-delete Bob.
    await db.enrollment.update({
      where: { id: bobEnrollmentId },
      data: {
        removedAt: new Date(),
        removedById: ctx.teacherUserId,
        removedReason: "test_remove",
      },
    });
    // Editing Bob's existing record should still work (grid-membership rule).
    const result = await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: bobEnrollmentId, status: "LATE" }],
    });
    expect(result.marked).toBe(1);
    const row = await db.attendanceRecord.findUnique({
      where: {
        sessionId_enrollmentId: {
          sessionId,
          enrollmentId: bobEnrollmentId,
        },
      },
      select: { status: true },
    });
    expect(row?.status).toBe("LATE");
  });

  it("rejects new marks on a cancelled Session (Conflict)", async () => {
    await cancelSession({
      sessionId,
      actorUserId: ctx.teacherUserId,
      reason: "ครูประชุมด่วน",
    });
    await expect(
      bulkMarkAttendance({
        sessionId,
        actorUserId: ctx.teacherUserId,
        items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
      })
    ).rejects.toBeInstanceOf(Conflict);
  });
});

describe("bulkMarkAttendance — back-edit threshold (ADR-0016 Q8)", () => {
  let ctx: TestCourseContext;
  let aliceEnrollmentId: string;
  let sessionId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const a = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    aliceEnrollmentId = a.id;
    // Session scheduledStart = 48h ago → past the 24h threshold
    const s = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: new Date(Date.now() - 48 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() - 47 * 60 * 60 * 1000),
      actorUserId: ctx.teacherUserId,
    });
    sessionId = s.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("requires reason ≥ 5 when marking a new row past the 24h threshold", async () => {
    await expect(
      bulkMarkAttendance({
        sessionId,
        actorUserId: ctx.teacherUserId,
        items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
        // No reason
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a new row past the threshold with reason ≥ 5 + emits audit", async () => {
    const result = await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
      reason: "พบใบลาย้อนหลัง",
    });
    expect(result.marked).toBe(1);
    expect(result.audited).toBe(true);

    const log = await db.auditLog.findFirst({
      where: { action: "ATTENDANCE_BACK_EDIT", targetId: sessionId },
      select: { reason: true, actorId: true },
    });
    expect(log).not.toBeNull();
    expect(log?.reason).toBe("พบใบลาย้อนหลัง");
    expect(log?.actorId).toBe(ctx.teacherUserId);
  });

  it("does NOT fire audit on idempotent same-status resubmit past threshold", async () => {
    // First, create a record via lib (with reason since session is past
    // threshold) — that creates one ATTENDANCE_BACK_EDIT row.
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
      reason: "initial-late-mark",
    });
    const auditCount1 = await db.auditLog.count({
      where: { action: "ATTENDANCE_BACK_EDIT", targetId: sessionId },
    });
    expect(auditCount1).toBe(1);

    // Resubmit same status — no real change → no audit, no reason required.
    const result = await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: aliceEnrollmentId, status: "PRESENT" }],
      // No reason — and shouldn't be needed since nothing changes.
    });
    expect(result.audited).toBe(false);

    const auditCount2 = await db.auditLog.count({
      where: { action: "ATTENDANCE_BACK_EDIT", targetId: sessionId },
    });
    expect(auditCount2).toBe(1); // unchanged
  });
});
