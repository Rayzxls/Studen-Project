import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { isValidClassCodeFormat, normalizeClassCode } from "./class-code";

/**
 * Enroll a student in a CourseOffering using a class code.
 * Workspace model (ADR-0012): course details come from CourseOffering directly.
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

  try {
    await db.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: params.studentUserId,
          courseOfferingId: course.id,
        },
      });
      await audit(
        {
          actorId: params.studentUserId,
          actorRole: "STUDENT",
          action: "STUDENT_JOINED_COURSE",
          targetType: "Enrollment",
          targetId: enrollment.id,
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
  };
}

/** List a student's enrollments */
export async function listStudentCourses(studentUserId: string) {
  return db.enrollment.findMany({
    where: { studentId: studentUserId },
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

/** List a teacher's CourseOfferings */
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
      _count: { select: { enrollments: true } },
    },
  });
}
