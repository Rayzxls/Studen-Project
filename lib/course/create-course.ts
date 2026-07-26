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
  learnerGroupLabel?: string;
  academicPeriodLabel?: string;
  creditHours?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ id: string; classCode: string }> {
  const teacher = await db.teacher.findUnique({
    where: { userId: params.teacherUserId },
    select: { userId: true },
  });
  if (!teacher) throw new NotFound("teacher_not_found");

  // Labels are display metadata only. Identical labels never merge courses,
  // memberships, or any legacy Class/Term identity.
  const codeHint = params.subjectCode
    ? params.subjectCode.split("-")[0]
    : params.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4);
  const hint = `${codeHint}${params.learnerGroupLabel?.replace(/[^0-9]/g, "") ?? ""}`;
  const classCode = await generateUniqueClassCode(hint);

  try {
    const created = await db.$transaction(async (tx) => {
      const course = await tx.courseOffering.create({
        data: {
          teacherId: params.teacherUserId,
          name: params.name,
          subjectCode: params.subjectCode || null,
          learnerGroupLabel: params.learnerGroupLabel || null,
          academicPeriodLabel: params.academicPeriodLabel || null,
          creditHours: params.creditHours ?? null,
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
            learnerGroupLabel: params.learnerGroupLabel ?? null,
            academicPeriodLabel: params.academicPeriodLabel ?? null,
            creditHours: params.creditHours ?? null,
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
