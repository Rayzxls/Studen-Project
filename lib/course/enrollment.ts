import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { isValidClassCodeFormat, normalizeClassCode } from "./class-code";

const REASON_MIN = 5;
const REASON_MAX = 500;

/**
 * Enroll a student in a CourseOffering using a class code.
 * Workspace model (ADR-0012): course details come from CourseOffering directly.
 *
 * Lifecycle branches (ADR-0013):
 *   - No existing Enrollment row     → create + COURSE_MEMBER_JOINED
 *   - Existing row, removedAt = null → Conflict("already_enrolled")
 *   - Existing row, removedAt set    → restoreByRejoin (clear soft-delete
 *                                       fields) + COURSE_MEMBER_RESTORED_BY_REJOIN
 *
 * Class code gates (codeActive / codeExpiresAt) apply equally to new joins
 * and rejoin-restores — deactivating a code is the documented permanent
 * block (ADR-0013 § 2).
 */
export async function enrollByClassCode(params: {
  studentUserId: string;
  rawCode: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  courseOfferingId: string;
  courseName: string;
  className: string;
  teacherName: string;
  restored: boolean;
}> {
  const code = normalizeClassCode(params.rawCode);

  if (!isValidClassCodeFormat(code)) {
    throw new ValidationError({ code: "รหัสห้องเรียนไม่ถูกต้อง" });
  }

  const course = await db.courseOffering.findUnique({
    where: { classCode: code },
    select: {
      id: true,
      name: true,
      codeActive: true,
      codeExpiresAt: true,
      class: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  if (!course) throw new NotFound("class_code_invalid");
  if (!course.codeActive) throw new Forbidden("class_code_disabled");
  if (course.codeExpiresAt && course.codeExpiresAt < new Date()) {
    throw new Forbidden("class_code_expired");
  }

  const student = await db.student.findUnique({
    where: { userId: params.studentUserId },
    select: { userId: true },
  });
  if (!student) throw new Forbidden("not_a_student");

  let restored = false;

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.enrollment.findUnique({
        where: {
          studentId_courseOfferingId: {
            studentId: params.studentUserId,
            courseOfferingId: course.id,
          },
        },
        select: {
          id: true,
          removedAt: true,
          removedById: true,
          removedReason: true,
        },
      });

      if (existing && existing.removedAt === null) {
        throw new Conflict("already_enrolled");
      }

      if (existing && existing.removedAt !== null) {
        await restoreByRejoin({
          tx,
          enrollmentId: existing.id,
          studentUserId: params.studentUserId,
          courseOfferingId: course.id,
          classCode: code,
          before: {
            removedAt: existing.removedAt.toISOString(),
            removedById: existing.removedById,
            removedReason: existing.removedReason,
          },
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
        restored = true;
        return;
      }

      const created = await tx.enrollment.create({
        data: {
          studentId: params.studentUserId,
          courseOfferingId: course.id,
        },
        select: { id: true },
      });
      await audit(
        {
          actorId: params.studentUserId,
          actorRole: "STUDENT",
          action: "COURSE_MEMBER_JOINED",
          targetType: "Enrollment",
          targetId: created.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          after: {
            courseOfferingId: course.id,
            classCode: code,
          },
        },
        tx
      );
    });
  } catch (err) {
    // Race: another tx created the same (studentId, courseOfferingId) row
    // between our findUnique and create. Unique constraint catches it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Conflict("already_enrolled");
    }
    throw err;
  }

  return {
    courseOfferingId: course.id,
    courseName: course.name,
    className: course.class.name,
    teacherName: `${course.teacher.firstName} ${course.teacher.lastName}`,
    restored,
  };
}

/**
 * Internal — clear soft-delete fields on an Enrollment row + emit
 * COURSE_MEMBER_RESTORED_BY_REJOIN. Called only from enrollByClassCode after
 * it has already validated the class code + student identity. Caller MUST
 * supply the transaction.
 *
 * `enrolledAt` is deliberately preserved (first-join date is meaningful for
 * the teacher). Phase 8/9 may add `lastRejoinedAt` or a per-row lifecycle
 * audit subtable; today, the audit trail is the rejoin history.
 */
async function restoreByRejoin(params: {
  tx: Prisma.TransactionClient;
  enrollmentId: string;
  studentUserId: string;
  courseOfferingId: string;
  classCode: string;
  before: {
    removedAt: string;
    removedById: string | null;
    removedReason: string | null;
  };
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await params.tx.enrollment.update({
    where: { id: params.enrollmentId },
    data: {
      removedAt: null,
      removedById: null,
      removedReason: null,
    },
  });
  await audit(
    {
      actorId: params.studentUserId,
      actorRole: "STUDENT",
      action: "COURSE_MEMBER_RESTORED_BY_REJOIN",
      targetType: "Enrollment",
      targetId: params.enrollmentId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      before: params.before,
      after: {
        courseOfferingId: params.courseOfferingId,
        classCode: params.classCode,
        removedAt: null,
      },
    },
    params.tx
  );
}

/**
 * Remove a Student from a CourseOffering — soft-delete only (ADR-0013).
 *
 * Authorization is enforced inside the transaction to close TOCTOU between
 * the ownership check and the mutation:
 *   - actorRole = TEACHER → must equal CourseOffering.teacherId
 *   - actorRole = ADMIN   → currently rejected (Phase 8 will allow for
 *                            moderation; shape kept forward-compatible)
 *
 * Mandatory `reason` (5–500 chars after trim) lands on the Enrollment row
 * (visible in restore-history UI later) and on the AuditLog row.
 */
export async function removeMember(params: {
  enrollmentId: string;
  actorUserId: string;
  actorRole: "TEACHER" | "ADMIN";
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

  if (params.actorRole === "ADMIN") {
    // Phase 3 limits this action to the owning teacher. Admin moderation
    // path is reserved for Phase 8 once the audit-viewer flow lands.
    throw new Forbidden("admin_removal_not_supported_yet");
  }

  await db.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: params.enrollmentId },
      select: {
        id: true,
        studentId: true,
        courseOfferingId: true,
        removedAt: true,
        course: { select: { teacherId: true, classCode: true } },
      },
    });

    if (!enrollment) throw new NotFound("enrollment_not_found");
    if (enrollment.removedAt !== null) throw new Conflict("already_removed");
    if (enrollment.course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const now = new Date();
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        removedAt: now,
        removedById: params.actorUserId,
        removedReason: reason,
      },
    });

    await audit(
      {
        actorId: params.actorUserId,
        actorRole: "TEACHER",
        action: "COURSE_MEMBER_REMOVED",
        targetType: "Enrollment",
        targetId: enrollment.id,
        reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        before: { removedAt: null },
        after: {
          courseOfferingId: enrollment.courseOfferingId,
          studentId: enrollment.studentId,
          removedAt: now.toISOString(),
          removedById: params.actorUserId,
          removedReason: reason,
        },
      },
      tx
    );
  });
}

