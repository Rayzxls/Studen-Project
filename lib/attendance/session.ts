import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { REASON_MAX, REASON_MIN, TX_OPTS, NOTE_MAX } from "./constants";

/**
 * Session lifecycle — Phase 4
 *
 * Lazy materialization (ADR-0015): Sessions exist only after a teacher
 * explicitly opens one. `findOrCreateSession` is idempotent against the
 * `@@unique([courseOfferingId, scheduledStart])` constraint — double-clicks
 * and races resolve to the same row.
 *
 * Soft-cancel (ADR-0015 § 3): `cancelSession` sets `cancelledAt` + audit
 * `SESSION_CANCELLED` (Critical tier, requires reason ≥ 5 chars).
 */

/**
 * Find an existing Session for (course, scheduledStart) or create one.
 *
 * The transaction takes the course-ownership check; the unique constraint
 * is the race fallback. If a concurrent tx wins the create, we recover by
 * reading the row it inserted and returning `created: false`.
 */
export async function findOrCreateSession(params: {
  courseOfferingId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  timetableSlotId?: string | null;
  note?: string | null;
  actorUserId: string;
}): Promise<{
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  cancelledAt: Date | null;
  created: boolean;
}> {
  if (params.scheduledEnd <= params.scheduledStart) {
    throw new ValidationError({
      scheduledEnd: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
    });
  }
  if (params.note && params.note.length > NOTE_MAX) {
    throw new ValidationError({
      note: `บันทึกยาวเกินไป (ไม่เกิน ${NOTE_MAX} ตัวอักษร)`,
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      const course = await tx.courseOffering.findUnique({
        where: { id: params.courseOfferingId },
        select: { id: true, teacherId: true },
      });
      if (!course) throw new NotFound("course_not_found");
      if (course.teacherId !== params.actorUserId) {
        throw new Forbidden("not_course_owner");
      }

      if (params.timetableSlotId) {
        const slot = await tx.timetableSlot.findUnique({
          where: { id: params.timetableSlotId },
          select: { courseOfferingId: true },
        });
        if (!slot || slot.courseOfferingId !== course.id) {
          throw new ValidationError({
            timetableSlotId: "ช่องเวลานี้ไม่ได้อยู่ในวิชานี้",
          });
        }
      }

      const existing = await tx.session.findUnique({
        where: {
          courseOfferingId_scheduledStart: {
            courseOfferingId: params.courseOfferingId,
            scheduledStart: params.scheduledStart,
          },
        },
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          cancelledAt: true,
        },
      });
      if (existing) {
        return { ...existing, created: false as const };
      }

      const created = await tx.session.create({
        data: {
          courseOfferingId: params.courseOfferingId,
          scheduledStart: params.scheduledStart,
          scheduledEnd: params.scheduledEnd,
          timetableSlotId: params.timetableSlotId ?? null,
          note: params.note?.trim() || null,
          createdById: params.actorUserId,
        },
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          cancelledAt: true,
        },
      });
      return { ...created, created: true as const };
    }, TX_OPTS);
  } catch (err) {
    // Race: another tx beat us — recover via the unique constraint.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const recovered = await db.session.findUnique({
        where: {
          courseOfferingId_scheduledStart: {
            courseOfferingId: params.courseOfferingId,
            scheduledStart: params.scheduledStart,
          },
        },
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          cancelledAt: true,
        },
      });
      if (recovered) return { ...recovered, created: false };
    }
    throw err;
  }
}

/**
 * Soft-cancel a Session. Reason ≥ 5 chars enforced — emits SESSION_CANCELLED
 * (Critical tier). The row remains; AttendanceRecord rows already taken are
 * preserved (stats queries filter `cancelledAt IS NULL`).
 */
export async function cancelSession(params: {
  sessionId: string;
  actorUserId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const reason = params.reason.trim();
  if (reason.length < REASON_MIN) {
    throw new ValidationError({
      reason: `เหตุผลสั้นเกินไป (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
    });
  }
  if (reason.length > REASON_MAX) {
    throw new ValidationError({
      reason: `เหตุผลยาวเกินไป (ไม่เกิน ${REASON_MAX} ตัวอักษร)`,
    });
  }

  await db.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: params.sessionId },
      select: {
        id: true,
        cancelledAt: true,
        courseOfferingId: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!session) throw new NotFound("session_not_found");
    if (session.cancelledAt) throw new Conflict("already_cancelled");
    if (session.course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const now = new Date();
    await tx.session.update({
      where: { id: session.id },
      data: {
        cancelledAt: now,
        cancelledById: params.actorUserId,
        cancelledReason: reason,
      },
    });

    await audit(
      {
        actorId: params.actorUserId,
        actorRole: "TEACHER",
        action: "SESSION_CANCELLED",
        targetType: "Session",
        targetId: session.id,
        reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        before: { cancelledAt: null },
        after: {
          courseOfferingId: session.courseOfferingId,
          cancelledAt: now.toISOString(),
          cancelledById: params.actorUserId,
          cancelledReason: reason,
        },
      },
      tx
    );
  }, TX_OPTS);
}

/** List Sessions of a CourseOffering, newest first. No authz — caller gates. */
export async function listSessions(
  courseOfferingId: string,
  opts?: { limit?: number }
) {
  return db.session.findMany({
    where: { courseOfferingId },
    orderBy: { scheduledStart: "desc" },
    take: opts?.limit,
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      cancelledAt: true,
      cancelledReason: true,
      note: true,
      timetableSlotId: true,
      _count: { select: { records: true } },
    },
  });
}
