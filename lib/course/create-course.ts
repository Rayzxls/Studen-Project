import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, NotFound } from "@/lib/errors";
import { generateUniqueClassCode } from "./class-code";

/**
 * Create a CourseOffering owned by a teacher.
 * Auto-generates a class code.
 */
export async function createCourseOffering(params: {
  teacherUserId: string;
  subjectId: string;
  classId: string;
  termId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ id: string; classCode: string }> {
  // Verify references exist
  const [subject, klass, term, teacher] = await Promise.all([
    db.subject.findUnique({
      where: { id: params.subjectId },
      select: { id: true, code: true },
    }),
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

  if (!subject) throw new NotFound("subject_not_found");
  if (!klass) throw new NotFound("class_not_found");
  if (!term) throw new NotFound("term_not_found");
  if (!teacher) throw new NotFound("teacher_not_found");

  // Generate class code with hint from subject code
  // e.g., "MATH-M4" + class "ม.4/2" → hint "MATHM42"
  const hint = `${subject.code.split("-")[0]}${klass.name.replace(/[^0-9]/g, "")}`;
  const classCode = await generateUniqueClassCode(hint);

  try {
    const created = await db.$transaction(async (tx) => {
      const course = await tx.courseOffering.create({
        data: {
          teacherId: params.teacherUserId,
          subjectId: params.subjectId,
          classId: params.classId,
          termId: params.termId,
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
            subjectId: params.subjectId,
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
