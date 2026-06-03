import type { AttendanceStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  BACK_EDIT_THRESHOLD_MS,
  NOTE_MAX,
  REASON_MAX,
  REASON_MIN,
  TX_OPTS,
} from "./constants";

/**
 * Attendance marking — Phase 4
 *
 * Single transactional batch upsert per submitted grid (Q10 decision).
 *
 * Back-edit semantic (ADR-0016, Q8):
 *   - Threshold = `Session.scheduledStart` + 24h (Q8a anchor).
 *   - Triggers when, after the threshold, the batch either creates a new
 *     row OR changes an existing row's status. (Same-status re-submit
 *     does not trigger — that's an idempotent grid resubmit.)
 *   - Requires `reason` ≥ 5 chars; emits a single ATTENDANCE_BACK_EDIT
 *     audit event covering all changed rows in the batch.
 *
 * Authorization is verified INSIDE the transaction (Pattern 2 from
 * HANDOFF) — Session.course.teacherId must match the actor.
 */

export interface MarkItem {
  enrollmentId: string;
  status: AttendanceStatus;
  note?: string | null;
}

export interface BulkMarkResult {
  marked: number;
  audited: boolean;
}

export async function bulkMarkAttendance(params: {
  sessionId: string;
  actorUserId: string;
  items: MarkItem[];
  reason?: string | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<BulkMarkResult> {
  if (params.items.length === 0) {
    throw new ValidationError({ items: "ไม่มีรายการให้บันทึก" });
  }

  // Per-item note length cap (cheap pre-validation outside tx)
  for (const item of params.items) {
    if (item.note && item.note.length > NOTE_MAX) {
      throw new ValidationError({
        note: `บันทึกยาวเกินไป (ไม่เกิน ${NOTE_MAX} ตัวอักษร)`,
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
    const session = await tx.session.findUnique({
      where: { id: params.sessionId },
      select: {
        id: true,
        cancelledAt: true,
        scheduledStart: true,
        courseOfferingId: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!session) throw new NotFound("session_not_found");
    if (session.cancelledAt) throw new Conflict("session_cancelled");
    if (session.course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    // Validate every enrollment belongs to this course. Removed
    // (soft-deleted) Enrollments are accepted only if they already have an
    // AttendanceRecord for this Session — see ADR-0016 § 3 (grid
    // membership = active ∪ ever-marked). New marks on removed enrollments
    // are rejected (the teacher should not be able to start marking a
    // student who is no longer in the course).
    const enrollmentIds = params.items.map((i) => i.enrollmentId);
    const enrollments = await tx.enrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        courseOfferingId: session.courseOfferingId,
      },
      select: {
        id: true,
        removedAt: true,
        attendanceRecords: {
          where: { sessionId: params.sessionId },
          select: { id: true, status: true },
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
      if (e.removedAt !== null && e.attendanceRecords.length === 0) {
        throw new Forbidden("cannot_mark_removed_enrollment");
      }
    }

    const existingByEnrollment = new Map<
      string,
      { status: AttendanceStatus } | null
    >();
    for (const e of enrollments) {
      existingByEnrollment.set(e.id, e.attendanceRecords[0] ?? null);
    }

    const isBackEditWindow =
      Date.now() - session.scheduledStart.getTime() > BACK_EDIT_THRESHOLD_MS;

    type Change = {
      enrollmentId: string;
      before: AttendanceStatus | null;
      after: AttendanceStatus;
    };
    const changes: Change[] = [];
    for (const item of params.items) {
      const existing = existingByEnrollment.get(item.enrollmentId) ?? null;
      if (!existing) {
        changes.push({
          enrollmentId: item.enrollmentId,
          before: null,
          after: item.status,
        });
      } else if (existing.status !== item.status) {
        changes.push({
          enrollmentId: item.enrollmentId,
          before: existing.status,
          after: item.status,
        });
      }
    }

    const triggersBackEdit = isBackEditWindow && changes.length > 0;
    if (triggersBackEdit && reasonTrimmed.length < REASON_MIN) {
      throw new ValidationError({
        reason: `การแก้ย้อนหลัง >24 ชม. ต้องใส่เหตุผล (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
      });
    }

    for (const item of params.items) {
      const existing = existingByEnrollment.get(item.enrollmentId) ?? null;
      const statusChanged = !!existing && existing.status !== item.status;
      await tx.attendanceRecord.upsert({
        where: {
          sessionId_enrollmentId: {
            sessionId: params.sessionId,
            enrollmentId: item.enrollmentId,
          },
        },
        create: {
          sessionId: params.sessionId,
          enrollmentId: item.enrollmentId,
          status: item.status,
          note: item.note?.trim() || null,
          markedById: params.actorUserId,
        },
        update: {
          status: item.status,
          note: item.note?.trim() || null,
          markedById: params.actorUserId,
          ...(statusChanged ? { editCount: { increment: 1 } } : {}),
        },
      });
    }

    if (triggersBackEdit) {
      await audit(
        {
          actorId: params.actorUserId,
          actorRole: "TEACHER",
          action: "ATTENDANCE_BACK_EDIT",
          targetType: "Session",
          targetId: session.id,
          reason: reasonTrimmed,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          before: {
            scheduledStart: session.scheduledStart.toISOString(),
            changes: changes.map((c) => ({
              enrollmentId: c.enrollmentId,
              status: c.before,
            })),
          },
          after: {
            changes: changes.map((c) => ({
              enrollmentId: c.enrollmentId,
              status: c.after,
            })),
          },
        },
        tx
      );
    }

    return { marked: params.items.length, audited: triggersBackEdit };
  }, TX_OPTS);
}
