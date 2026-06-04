/**
 * ScoreEntry mutations — Phase 5 · ADR-0018 (edit-after-publish reason gate)
 *
 * Mirrors the Phase 4 `bulkMarkAttendance` posture (Pattern 2 + Pattern 3 +
 * single audit event per batch when the gate trips).
 *
 * The reason gate fires when AT LEAST ONE entry change is being committed
 * on a ScoreItem whose `publishedAt !== null`. Same-value re-submits do
 * not trigger (idempotent grid re-save).
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { fanOutTargetedMany } from "@/lib/notification";
import { NOTE_MAX, REASON_MAX, REASON_MIN, TX_OPTS } from "./constants";

export interface ScoreEntryInput {
  enrollmentId: string;
  /** Whole-number score, 0..fullScore (validated against the parent ScoreItem). */
  value: number;
  note?: string | null;
}

export interface BulkUpsertResult {
  upserted: number;
  audited: boolean;
}

/**
 * Single-entry convenience wrapper around `bulkUpsertScoreEntries`.
 * UI typically uses the bulk form, so the single is just a thin alias
 * for tests + per-cell API endpoints.
 */
export async function upsertScoreEntry(params: {
  scoreItemId: string;
  enrollmentId: string;
  value: number;
  note?: string | null;
  actorUserId: string;
  reason?: string | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<BulkUpsertResult> {
  return bulkUpsertScoreEntries({
    scoreItemId: params.scoreItemId,
    items: [
      {
        enrollmentId: params.enrollmentId,
        value: params.value,
        note: params.note ?? null,
      },
    ],
    actorUserId: params.actorUserId,
    reason: params.reason ?? null,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Bulk upsert ScoreEntry rows for ONE ScoreItem across many Enrollments.
 *
 * Pattern 14 (active ∪ ever-graded) is enforced: a removed Enrollment
 * can only be upserted if it already has a row for this ScoreItem.
 * First-mark on a removed Enrollment is rejected — the teacher should
 * not be entering scores for someone no longer in the course.
 */
export async function bulkUpsertScoreEntries(params: {
  scoreItemId: string;
  items: ScoreEntryInput[];
  actorUserId: string;
  reason?: string | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<BulkUpsertResult> {
  if (params.items.length === 0) {
    throw new ValidationError({ items: "ไม่มีรายการให้บันทึก" });
  }

  // Per-item note length cap (cheap pre-validation outside tx).
  for (const item of params.items) {
    if (item.note && item.note.length > NOTE_MAX) {
      throw new ValidationError({
        note: `บันทึกยาวเกินไป (ไม่เกิน ${NOTE_MAX} ตัวอักษร)`,
      });
    }
    if (!Number.isInteger(item.value) || item.value < 0) {
      throw new ValidationError({
        value: "คะแนนต้องเป็นจำนวนเต็มไม่ติดลบ",
      });
    }
  }

  const reasonTrimmed = params.reason?.trim() ?? "";
  if (reasonTrimmed.length > REASON_MAX) {
    throw new ValidationError({
      reason: `เหตุผลยาวเกินไป (ไม่เกิน ${REASON_MAX} ตัวอักษร)`,
    });
  }

  return db.$transaction(async (tx) => {
    const scoreItem = await tx.scoreItem.findUnique({
      where: { id: params.scoreItemId },
      select: {
        id: true,
        courseOfferingId: true,
        fullScore: true,
        publishedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!scoreItem) throw new NotFound("score_item_not_found");
    if (scoreItem.course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    // Value range check against this item's fullScore.
    for (const item of params.items) {
      if (item.value > scoreItem.fullScore) {
        throw new ValidationError({
          value: `คะแนนเกินคะแนนเต็ม (${item.value} / ${scoreItem.fullScore})`,
        });
      }
    }

    // Validate every enrollment belongs to this course + Pattern 14
    // (active ∪ ever-graded for THIS ScoreItem).
    const enrollmentIds = params.items.map((i) => i.enrollmentId);
    const enrollments = await tx.enrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        courseOfferingId: scoreItem.courseOfferingId,
      },
      select: {
        id: true,
        removedAt: true,
        scoreEntries: {
          where: { scoreItemId: params.scoreItemId },
          select: { id: true, value: true, note: true },
          take: 1,
        },
      },
    });
    if (enrollments.length !== enrollmentIds.length) {
      throw new ValidationError({
        items: "พบ enrollmentId ที่ไม่ได้อยู่ในวิชานี้",
      });
    }
    for (const e of enrollments) {
      if (e.removedAt !== null && e.scoreEntries.length === 0) {
        throw new Forbidden("cannot_score_removed_enrollment");
      }
    }

    const existingByEnrollment = new Map<
      string,
      { value: number; note: string | null } | null
    >();
    for (const e of enrollments) {
      const first = e.scoreEntries[0];
      existingByEnrollment.set(
        e.id,
        first ? { value: first.value, note: first.note } : null
      );
    }

    // Detect "real" changes (vs same-value re-submit) for the audit gate.
    type Change = {
      enrollmentId: string;
      before: number | null;
      after: number;
    };
    const changes: Change[] = [];
    for (const item of params.items) {
      const existing = existingByEnrollment.get(item.enrollmentId) ?? null;
      if (!existing) {
        changes.push({
          enrollmentId: item.enrollmentId,
          before: null,
          after: item.value,
        });
      } else if (existing.value !== item.value) {
        changes.push({
          enrollmentId: item.enrollmentId,
          before: existing.value,
          after: item.value,
        });
      }
      // Note-only edit does NOT count as a "score change" for the audit gate
      // (note is not a transcript-impacting field).
    }

    const isPublished = scoreItem.publishedAt !== null;
    const triggersAudit = isPublished && changes.length > 0;
    if (triggersAudit && reasonTrimmed.length < REASON_MIN) {
      throw new ValidationError({
        reason: `การแก้คะแนนหลัง publish ต้องใส่เหตุผล (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
      });
    }

    for (const item of params.items) {
      const existing = existingByEnrollment.get(item.enrollmentId) ?? null;
      const valueChanged = !!existing && existing.value !== item.value;
      await tx.scoreEntry.upsert({
        where: {
          scoreItemId_enrollmentId: {
            scoreItemId: params.scoreItemId,
            enrollmentId: item.enrollmentId,
          },
        },
        create: {
          scoreItemId: params.scoreItemId,
          enrollmentId: item.enrollmentId,
          value: item.value,
          note: item.note?.trim() || null,
          markedById: params.actorUserId,
        },
        update: {
          value: item.value,
          note: item.note?.trim() || null,
          markedById: params.actorUserId,
          ...(valueChanged ? { editCount: { increment: 1 } } : {}),
        },
      });
    }

    if (triggersAudit) {
      const auditPayload: Prisma.InputJsonValue = {
        scoreItemId: scoreItem.id,
        changes: changes.map((c) => ({
          enrollmentId: c.enrollmentId,
          before: c.before,
          after: c.after,
        })),
      };
      await audit(
        {
          actorId: params.actorUserId,
          actorRole: "TEACHER",
          action: "SCORE_EDIT_AFTER_PUBLISH",
          targetType: "ScoreItem",
          targetId: scoreItem.id,
          reason: reasonTrimmed,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          before: auditPayload,
          after: auditPayload,
        },
        tx
      );

      // P7-2 fan-out — SCORE_ENTRY_EDITED to each affected student
      // (Q6 lock — 1 row per student per batch, value-change-only).
      const affectedEnrollmentIds = changes.map((c) => c.enrollmentId);
      const affectedStudents = await tx.enrollment.findMany({
        where: { id: { in: affectedEnrollmentIds } },
        select: { studentId: true },
      });
      const item = await tx.scoreItem.findUniqueOrThrow({
        where: { id: scoreItem.id },
        select: {
          name: true,
          course: { select: { id: true, name: true } },
        },
      });
      await fanOutTargetedMany(tx, {
        kind: "SCORE_ENTRY_EDITED",
        sourceEntityType: "SCORE_ITEM",
        sourceEntityId: scoreItem.id,
        courseOfferingId: scoreItem.courseOfferingId,
        recipientIds: affectedStudents.map((s) => s.studentId),
        payload: {
          courseId: item.course.id,
          courseName: item.course.name,
          itemName: item.name,
        },
      });
    }

    return { upserted: params.items.length, audited: triggersAudit };
  }, TX_OPTS);
}

/**
 * Sentinel re-export so callers can throw the same `Conflict` from
 * higher layers without re-importing from `lib/errors`.
 */
export { Conflict };
