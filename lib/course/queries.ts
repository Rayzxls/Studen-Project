import { db } from "@/lib/db/client";

/**
 * Common read queries for course-related entities.
 * Workspace model (ADR-0012): no Subject template — courses are teacher-owned.
 */

export async function getActiveAcademicYear() {
  return db.academicYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
}

export async function getClassesByYear(academicYearId: string) {
  return db.class.findMany({
    where: { academicYearId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
    },
  });
}

export async function getTermsByYear(academicYearId: string) {
  return db.term.findMany({
    where: { academicYearId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      name: true,
      number: true,
      isActive: true,
    },
  });
}

/**
 * Teacher's most-used class IDs (top 5, by recency of CourseOffering creation).
 * Used to suggest "frequently used" classes in ClassPicker.
 */
export async function getTeacherRecentClassIds(
  teacherUserId: string,
  limit = 5
): Promise<string[]> {
  const courses = await db.courseOffering.findMany({
    where: { teacherId: teacherUserId },
    orderBy: { createdAt: "desc" },
    select: { classId: true },
    take: 30,
  });
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of courses) {
    if (seen.has(c.classId)) continue;
    seen.add(c.classId);
    result.push(c.classId);
    if (result.length >= limit) break;
  }
  return result;
}

export async function getTeacherHomeroomClassId(
  teacherUserId: string
): Promise<string | null> {
  const t = await db.teacher.findUnique({
    where: { userId: teacherUserId },
    select: { homeroomOfId: true },
  });
  return t?.homeroomOfId ?? null;
}

export async function getCourseOfferingForTeacher(
  courseOfferingId: string,
  teacherUserId: string
) {
  return db.courseOffering.findFirst({
    where: { id: courseOfferingId, teacherId: teacherUserId },
    select: {
      id: true,
      name: true,
      subjectCode: true,
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
      enrollments: {
        some: { studentId: studentUserId, removedAt: null },
      },
    },
    select: {
      id: true,
      name: true,
      subjectCode: true,
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
