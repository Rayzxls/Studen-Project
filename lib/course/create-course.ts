import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, NotFound } from "@/lib/errors";
import { generateUniqueClassCode } from "./class-code";

/**
 * Create a CourseOffering (workspace) owned by a teacher.
 * Auto-generates a class code.
 *
 * ADR-0012: no Subject FK — fields are owned by the CourseOffering.
 */
export async function createCourseOffering(params: {
  teacherUserId: string;
  name: string;
  subjectCode?: string;
  gradeLevel: string;
  creditHours: number;
  classId: string;
  termId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ id: string; classCode: string }> {
  const [klass, term, teacher] = await Promise.all([
    db.class.findUnique({
      where: { id: params.classId },
      select: { id: true, name: true },
    }),
    db.term.findUnique({
      where: { id: params.termId },
      select: { id: true },
    }),
    db.teacher.findUnique({
      where: { userId: params.teacherUserId },
      select: { userId: true },
    }),
  ]);

  if (!klass) throw new NotFound("class_not_found");
  if (!term) throw new NotFound("term_not_found");
  if (!teacher) throw new NotFound("teacher_not_found");

  // Generate class code hint from subject code (if provided) + class name digits
  const codeHint = params.subjectCode
    ? params.subjectCode.split("-")[0]
    : params.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4);
  const hint = `${codeHint}${klass.name.replace(/[^0-9]/g, "")}`;
  const classCode = await generateUniqueClassCode(hint);

  try {
    const created = await db.$transaction(async (tx) => {
      const course = await tx.courseOffering.create({
        data: {
          teacherId: params.teacherUserId,
          classId: params.classId,
          termId: params.termId,
          name: params.name,
          subjectCode: params.subjectCode || null,
          gradeLevel: params.gradeLevel,
          creditHours: params.creditHours,
          classCode,
          codeActive: true,
        },
        select: { id: true, classCode: true },
      });

      await audit(
        {
          actorId: params.teacherUserId,
          actorRole: "TEACHER",
          action: "COURSE_OFFERING_CREATED",
          targetType: "CourseOffering",
          targetId: course.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          after: {
            name: params.name,
            subjectCode: params.subjectCode ?? null,
            gradeLevel: params.gradeLevel,
            creditHours: params.creditHours,
            classId: params.classId,
            termId: params.termId,
            classCode,
          },
        },
        tx
      );

      return course;
    });

    return created;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Conflict("course_offering_already_exists");
    }
    throw err;
  }
}
