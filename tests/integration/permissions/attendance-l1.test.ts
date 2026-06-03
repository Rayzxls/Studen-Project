// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  getAttendanceGridForTeacher,
  getAttendanceStatsForStudent,
  getStudentSessionAttendance,
} from "@/lib/attendance/queries";
import { bulkMarkAttendance } from "@/lib/attendance/mark";
import { cancelSession, findOrCreateSession } from "@/lib/attendance/session";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * L1 + grid-membership tests (ADR-0016 § 3, Pattern 4 from HANDOFF).
 *
 * Verifies:
 *   - getAttendanceStatsForStudent returns own counts only; peer marks
 *     in the same Session do not bleed in
 *   - getStudentSessionAttendance projects records to own-enrollment only
 *   - Cancelled Sessions affect the denominator (counted in `totalSessions`
 *     should be false — they're filtered)
 *   - getAttendanceGridForTeacher returns active ∪ ever-marked union
 */

describe("getAttendanceStatsForStudent — L1 projection", () => {
  let ctx: TestCourseContext;
  let aliceEnrollmentId: string;
  let bobEnrollmentId: string;
  let sessionId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    aliceEnrollmentId = (
      await enrollStudent(ctx.courseOfferingId, ctx.studentUserId)
    ).id;
    bobEnrollmentId = (
      await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId)
    ).id;
    sessionId = (
      await findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: new Date(Date.now() - 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() - 30 * 60 * 1000),
        actorUserId: ctx.teacherUserId,
      })
    ).id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns null when the student has no enrollment row", async () => {
    // foreignStudentUserId without an Enrollment — use the other teacher's
    // userId, which has no Student row at all, so this exercises the
    // "no row" branch via the `findUnique` returning null.
    const stats = await getAttendanceStatsForStudent({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.otherTeacherUserId,
    });
    expect(stats).toBeNull();
  });

  it("returns own counts; peer mark in same Session does NOT leak", async () => {
    // Teacher marks BOTH Alice (PRESENT) and Bob (ABSENT).
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [
        { enrollmentId: aliceEnrollmentId, status: "PRESENT" },
        { enrollmentId: bobEnrollmentId, status: "ABSENT" },
      ],
    });

    // Alice's view — she should see ONLY her own PRESENT count.
    const aliceStats = await getAttendanceStatsForStudent({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.studentUserId,
    });
    expect(aliceStats).not.toBeNull();
    expect(aliceStats!.counts.PRESENT).toBe(1);
    expect(aliceStats!.counts.ABSENT).toBe(0); // Bob's row doesn't leak
    expect(aliceStats!.counts.LATE).toBe(0);
    expect(aliceStats!.counts.EXCUSED).toBe(0);
    expect(aliceStats!.marked).toBe(1);
    expect(aliceStats!.totalSessions).toBe(1);
    expect(aliceStats!.notMarkedYet).toBe(0);
    void bobEnrollmentId;
  });

  it("cancelled Sessions are excluded from the denominator", async () => {
    // Open a 2nd Session, cancel it. Total non-cancelled = 1.
    const s2 = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: new Date(Date.now() - 90 * 60 * 1000),
      scheduledEnd: new Date(Date.now() - 80 * 60 * 1000),
      actorUserId: ctx.teacherUserId,
    });
    await cancelSession({
      sessionId: s2.id,
      actorUserId: ctx.teacherUserId,
      reason: "ครูประชุมด่วน",
    });
    const stats = await getAttendanceStatsForStudent({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.studentUserId,
    });
    expect(stats!.totalSessions).toBe(1); // s1 only, not s2
  });
});

