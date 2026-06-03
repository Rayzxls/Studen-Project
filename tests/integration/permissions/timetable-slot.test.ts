// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  createTimetableSlot,
  deleteTimetableSlot,
  listTimetableSlots,
  updateTimetableSlot,
  detectOverlap,
} from "@/lib/attendance/timetable";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

/**
 * Integration + light unit tests for lib/attendance/timetable.
 *
 * Verifies ADR-0015 § 1 (TimetableSlot is a template, optional, no audit
 * on CUD per Q11C) and Phase 4 grill decisions Q4a/Q4b:
 *   - Intra-course time-range overlap blocked (Conflict slot_overlap)
 *   - Cross-course on the SAME teacher is silently allowed (Q4b)
 *   - Cross-teacher rejection (Forbidden)
 *   - No audit row written on create/update/delete (Q11C)
 */

describe("detectOverlap (pure helper)", () => {
  it("returns null when DOW differs", () => {
    expect(
      detectOverlap([{ dayOfWeek: 1, startTime: "13:00", endTime: "14:00" }], {
        dayOfWeek: 2,
        startTime: "13:00",
        endTime: "14:00",
      })
    ).toBeNull();
  });

  it("returns null when ranges touch but do not overlap", () => {
    // 13:00–14:00 and 14:00–15:00 are adjacent, not overlapping.
    expect(
      detectOverlap([{ dayOfWeek: 1, startTime: "13:00", endTime: "14:00" }], {
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "15:00",
      })
    ).toBeNull();
  });

  it("returns the offending slot when ranges overlap on same DOW", () => {
    const existing = { dayOfWeek: 1, startTime: "13:00", endTime: "14:30" };
    const overlap = detectOverlap([existing], {
      dayOfWeek: 1,
      startTime: "14:00",
      endTime: "15:00",
    });
    expect(overlap).toEqual(existing);
  });

  it("flags exact-duplicate slots", () => {
    const existing = { dayOfWeek: 3, startTime: "08:00", endTime: "09:00" };
    expect(
      detectOverlap([existing], {
        dayOfWeek: 3,
        startTime: "08:00",
        endTime: "09:00",
      })
    ).toEqual(existing);
  });
});

describe("createTimetableSlot (DB)", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates a slot with valid input", async () => {
    const slot = await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "13:30",
      endTime: "15:00",
      location: "อาคาร 3 ห้อง 305",
      actorUserId: ctx.teacherUserId,
    });
    expect(slot.id).toMatch(/^c/);
    expect(slot.startTime).toBe("13:30");
    expect(slot.location).toBe("อาคาร 3 ห้อง 305");
  });

  it("rejects start >= end with ValidationError", async () => {
    await expect(
      createTimetableSlot({
        courseOfferingId: ctx.courseOfferingId,
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "13:00",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects malformed HH:mm with ValidationError", async () => {
    await expect(
      createTimetableSlot({
        courseOfferingId: ctx.courseOfferingId,
        dayOfWeek: 1,
        startTime: "25:00",
        endTime: "26:00",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects non-owning teacher (Forbidden)", async () => {
    await expect(
      createTimetableSlot({
        courseOfferingId: ctx.courseOfferingId,
        dayOfWeek: 1,
        startTime: "13:00",
        endTime: "14:00",
        actorUserId: ctx.otherTeacherUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("blocks intra-course time-range overlap with Conflict (Q4a)", async () => {
    await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "13:30",
      endTime: "15:00",
      actorUserId: ctx.teacherUserId,
    });
    await expect(
      createTimetableSlot({
        courseOfferingId: ctx.courseOfferingId,
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "15:30",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("silently allows cross-course overlap for the same teacher (Q4b)", async () => {
    // Stray second course owned by the same teacher
    const other = await db.courseOffering.create({
      data: {
        teacherId: ctx.teacherUserId,
        classId: ctx.classId,
        termId: ctx.termId,
        name: "Other Course",
        gradeLevel: "ม.4",
        creditHours: 1,
        classCode: `TST-OVERLAP-${Date.now().toString(36)}`,
      },
      select: { id: true },
    });
    try {
      await createTimetableSlot({
        courseOfferingId: ctx.courseOfferingId,
        dayOfWeek: 1,
        startTime: "13:30",
        endTime: "15:00",
        actorUserId: ctx.teacherUserId,
      });
      // Same DOW + overlapping time on a DIFFERENT course → should succeed.
      const slot = await createTimetableSlot({
        courseOfferingId: other.id,
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "15:30",
        actorUserId: ctx.teacherUserId,
      });
      expect(slot.id).toMatch(/^c/);
    } finally {
      await db.timetableSlot.deleteMany({
        where: { courseOfferingId: other.id },
      });
      await db.courseOffering.delete({ where: { id: other.id } });
    }
  });

  it("does NOT write an audit row on slot create (Q11C)", async () => {
    const beforeCount = await db.auditLog.count({
      where: { actorId: ctx.teacherUserId },
    });
    await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "13:00",
      endTime: "14:00",
      actorUserId: ctx.teacherUserId,
    });
    const afterCount = await db.auditLog.count({
      where: { actorId: ctx.teacherUserId },
    });
    expect(afterCount).toBe(beforeCount);
  });
});

describe("updateTimetableSlot + deleteTimetableSlot (DB)", () => {
  let ctx: TestCourseContext;
  let slotId: string;
  beforeEach(async () => {
    ctx = await setupTestCourse();
    const s = await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "13:00",
      endTime: "14:00",
      actorUserId: ctx.teacherUserId,
    });
    slotId = s.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("update can change DOW + times when no conflict", async () => {
    const updated = await updateTimetableSlot({
      slotId,
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "09:00",
      actorUserId: ctx.teacherUserId,
    });
    expect(updated.dayOfWeek).toBe(3);
    expect(updated.startTime).toBe("08:00");
  });

  it("update rejects overlap against a sibling slot", async () => {
    await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "15:00",
      endTime: "16:00",
      actorUserId: ctx.teacherUserId,
    });
    // Now move slot1 (13:00–14:00) → (15:30–16:30) which overlaps slot2.
    await expect(
      updateTimetableSlot({
        slotId,
        dayOfWeek: 1,
        startTime: "15:30",
        endTime: "16:30",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("delete rejects non-owning teacher (Forbidden)", async () => {
    await expect(
      deleteTimetableSlot({
        slotId,
        actorUserId: ctx.otherTeacherUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("delete a non-existent slot is NotFound", async () => {
    await expect(
      deleteTimetableSlot({
        slotId: "non_existent",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(NotFound);
  });

  it("delete removes the row", async () => {
    await deleteTimetableSlot({ slotId, actorUserId: ctx.teacherUserId });
    const found = await db.timetableSlot.findUnique({ where: { id: slotId } });
    expect(found).toBeNull();
  });

  it("listTimetableSlots returns rows sorted by DOW then startTime", async () => {
    await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "09:00",
      actorUserId: ctx.teacherUserId,
    });
    await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "15:00",
      endTime: "16:00",
      actorUserId: ctx.teacherUserId,
    });
    const rows = await listTimetableSlots(ctx.courseOfferingId);
    // DOW asc, then startTime asc: Mon 13:00, Mon 15:00, Wed 08:00
    expect(rows.length).toBe(3);
    expect(rows[0]).toMatchObject({ dayOfWeek: 1, startTime: "13:00" });
    expect(rows[1]).toMatchObject({ dayOfWeek: 1, startTime: "15:00" });
    expect(rows[2]).toMatchObject({ dayOfWeek: 3, startTime: "08:00" });
  });
});
