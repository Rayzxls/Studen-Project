/**
 * Shared fixture helpers for integration permission tests.
 *
 * Each test file calls `setupTestCourse()` in `beforeEach` (or per-test) and
 * `cleanup()` in `afterEach`. Random IDs prevent collisions between parallel
 * test FILES (vitest runs files in separate processes by default). Within a
 * single file, tests run serially so per-test fixtures don't race either.
 *
 * Tests run against the same DB pointed to by DATABASE_URL — typically the
 * Neon dev branch in local + CI. Cleanup is best-effort but the random
 * `t_<timestamp>_<rand>` prefix makes orphans trivially identifiable.
 */

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";

// One-time hash for all test users — bcrypt cost 12 is ~500ms, do it once.
const PASSWORD_HASH = await hashPassword("Test1234!");

export type TestCourseContext = {
  prefix: string;
  teacherUserId: string;
  otherTeacherUserId: string;
  studentUserId: string;
  otherStudentUserId: string;
  classId: string;
  termId: string;
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
 * Reuses existing seed AcademicYear / Term / Class because they are stable
 * and slow to create; only owns rows the test will mutate.
 */
export async function setupTestCourse(): Promise<TestCourseContext> {
  const prefix = rnd();

  // Reuse seed academic structure to keep fixtures lean.
  const year = await db.academicYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!year) {
    throw new Error("No active AcademicYear — run `pnpm db:seed` first");
  }
  const term = await db.term.findFirst({
    where: { academicYearId: year.id, isActive: true },
    select: { id: true },
  });
  if (!term) throw new Error("No active Term in seed");
  const klass = await db.class.findFirst({
    where: { academicYearId: year.id },
    select: { id: true, gradeLevel: true },
  });
  if (!klass) throw new Error("No Class in seed");

  // Teachers
  const teacherUser = await db.user.create({
    data: {
      identifier: `${prefix}_t1@test.local`,
      passwordHash: PASSWORD_HASH,
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
      passwordHash: PASSWORD_HASH,
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

  // Students — Student.studentId is the login identifier, must be unique.
  const studentUser = await db.user.create({
    data: {
      identifier: `${prefix}_s1`,
      passwordHash: PASSWORD_HASH,
      role: "STUDENT",
      student: {
        create: {
          studentId: `${prefix}_s1`,
          firstName: "Alice",
          lastName: "Tester",
          classId: klass.id,
        },
      },
    },
    select: { id: true },
  });
  const otherStudentUser = await db.user.create({
    data: {
      identifier: `${prefix}_s2`,
      passwordHash: PASSWORD_HASH,
      role: "STUDENT",
      student: {
        create: {
          studentId: `${prefix}_s2`,
          firstName: "Bob",
          lastName: "Tester",
          classId: klass.id,
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
      classId: klass.id,
      termId: term.id,
      name: `Test Course ${prefix}`,
      gradeLevel: klass.gradeLevel,
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
    classId: klass.id,
    termId: term.id,
    courseOfferingId: course.id,
    classCode: course.classCode,
    cleanup: async () => {
      // Order matters — FKs cascade User → Teacher/Student via onDelete:Cascade,
      // but CourseOffering has onDelete:Restrict against Teacher so we must
      // delete the course first.
      // Audit logs — match by actor (test users) OR by course target.
      // We intentionally do NOT match `targetType: "Enrollment"` broadly,
      // since that would touch other tests' enrollment audits.
      await db.auditLog.deleteMany({
        where: {
          OR: [{ actorId: { in: userIds } }, { targetId: course.id }],
        },
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
