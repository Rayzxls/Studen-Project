import type { Prisma } from "@prisma/client";
import { Conflict, NotFound } from "@/lib/errors";
import { canLinkContentToLesson } from "./policy";

/** Validate the optional Lesson relation inside the caller's transaction. */
export async function assertLinkableLesson(
  tx: Prisma.TransactionClient,
  input: { lessonId: string | null | undefined; courseOfferingId: string }
): Promise<void> {
  if (!input.lessonId) return;
  const lesson = await tx.lesson.findUnique({
    where: { id: input.lessonId },
    select: { courseOfferingId: true, archivedAt: true },
  });
  if (!lesson) throw new NotFound("lesson_not_found");
  if (
    !canLinkContentToLesson({
      contentCourseOfferingId: input.courseOfferingId,
      lessonCourseOfferingId: lesson.courseOfferingId,
      lessonArchivedAt: lesson.archivedAt,
    })
  ) {
    throw new Conflict("lesson_content_target_invalid");
  }
}
