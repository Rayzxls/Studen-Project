// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createScoreItem, publishScoreItem } from "@/lib/scoring/score-item";
import { bulkUpsertScoreEntries } from "@/lib/scoring/score-entry";
import { Forbidden, ValidationError } from "@/lib/errors";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Integration tests for lib/scoring/score-entry.ts — Phase 5 P5-7.
 *
 * Covers:
 *   - Value range validation (≤ fullScore)
 *   - Pattern 14 active∪ever-graded enforcement for first-mark vs edit
 *   - Reason gate on publish edit + value-change-only detection (note-only
 *     edits don't trip the audit)
 *   - SCORE_EDIT_AFTER_PUBLISH single audit per batch (mirrors Phase 4
 *     ATTENDANCE_BACK_EDIT posture)
 */

describe("bulkUpsertScoreEntries — pre-publish", () => {
  let ctx: TestCourseContext;
  let scoreItemId: string;
  let enrollmentId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Quiz",
        fullScore: 20,
      },
      { actorUserId: ctx.teacherUserId }
    );
    scoreItemId = item.id;
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    enrollmentId = e.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates a ScoreEntry on first upsert (no reason required)", async () => {
    const result = await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
    });
    expect(result.upserted).toBe(1);
    expect(result.audited).toBe(false);
    const row = await db.scoreEntry.findFirst({
      where: { scoreItemId, enrollmentId },
      select: { value: true, editCount: true },
    });
    expect(row?.value).toBe(15);
    expect(row?.editCount).toBe(0);
  });

  it("increments editCount on value change", async () => {
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
    });
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 18 }],
      actorUserId: ctx.teacherUserId,
    });
    const row = await db.scoreEntry.findFirst({
      where: { scoreItemId, enrollmentId },
      select: { value: true, editCount: true },
    });
    expect(row?.value).toBe(18);
    expect(row?.editCount).toBe(1);
  });

  it("does NOT increment editCount on same-value re-submit (idempotent)", async () => {
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
    });
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
    });
    const row = await db.scoreEntry.findFirst({
      where: { scoreItemId, enrollmentId },
      select: { editCount: true },
    });
    expect(row?.editCount).toBe(0);
  });

  it("rejects value > fullScore", async () => {
    await expect(
      bulkUpsertScoreEntries({
        scoreItemId,
        items: [{ enrollmentId, value: 21 }],
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects negative value", async () => {
    await expect(
      bulkUpsertScoreEntries({
        scoreItemId,
        items: [{ enrollmentId, value: -1 }],
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an enrollmentId from a different course", async () => {
    // Make a foreign course owned by the same teacher and enroll the
    // same student there.
    const otherCourse = await db.courseOffering.create({
      data: {
        teacherId: ctx.teacherUserId,
        classId: ctx.classId,
        termId: ctx.termId,
        name: `Other ${ctx.prefix}`,
        gradeLevel: "ม.4",
        creditHours: 1,
        classCode: `TST${ctx.prefix.slice(-4).toUpperCase()}-OTHER`,
      },
      select: { id: true },
    });
    const foreignEnroll = await db.enrollment.create({
      data: {
        studentId: ctx.studentUserId,
        courseOfferingId: otherCourse.id,
      },
      select: { id: true },
    });
    await expect(
      bulkUpsertScoreEntries({
        scoreItemId, // belongs to ctx.courseOfferingId, not otherCourse
        items: [{ enrollmentId: foreignEnroll.id, value: 10 }],
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
    // Cleanup the stray.
    await db.enrollment.delete({ where: { id: foreignEnroll.id } });
    await db.courseOffering.delete({ where: { id: otherCourse.id } });
  });

  it("rejects cross-teacher submission with Forbidden", async () => {
    await expect(
      bulkUpsertScoreEntries({
        scoreItemId,
        items: [{ enrollmentId, value: 10 }],
        actorUserId: ctx.otherTeacherUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("bulkUpsertScoreEntries — post-publish reason gate", () => {
  let ctx: TestCourseContext;
  let scoreItemId: string;
  let enrollmentId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Quiz",
        fullScore: 20,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await publishScoreItem(item.id, { actorUserId: ctx.teacherUserId });
    scoreItemId = item.id;
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    enrollmentId = e.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("first-mark after publish requires reason ≥ 5 + emits audit", async () => {
    await expect(
      bulkUpsertScoreEntries({
        scoreItemId,
        items: [{ enrollmentId, value: 15 }],
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);

    const result = await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
      reason: "first-mark after publish window opened",
    });
    expect(result.audited).toBe(true);

    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_EDIT_AFTER_PUBLISH", targetId: scoreItemId },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.reason).toContain("first-mark");
  });

  it("note-only edit does NOT trip the reason gate", async () => {
    // Land an initial entry with a reason.
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
      reason: "first-mark after publish",
    });
    // Re-submit with same value + a new note → no reason needed.
    const result = await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15, note: "showed work neatly" }],
      actorUserId: ctx.teacherUserId,
    });
    expect(result.audited).toBe(false);
    const row = await db.scoreEntry.findFirst({
      where: { scoreItemId, enrollmentId },
      select: { note: true, editCount: true },
    });
    expect(row?.note).toBe("showed work neatly");
  });

  it("rejects re-mark of a removed enrollment with no prior entry (Pattern 14)", async () => {
    // Remove enrollment first, then try to first-mark it.
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });
    await expect(
      bulkUpsertScoreEntries({
        scoreItemId,
        items: [{ enrollmentId, value: 10 }],
        actorUserId: ctx.teacherUserId,
        reason: "trying to mark removed student",
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("ALLOWS edit on a removed-but-previously-graded enrollment (Pattern 14)", async () => {
    // Land an initial entry, then remove the student. Should still be able
    // to edit the existing row (history-preserving).
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 15 }],
      actorUserId: ctx.teacherUserId,
      reason: "first-mark after publish",
    });
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });
    const result = await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId, value: 16 }],
      actorUserId: ctx.teacherUserId,
      reason: "post-removal correction per appeal",
    });
    expect(result.audited).toBe(true);
    const row = await db.scoreEntry.findFirst({
      where: { scoreItemId, enrollmentId },
      select: { value: true, editCount: true },
    });
    expect(row?.value).toBe(16);
  });

  it("multi-item batch: single audit row covers all real changes", async () => {
    // Two students, both first-mark post-publish in one call.
    const e2 = await enrollStudent(
      ctx.courseOfferingId,
      ctx.otherStudentUserId
    );
    const result = await bulkUpsertScoreEntries({
      scoreItemId,
      items: [
        { enrollmentId, value: 15 },
        { enrollmentId: e2.id, value: 18 },
      ],
      actorUserId: ctx.teacherUserId,
      reason: "first-mark batch for both students",
    });
    expect(result.upserted).toBe(2);
    expect(result.audited).toBe(true);
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_EDIT_AFTER_PUBLISH", targetId: scoreItemId },
    });
    // One row per batch, NOT per student.
    expect(audits).toHaveLength(1);
  });
});
