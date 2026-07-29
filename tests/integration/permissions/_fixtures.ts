/**
 * Shared fixture helpers for integration permission tests.
 *
 * Each test file calls `setupTestCourse()` in `beforeEach` (or per-test) and
 * `cleanup()` in `afterEach`. Files use random IDs and tests run serially.
 * Mutating tests may run only against the isolated QA database selected by the
 * guarded package runner. Cleanup is best-effort; any orphan remains QA-only.
 */

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

// One-time hash for all test users — bcrypt cost 12 is ~500ms, do it once.
const passwordHashPromise = hashPassword("Test1234!");

export type TestCourseContext = {
  prefix: string;
  teacherUserId: string;
  otherTeacherUserId: string;
  studentUserId: string;
  otherStudentUserId: string;
  courseOfferingId: string;
  classCode: string;
  cleanup: () => Promise<void>;
};

function rnd() {
  return `t_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

/**
 * Provision a complete test world:
 *   - 2 teachers (the owner + a foreign teacher for ownership-rejection tests)
 *   - 2 students (one to enrol/remove, one as bystander)
 *   - 1 CourseOffering with an active class code
 *
 * The CourseOffering is standalone. Tests must not depend on retired
 * Admin-managed school setup entities.
 */
export async function setupTestCourse(): Promise<TestCourseContext> {
  assertIsolatedTestDatabase();
  const passwordHash = await passwordHashPromise;
  const prefix = rnd();

  // Teachers
  const teacherUser = await db.user.create({
    data: {
      identifier: `${prefix}_t1@test.local`,
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          firstName: "Test",
          lastName: "TeacherOne",
          email: `${prefix}_t1@test.local`,
        },
      },
    },
    select: { id: true },
  });
  const otherTeacherUser = await db.user.create({
    data: {
      identifier: `${prefix}_t2@test.local`,
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          firstName: "Test",
          lastName: "TeacherTwo",
          email: `${prefix}_t2@test.local`,
        },
      },
    },
    select: { id: true },
  });

  const studentUser = await db.user.create({
    data: {
      identifier: `${prefix}_s1@test.local`,
      passwordHash,
      role: "STUDENT",
      student: {
        create: {
          firstName: "Alice",
          lastName: "Tester",
        },
      },
    },
    select: { id: true },
  });
  const otherStudentUser = await db.user.create({
    data: {
      identifier: `${prefix}_s2@test.local`,
      passwordHash,
      role: "STUDENT",
      student: {
        create: {
          firstName: "Bob",
          lastName: "Tester",
        },
      },
    },
    select: { id: true },
  });

  // Course owned by teacher #1 — class code prefixed with TST so collisions
  // with real codes are impossible.
  const classCode = `TST${prefix.slice(-4).toUpperCase()}-CODE${randomBytes(2).toString("hex").toUpperCase()}`;
  const course = await db.courseOffering.create({
    data: {
      teacherId: teacherUser.id,
      name: `Test Course ${prefix}`,
      learnerGroupLabel: "QA Group",
      academicPeriodLabel: "QA Period",
      creditHours: 1,
      classCode,
    },
    select: { id: true, classCode: true },
  });

  const userIds = [
    teacherUser.id,
    otherTeacherUser.id,
    studentUser.id,
    otherStudentUser.id,
  ];

  return {
    prefix,
    teacherUserId: teacherUser.id,
    otherTeacherUserId: otherTeacherUser.id,
    studentUserId: studentUser.id,
    otherStudentUserId: otherStudentUser.id,
    courseOfferingId: course.id,
    classCode: course.classCode,
    cleanup: async () => {
      // Order matters — FKs cascade User → Teacher/Student via onDelete:Cascade,
      // but CourseOffering has onDelete:Restrict against Teacher so we must
      // delete the course first. Phase 4: AttendanceRecord.enrollmentId is
      // onDelete:Restrict (ADR-0016 § 2), so we cannot simply rely on
      // CourseOffering cascade (which would cascade both Enrollment and
      // Session in non-deterministic order) — instead, drain children
      // bottom-up before deleting the parent.
      // Audit logs — match by actor (test users) OR by course target.
      // We intentionally do NOT match `targetType: "Enrollment"` broadly,
      // since that would touch other tests' enrollment audits.
      await db.auditLog.deleteMany({
        where: {
          OR: [{ actorId: { in: userIds } }, { targetId: course.id }],
        },
      });
      // AttendanceRecord — must die before its Enrollment parent (Restrict).
      // Reach via Session.courseOfferingId since AttendanceRecord lacks a
      // direct courseOfferingId column.
      await db.attendanceRecord.deleteMany({
        where: { session: { courseOfferingId: course.id } },
      });
      await db.session.deleteMany({
        where: { courseOfferingId: course.id },
      });
      await db.timetableSlot.deleteMany({
        where: { courseOfferingId: course.id },
      });
      // Phase 5: ScoreEntry FK to Enrollment is onDelete:Restrict (mirrors
      // AttendanceRecord per ADR-0016). Drain entries → items → enrollments.
      await db.scoreEntry.deleteMany({
        where: { scoreItem: { courseOfferingId: course.id } },
      });
      // Phase 6 — Comment is polymorphic; clear class-wide + private threads
      // hosted under Assignment / Submission / Material / Announcement of
      // this course before draining the children.
      const assignmentIds = (
        await db.assignment.findMany({
          where: { courseOfferingId: course.id },
          select: { id: true },
        })
      ).map((a) => a.id);
      const submissionIds = (
        await db.submission.findMany({
          where: { assignmentId: { in: assignmentIds } },
          select: { id: true },
        })
      ).map((s) => s.id);
      // Phase 7 — Material + Announcement live under the course.
      const materialIds = (
        await db.material.findMany({
          where: { courseOfferingId: course.id },
          select: { id: true },
        })
      ).map((m) => m.id);
      const announcementIds = (
        await db.announcement.findMany({
          where: { courseOfferingId: course.id },
          select: { id: true },
        })
      ).map((an) => an.id);
      await db.comment.deleteMany({
        where: {
          OR: [
            { authorId: { in: userIds } },
            { ownerType: "ASSIGNMENT", ownerId: { in: assignmentIds } },
            { ownerType: "SUBMISSION", ownerId: { in: submissionIds } },
            { ownerType: "MATERIAL", ownerId: { in: materialIds } },
            { ownerType: "ANNOUNCEMENT", ownerId: { in: announcementIds } },
          ],
        },
      });
      await db.fileAttachment.deleteMany({
        where: {
          OR: [
            { ownerType: "ASSIGNMENT", ownerId: { in: assignmentIds } },
            { ownerType: "SUBMISSION", ownerId: { in: submissionIds } },
            { ownerType: "MATERIAL", ownerId: { in: materialIds } },
            { ownerType: "ANNOUNCEMENT", ownerId: { in: announcementIds } },
          ],
        },
      });
      // Phase 7 — Notification rows scoped to this course OR these users.
      await db.notification.deleteMany({
        where: {
          OR: [
            { courseOfferingId: course.id },
            { recipientId: { in: userIds } },
          ],
        },
      });
      await db.submissionVersion.deleteMany({
        where: { submissionId: { in: submissionIds } },
      });
      await db.submission.deleteMany({
        where: { id: { in: submissionIds } },
      });
      await db.material.deleteMany({
        where: { courseOfferingId: course.id },
      });
      await db.announcement.deleteMany({
        where: { courseOfferingId: course.id },
      });
      // Now safe to drop assignments + their linked ScoreItem (SetNull on
      // Assignment.scoreItem; ScoreItem deletion handled by the scoring
      // drain below.
      await db.assignment.deleteMany({
        where: { courseOfferingId: course.id },
      });
      await db.scoreItem.deleteMany({
        where: { courseOfferingId: course.id },
      });
      await db.enrollment.deleteMany({
        where: { courseOfferingId: course.id },
      });
      await db.courseOffering.delete({ where: { id: course.id } });
      // Users cascade to Teacher/Student rows.
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    },
  };
}

/** Convenience — create an active enrollment for the given student. */
export async function enrollStudent(
  courseOfferingId: string,
  studentUserId: string
) {
  return db.enrollment.create({
    data: { studentId: studentUserId, courseOfferingId },
    select: { id: true },
  });
}
