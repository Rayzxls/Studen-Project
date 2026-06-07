/**
 * Integration — Notification suppress hooks at enrollment lifecycle
 * boundaries (Phase 7 · P7-9 · ADR-0013 + ADR-0022 § 5)
 *
 * Locks the in-tx wiring between enrollment soft-delete / restore and
 * Notification.suppressedAt:
 *
 *   - removeMember marks every Notification of (this recipient, this
 *     course) as `suppressedAt = now()` in the same tx.
 *   - restoreByRejoin (called from enrollByClassCode against a soft-
 *     deleted enrollment) un-suppresses (`suppressedAt = null`) those
 *     same rows so the bell history comes back alive.
 *   - Suppression scope: ONLY the rejoining recipient's rows in THAT
 *     course — other courses, other recipients are untouched.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createMaterial } from "@/lib/material";
import { createAnnouncement } from "@/lib/announcement";
import { enrollByClassCode, removeMember } from "@/lib/course/enrollment";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

describe("removeMember → suppressNotificationsForRemovedMember", () => {
  it("suppresses every notification of (removed student × this course)", async () => {
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    // Generate notification rows for the student.
    await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "M1",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    await createAnnouncement(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "A1",
        body: "x",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );

    const before = await db.notification.findMany({
      where: {
        recipientId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { id: true, suppressedAt: true },
    });
    expect(before.length).toBe(2);
    expect(before.every((n) => n.suppressedAt === null)).toBe(true);

    await removeMember({
      enrollmentId: enrollment.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ลาออก",
    });

    const after = await db.notification.findMany({
      where: {
        recipientId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { id: true, suppressedAt: true },
    });
    expect(after.length).toBe(2);
    expect(after.every((n) => n.suppressedAt !== null)).toBe(true);
  });

  it("does NOT touch other students' rows in the same course", async () => {
    const e1 = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);

    await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "M shared",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );

    await removeMember({
      enrollmentId: e1.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ลาออก",
    });

    const otherStill = await db.notification.count({
      where: {
        recipientId: ctx.otherStudentUserId,
        courseOfferingId: ctx.courseOfferingId,
        suppressedAt: null,
      },
    });
    expect(otherStill).toBe(1);
  });
});

describe("restoreByRejoin (via enrollByClassCode) → unsuppress", () => {
  it("re-using the same class code un-suppresses prior notifications", async () => {
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "M before removal",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    await removeMember({
      enrollmentId: enrollment.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ลาออกชั่วคราว",
    });
    // Sanity — rows now suppressed.
    const suppressed = await db.notification.count({
      where: {
        recipientId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
        suppressedAt: { not: null },
      },
    });
    expect(suppressed).toBeGreaterThan(0);

    // Re-join using the same class code.
    await enrollByClassCode({
      studentUserId: ctx.studentUserId,
      rawCode: ctx.classCode,
    });

    const live = await db.notification.count({
      where: {
        recipientId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
        suppressedAt: null,
      },
    });
    expect(live).toBeGreaterThan(0);
    const stillSuppressed = await db.notification.count({
      where: {
        recipientId: ctx.studentUserId,
        courseOfferingId: ctx.courseOfferingId,
        suppressedAt: { not: null },
      },
    });
    expect(stillSuppressed).toBe(0);
  });
});