/**
 * Active members of a CourseOffering (i.e. `removedAt IS NULL`).
 *
 * ADR-0013 § Negative Consequences makes this the canonical read path —
 * downstream tabs / queries should route through here instead of issuing
 * `prisma.enrollment.findMany` directly and risking a forgotten filter.
 *
 * Field set is the teacher's Members-tab view (studentId + name +
 * enrolledAt). The student-side view (P3-6) will further narrow this.
 */
export async function getActiveMembers(courseOfferingId: string) {
  return db.enrollment.findMany({
    where: { courseOfferingId, removedAt: null },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      enrolledAt: true,
      student: {
        select: {
          userId: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/** List a student's enrollments (active only — soft-deleted hidden). */
export async function listStudentCourses(studentUserId: string) {
  return db.enrollment.findMany({
    where: { studentId: studentUserId, removedAt: null },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      enrolledAt: true,
      course: {
        select: {
          id: true,
          name: true,
          subjectCode: true,
          gradeLevel: true,
          creditHours: true,
          classCode: true,
          class: { select: { name: true } },
          term: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

/** List a teacher's CourseOfferings (member count = active members only). */
export async function listTeacherCourses(teacherUserId: string) {
  return db.courseOffering.findMany({
    where: { teacherId: teacherUserId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      subjectCode: true,
      gradeLevel: true,
      creditHours: true,
      classCode: true,
      codeActive: true,
      createdAt: true,
      class: { select: { name: true } },
      term: { select: { name: true } },
      _count: { select: { enrollments: { where: { removedAt: null } } } },
    },
  });
}