describe("getStudentSessionAttendance — own-only timeline", () => {
  let ctx: TestCourseContext;
  let aliceEnrollmentId: string;
  let bobEnrollmentId: string;
  let sessionId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    aliceEnrollmentId = (
      await enrollStudent(ctx.courseOfferingId, ctx.studentUserId)
    ).id;
    bobEnrollmentId = (
      await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId)
    ).id;
    sessionId = (
      await findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: new Date(Date.now() - 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() - 30 * 60 * 1000),
        actorUserId: ctx.teacherUserId,
      })
    ).id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns empty array when student has no enrollment", async () => {
    const rows = await getStudentSessionAttendance({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.otherTeacherUserId,
    });
    expect(rows).toEqual([]);
  });

  it("returns ownStatus = peer's status does not appear in own timeline", async () => {
    // Mark Bob LATE only; Alice unmarked.
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: bobEnrollmentId, status: "LATE" }],
    });

    const aliceTimeline = await getStudentSessionAttendance({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.studentUserId,
    });
    expect(aliceTimeline.length).toBe(1);
    expect(aliceTimeline[0]!.ownStatus).toBeNull(); // Alice not marked
    expect(aliceTimeline[0]!.sessionId).toBe(sessionId);

    // And Bob's own view sees his own LATE.
    const bobTimeline = await getStudentSessionAttendance({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.otherStudentUserId,
    });
    expect(bobTimeline[0]!.ownStatus).toBe("LATE");
    void aliceEnrollmentId;
  });

  it("includes cancelled Sessions with ownStatus = null", async () => {
    await cancelSession({
      sessionId,
      actorUserId: ctx.teacherUserId,
      reason: "ครูประชุมด่วน",
    });
    const timeline = await getStudentSessionAttendance({
      courseOfferingId: ctx.courseOfferingId,
      studentUserId: ctx.studentUserId,
    });
    expect(timeline.length).toBe(1);
    expect(timeline[0]!.cancelledAt).not.toBeNull();
    expect(timeline[0]!.cancelledReason).toBe("ครูประชุมด่วน");
    expect(timeline[0]!.ownStatus).toBeNull();
  });
});

describe("getAttendanceGridForTeacher — active ∪ ever-marked (ADR-0016 § 3)", () => {
  let ctx: TestCourseContext;
  let aliceEnrollmentId: string;
  let bobEnrollmentId: string;
  let sessionId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    aliceEnrollmentId = (
      await enrollStudent(ctx.courseOfferingId, ctx.studentUserId)
    ).id;
    bobEnrollmentId = (
      await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId)
    ).id;
    sessionId = (
      await findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: new Date(Date.now() - 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() - 30 * 60 * 1000),
        actorUserId: ctx.teacherUserId,
      })
    ).id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("includes both active members", async () => {
    const grid = await getAttendanceGridForTeacher(sessionId);
    expect(grid).not.toBeNull();
    expect(grid!.rows.length).toBe(2);
    const ids = grid!.rows.map((r) => r.enrollmentId).sort();
    expect(ids).toEqual([aliceEnrollmentId, bobEnrollmentId].sort());
    // None marked yet
    expect(grid!.rows.every((r) => r.record === null)).toBe(true);
  });

  it("removed-but-marked enrollment remains in the grid (with removed=true)", async () => {
    // Mark Bob first.
    await bulkMarkAttendance({
      sessionId,
      actorUserId: ctx.teacherUserId,
      items: [{ enrollmentId: bobEnrollmentId, status: "PRESENT" }],
    });
    // Remove Bob.
    await db.enrollment.update({
      where: { id: bobEnrollmentId },
      data: {
        removedAt: new Date(),
        removedById: ctx.teacherUserId,
        removedReason: "test_remove_after_mark",
      },
    });
    const grid = await getAttendanceGridForTeacher(sessionId);
    expect(grid!.rows.length).toBe(2); // Bob still appears
    const bob = grid!.rows.find((r) => r.enrollmentId === bobEnrollmentId);
    expect(bob?.removed).toBe(true);
    expect(bob?.record?.status).toBe("PRESENT");
  });

  it("removed AND never-marked enrollment disappears from future grids", async () => {
    // Remove Bob WITHOUT marking. Then open a NEW session — Bob should not
    // appear in that session's grid.
    await db.enrollment.update({
      where: { id: bobEnrollmentId },
      data: {
        removedAt: new Date(),
        removedById: ctx.teacherUserId,
        removedReason: "test_remove_before_mark",
      },
    });
    const newSession = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: new Date(Date.now() - 30 * 60 * 1000),
      scheduledEnd: new Date(Date.now() - 15 * 60 * 1000),
      actorUserId: ctx.teacherUserId,
    });
    const grid = await getAttendanceGridForTeacher(newSession.id);
    expect(grid!.rows.length).toBe(1); // only Alice
    expect(grid!.rows[0]!.enrollmentId).toBe(aliceEnrollmentId);
  });
});
