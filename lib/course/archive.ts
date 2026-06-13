import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";

const REASON_MIN = 5;
const REASON_MAX = 500;
const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/**
 * Archive a CourseOffering instead of deleting it. This removes the course
 * from active dashboards, blocks future joins, and keeps historical work,
 * scores, attendance, files, and audit rows intact.
 */
export async function archiveCourseOffering(params: {
  courseOfferingId: string;
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
    const course = await tx.courseOffering.findUnique({
      where: { id: params.courseOfferingId },
      select: {
        id: true,
        teacherId: true,
        name: true,
        classCode: true,
        codeActive: true,
        archivedAt: true,
      },
    });

    if (!course) throw new NotFound("course_not_found");
    if (course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    if (course.archivedAt !== null) {
      throw new Conflict("course_already_archived");
    }

    const now = new Date();
    await tx.courseOffering.update({
      where: { id: course.id },
      data: {
        archivedAt: now,
        archivedById: params.actorUserId,
        archivedReason: reason,
        codeActive: false,
      },
    });

    await audit(
      {
        actorId: params.actorUserId,
        actorRole: "TEACHER",
        action: "COURSE_OFFERING_ARCHIVED",
        targetType: "CourseOffering",
        targetId: course.id,
        targetLabel: course.name,
        reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        before: {
          archivedAt: null,
          codeActive: course.codeActive,
          classCode: course.classCode,
        },
        after: {
          archivedAt: now.toISOString(),
          archivedById: params.actorUserId,
          archivedReason: reason,
          codeActive: false,
        },
      },
      tx
    );
  }, TX_OPTS);
}
