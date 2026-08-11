import { db } from "@/lib/db/client";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { OptionalMeetingUrlSchema } from "@/lib/meeting/validation";

/**
 * Setting the course's standing online room (ADR-0052).
 *
 * Not audited, matching the rest of course configuration: a meeting link is
 * where a class happens, not a record of what a student did. Timetable slot
 * CRUD is unaudited for the same reason (Q11C).
 */
export async function setCourseMeetingUrl(params: {
  courseOfferingId: string;
  meetingUrl: string | null;
  actorUserId: string;
}): Promise<{ meetingUrl: string | null }> {
  const parsed = OptionalMeetingUrlSchema.safeParse(params.meetingUrl ?? "");
  if (!parsed.success) {
    throw new ValidationError({
      meetingUrl:
        parsed.error.issues[0]?.message ?? "ลิงก์ต้องขึ้นต้นด้วย https://",
    });
  }

  const course = await db.courseOffering.findUnique({
    where: { id: params.courseOfferingId },
    select: { id: true, teacherId: true, archivedAt: true },
  });
  if (!course) throw new NotFound("course_not_found");
  if (course.teacherId !== params.actorUserId) {
    throw new Forbidden("not_course_owner");
  }
  if (course.archivedAt !== null) {
    throw new ValidationError({ meetingUrl: "รายวิชานี้ถูกเก็บถาวรแล้ว" });
  }

  const updated = await db.courseOffering.update({
    where: { id: params.courseOfferingId },
    data: { meetingUrl: parsed.data },
    select: { meetingUrl: true },
  });
  return updated;
}
