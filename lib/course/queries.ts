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
      class: { select: { name: true } },
      term: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
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
