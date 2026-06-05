/**
 * Integration — Material + Announcement broadcasts + soft-delete cascade
 * suppression (Phase 7 · P7-9)
 *
 * Locks the fan-out + suppress wiring against a real Neon DB:
 *
 *   - createMaterial broadcasts MATERIAL_POSTED to every active enrollment.
 *   - createAnnouncement broadcasts ANNOUNCEMENT_POSTED similarly.
 *   - Removed (soft-deleted) enrollments do NOT receive the broadcast.
 *   - softDeleteMaterial cascade-suppresses MATERIAL_POSTED notifications
 *     referencing that material; the entity row is preserved but the
 *     bell stops linking to a soon-to-404 detail page.
 *   - Same posture for softDeleteAnnouncement.
 *   - The author is excluded from their own broadcast (teachers don't
 *     get a notification for what they just posted).
 *
 * Each fan-out is in-tx with the mutation (Pattern 2 extended) — we
 * read the Notification table right after the mutation returns and
 * expect the rows present.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createMaterial, softDeleteMaterial } from "@/lib/material";
import { createAnnouncement, softDeleteAnnouncement } from "@/lib/announcement";
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

describe("createMaterial — MATERIAL_POSTED broadcast", () => {
  it("fans out to every active enrollment, excludes removed students", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const removed = await enrollStudent(
      ctx.courseOfferingId,
      ctx.otherStudentUserId
    );
    await db.enrollment.update({
      where: { id: removed.id },
      data: {
        removedAt: new Date(),
        removedById: ctx.teacherUserId,
        removedReason: "test removal pre-broadcast",
      },
    });

    const m = await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Worksheet 1",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );

    const rows = await db.notification.findMany({
      where: {
        sourceEntityType: "MATERIAL",
        sourceEntityId: m.id,
      },
      select: { recipientId: true, kind: true },
    });
    const recipients = new Set(rows.map((r) => r.recipientId));
    expect(rows.every((r) => r.kind === "MATERIAL_POSTED")).toBe(true);
    expect(recipients.has(ctx.studentUserId)).toBe(true);
    expect(recipients.has(ctx.otherStudentUserId)).toBe(false);
    // Author is NOT a recipient — fan-out is over enrollments, and the
    // teacher who posted is not an Enrollment row.
    expect(recipients.has(ctx.teacherUserId)).toBe(false);
  });

  it("idempotent (post-once partial unique): re-running insertion does not double-fire", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const m = await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "M1",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    // Manually re-attempt the same insert — partial unique index honored
    // by `createMany({skipDuplicates: true})`.
    const before = await db.notification.count({
      where: { sourceEntityType: "MATERIAL", sourceEntityId: m.id },
    });
    await db.notification.createMany({
      data: [
        {
          recipientId: ctx.studentUserId,
          kind: "MATERIAL_POSTED",
          sourceEntityType: "MATERIAL",
          sourceEntityId: m.id,
          courseOfferingId: ctx.courseOfferingId,
          payloadJson: {},
        },
      ],
      skipDuplicates: true,
    });
    const after = await db.notification.count({
      where: { sourceEntityType: "MATERIAL", sourceEntityId: m.id },
    });
    expect(after).toBe(before);
  });
});

describe("softDeleteMaterial — cascade-suppress + Important audit", () => {
  it("sets suppressedAt on every MATERIAL_POSTED row referencing the deleted material", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);
    const m = await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Will be deleted",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    const liveBefore = await db.notification.count({
      where: {
        sourceEntityType: "MATERIAL",
        sourceEntityId: m.id,
        suppressedAt: null,
      },
    });
    expect(liveBefore).toBe(2);

    await softDeleteMaterial(m.id, {
      actorUserId: ctx.teacherUserId,
      reason: "ลบเอกสารผิด",
    });

    const liveAfter = await db.notification.count({
      where: {
        sourceEntityType: "MATERIAL",
        sourceEntityId: m.id,
        suppressedAt: null,
      },
    });
    expect(liveAfter).toBe(0);

    // Rows are preserved (suppressed not deleted).
    const totalAfter = await db.notification.count({
      where: { sourceEntityType: "MATERIAL", sourceEntityId: m.id },
    });
    expect(totalAfter).toBe(2);

    const audit = await db.auditLog.findFirst({
      where: { action: "MATERIAL_DELETED", targetId: m.id },
      select: { reason: true, actorRole: true },
    });
    expect(audit).not.toBeNull();
    expect(audit?.reason).toBe("ลบเอกสารผิด");
    expect(audit?.actorRole).toBe("TEACHER");
  });
});

describe("createAnnouncement — ANNOUNCEMENT_POSTED broadcast", () => {
  it("fans out to active enrollments only, with snapshot payload", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const a = await createAnnouncement(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "ปิดเรียน",
        body: "วันศุกร์",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    const rows = await db.notification.findMany({
      where: {
        sourceEntityType: "ANNOUNCEMENT",
        sourceEntityId: a.id,
      },
      select: { recipientId: true, payloadJson: true },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.recipientId).toBe(ctx.studentUserId);
    const payload = rows[0]?.payloadJson as Record<string, unknown>;
    expect(payload.title).toBe("ปิดเรียน");
  });
});

describe("softDeleteAnnouncement — cascade-suppress + audit", () => {
  it("suppresses ANNOUNCEMENT_POSTED rows + writes ANNOUNCEMENT_DELETED audit", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const a = await createAnnouncement(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: null,
        body: "untitled body",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    await softDeleteAnnouncement(a.id, {
      actorUserId: ctx.teacherUserId,
      reason: "ข้อมูลผิด",
    });
    const live = await db.notification.count({
      where: {
        sourceEntityType: "ANNOUNCEMENT",
        sourceEntityId: a.id,
        suppressedAt: null,
      },
    });
    expect(live).toBe(0);
    const audit = await db.auditLog.findFirst({
      where: { action: "ANNOUNCEMENT_DELETED", targetId: a.id },
      select: { reason: true },
    });
    expect(audit?.reason).toBe("ข้อมูลผิด");
  });
});
