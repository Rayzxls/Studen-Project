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
  roomName: string;
  creditHours: number;
  termId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ id: string; classCode: string }> {
  const [term, teacher] = await Promise.all([
    db.term.findUnique({
      where: { id: params.termId },
      select: { id: true, academicYearId: true },
    }),
    db.teacher.findUnique({
      where: { userId: params.teacherUserId },
      select: { userId: true },
    }),
  ]);

  if (!term) throw new NotFound("term_not_found");
  if (!teacher) throw new NotFound("teacher_not_found");

  const gradeLevel = normalizeGradeLevel(params.gradeLevel);
  const roomName = normalizeRoomName(params.roomName);
  const className = formatClassName(gradeLevel, roomName);

  // Generate class code hint from subject code (if provided) + class name digits
  const codeHint = params.subjectCode
    ? params.subjectCode.split("-")[0]
    : params.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4);
  const hint = `${codeHint}${className.replace(/[^0-9]/g, "")}`;
  const classCode = await generateUniqueClassCode(hint);

  try {
    const created = await db.$transaction(async (tx) => {
      const klass = await tx.class.upsert({
        where: {
          academicYearId_name: {
            academicYearId: term.academicYearId,
            name: className,
          },
        },
        create: {
          academicYearId: term.academicYearId,
          name: className,
          gradeLevel,
        },
        update: {
          gradeLevel,
        },
        select: { id: true, name: true },
      });

      const course = await tx.courseOffering.create({
        data: {
          teacherId: params.teacherUserId,
          classId: klass.id,
          termId: params.termId,
          name: params.name,
          subjectCode: params.subjectCode || null,
          gradeLevel,
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
            gradeLevel,
            roomName,
            creditHours: params.creditHours,
            classId: klass.id,
            className: klass.name,
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

function normalizeGradeLevel(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, "");
  const match = trimmed.match(/^(?:ม\.?|มธยม|มัธยม)(\d+)$/i);
  if (match) return `ม.${match[1]}`;
  return trimmed;
}

function normalizeRoomName(value: string): string {
  return value
    .trim()
    .replace(/^ห้อง\s*/i, "")
    .replace(/\s+/g, "");
}

function formatClassName(gradeLevel: string, roomName: string): string {
  if (roomName.includes("/")) return roomName;
  return `${gradeLevel}/${roomName}`;
}
