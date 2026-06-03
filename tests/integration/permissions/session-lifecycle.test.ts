// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  cancelSession,
  findOrCreateSession,
  listSessions,
} from "@/lib/attendance/session";
import { Conflict, Forbidden, ValidationError } from "@/lib/errors";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

/**
 * Integration tests for lib/attendance/session.
 *
 * Verifies ADR-0015 (lazy materialization) + ADR-0016 invariants:
 *   - findOrCreateSession is idempotent against the unique constraint
 *   - cancelSession requires reason ≥ 5 and writes SESSION_CANCELLED audit
 *   - Cross-teacher rejection inside the $transaction (Pattern 2)
 */
describe("findOrCreateSession (ADR-0015)", () => {
  let ctx: TestCourseContext;

  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates a new Session on first call", async () => {
    const start = new Date("2026-06-08T06:30:00.000Z"); // 13:30 BKK
    const end = new Date("2026-06-08T08:00:00.000Z");
    const result = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: start,
      scheduledEnd: end,
      actorUserId: ctx.teacherUserId,
    });
    expect(result.created).toBe(true);
    expect(result.id).toMatch(/^c/); // cuid
  });

  it("returns existing Session on duplicate scheduledStart (idempotent)", async () => {
    const start = new Date("2026-06-08T06:30:00.000Z");
    const end = new Date("2026-06-08T08:00:00.000Z");
    const first = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: start,
      scheduledEnd: end,
      actorUserId: ctx.teacherUserId,
    });
    const second = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: start,
      // intentionally different end — should NOT mutate, just return existing
      scheduledEnd: new Date("2026-06-08T09:00:00.000Z"),
      actorUserId: ctx.teacherUserId,
    });
    expect(second.id).toBe(first.id);
    expect(second.created).toBe(false);
    // Confirm scheduledEnd was NOT updated (idempotent find, not upsert)
    const row = await db.session.findUnique({
      where: { id: first.id },
      select: { scheduledEnd: true },
    });
    expect(row?.scheduledEnd.toISOString()).toBe(end.toISOString());
  });

  it("rejects a non-owning teacher with Forbidden", async () => {
    const start = new Date("2026-06-08T06:30:00.000Z");
    const end = new Date("2026-06-08T08:00:00.000Z");
    await expect(
      findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: start,
        scheduledEnd: end,
        actorUserId: ctx.otherTeacherUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects scheduledEnd <= scheduledStart with ValidationError", async () => {
    const t = new Date("2026-06-08T06:30:00.000Z");
    await expect(
      findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: t,
        scheduledEnd: t,
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a timetableSlotId from a different course", async () => {
    // Provision a stray slot on another course owned by the same teacher.
    const other = await db.courseOffering.create({
      data: {
        teacherId: ctx.teacherUserId,
        classId: ctx.classId,
        termId: ctx.termId,
        name: "Stray Course",
        gradeLevel: "ม.4",
        creditHours: 1,
        classCode: `TST-STRAY-${Date.now().toString(36)}`,
      },
      select: { id: true },
    });
    const slot = await db.timetableSlot.create({
      data: {
        courseOfferingId: other.id,
        dayOfWeek: 1,
        startTime: "13:00",
        endTime: "14:00",
      },
      select: { id: true },
    });

    try {
      await expect(
        findOrCreateSession({
          courseOfferingId: ctx.courseOfferingId,
          scheduledStart: new Date("2026-06-09T06:00:00.000Z"),
          scheduledEnd: new Date("2026-06-09T07:00:00.000Z"),
          timetableSlotId: slot.id,
          actorUserId: ctx.teacherUserId,
        })
      ).rejects.toBeInstanceOf(ValidationError);
    } finally {
      await db.timetableSlot.delete({ where: { id: slot.id } });
      await db.courseOffering.delete({ where: { id: other.id } });
    }
  });
});

describe("cancelSession (ADR-0015 § 3)", () => {
  let ctx: TestCourseContext;
  let sessionId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const s = await findOrCreateSession({
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: new Date("2026-06-08T06:30:00.000Z"),
      scheduledEnd: new Date("2026-06-08T08:00:00.000Z"),
      actorUserId: ctx.teacherUserId,
    });
    sessionId = s.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("owning teacher can cancel with a valid reason", async () => {
    await cancelSession({
      sessionId,
      actorUserId: ctx.teacherUserId,
      reason: "ครูประชุมด่วน",
    });
    const row = await db.session.findUnique({
      where: { id: sessionId },
      select: {
        cancelledAt: true,
        cancelledById: true,
        cancelledReason: true,
      },
    });
    expect(row?.cancelledAt).not.toBeNull();
    expect(row?.cancelledById).toBe(ctx.teacherUserId);
    expect(row?.cancelledReason).toBe("ครูประชุมด่วน");
  });

  it("writes a SESSION_CANCELLED audit row (Critical tier) with reason", async () => {
    await cancelSession({
      sessionId,
      actorUserId: ctx.teacherUserId,
      reason: "นักเรียนทัศนศึกษา",
    });
    const log = await db.auditLog.findFirst({
      where: { action: "SESSION_CANCELLED", targetId: sessionId },
      select: { actorId: true, reason: true, actorRole: true },
    });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(ctx.teacherUserId);
    expect(log?.actorRole).toBe("TEACHER");
    expect(log?.reason).toBe("นักเรียนทัศนศึกษา");
  });

  it("rejects a non-owning teacher (Forbidden)", async () => {
    await expect(
      cancelSession({
        sessionId,
        actorUserId: ctx.otherTeacherUserId,
        reason: "ไม่ใช่เจ้าของห้อง",
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects reason < 5 chars with ValidationError", async () => {
    await expect(
      cancelSession({
        sessionId,
        actorUserId: ctx.teacherUserId,
        reason: "  ย  ",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects double-cancel as Conflict (idempotency boundary)", async () => {
    await cancelSession({
      sessionId,
      actorUserId: ctx.teacherUserId,
      reason: "ครั้งแรก",
    });
    await expect(
      cancelSession({
        sessionId,
        actorUserId: ctx.teacherUserId,
        reason: "ครั้งที่สอง",
      })
    ).rejects.toBeInstanceOf(Conflict);
  });
});

describe("listSessions", () => {
  it("returns Sessions of a course, newest first", async () => {
    const ctx = await setupTestCourse();
    try {
      await findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: new Date("2026-06-05T06:30:00.000Z"),
        scheduledEnd: new Date("2026-06-05T08:00:00.000Z"),
        actorUserId: ctx.teacherUserId,
      });
      await findOrCreateSession({
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: new Date("2026-06-08T06:30:00.000Z"),
        scheduledEnd: new Date("2026-06-08T08:00:00.000Z"),
        actorUserId: ctx.teacherUserId,
      });
      const rows = await listSessions(ctx.courseOfferingId);
      expect(rows.length).toBe(2);
      expect(rows[0]?.scheduledStart.getTime()).toBeGreaterThan(
        rows[1]!.scheduledStart.getTime()
      );
    } finally {
      await ctx.cleanup();
    }
  });
});
