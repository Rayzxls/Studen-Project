import { db } from "@/lib/db/client";

/**
 * Common read queries for course-related entities.
 * Workspace model (ADR-0012): no Subject template — courses are teacher-owned.
 */

export async function getCourseOfferingForTeacher(
  courseOfferingId: string,
  teacherUserId: string
) {
  return db.courseOffering.findFirst({
    where: { id: courseOfferingId, teacherId: teacherUserId, archivedAt: null },
    select: {
      id: true,
      name: true,
      subjectCode: true,
      learnerGroupLabel: true,
      academicPeriodLabel: true,
      gradeLevel: true,
      creditHours: true,
      classCode: true,
      codeActive: true,
      codeExpiresAt: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
      term: { select: { name: true } },
      teacher: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          user: { select: { profileImageId: true } },
        },
      },
      enrollments: {
        orderBy: { enrolledAt: "asc" },
        select: {
          id: true,
          enrolledAt: true,
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Student-side course meta for the CourseShell header (P3-6).
 *
 * Returns null unless `studentUserId` has an active (non-removed) Enrollment
 * in the course — this is the L1 visibility gate for course-detail access.
 * The classCode field is intentionally NOT selected: it is a teacher-only
 * sharing helper, not part of the student view (CONTEXT.md § Visibility).
 *
 * Counter to getCourseOfferingForTeacher, no nested enrollments — the
 * Members tab handles its own L1-filtered list via getActiveMembersForStudent.
 */
export async function getCourseOfferingForStudent(
  courseOfferingId: string,
  studentUserId: string
) {
  return db.courseOffering.findFirst({
    where: {
      id: courseOfferingId,
      archivedAt: null,
      enrollments: {
        some: { studentId: studentUserId, removedAt: null },
      },
    },
    select: {
      id: true,
      name: true,
      subjectCode: true,
      learnerGroupLabel: true,
      academicPeriodLabel: true,
      gradeLevel: true,
      creditHours: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
      term: { select: { name: true } },
      teacher: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          user: { select: { profileImageId: true } },
        },
      },
    },
  });
}
