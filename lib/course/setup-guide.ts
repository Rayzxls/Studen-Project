import { db } from "@/lib/db/client";

/**
 * The first-course walkthrough is shown to a teacher who has never seen it and
 * who now owns at least one course. Both conditions matter: before the first
 * course there is nothing to point at, and after the first viewing the tour
 * must not come back.
 *
 * Archived courses count. A teacher who created a course and cancelled it has
 * still been through course creation once.
 */
export async function shouldShowTeacherSetupGuide(
  teacherUserId: string
): Promise<boolean> {
  const teacher = await db.teacher.findUnique({
    where: { userId: teacherUserId },
    select: {
      setupGuideSeenAt: true,
      _count: { select: { courses: true } },
    },
  });

  if (!teacher) return false;
  return teacher.setupGuideSeenAt === null && teacher._count.courses > 0;
}

/**
 * Records that the walkthrough is done. Idempotent: finishing it twice (two
 * tabs open, say) keeps the first timestamp rather than moving it.
 */
export async function markTeacherSetupGuideSeen(
  teacherUserId: string
): Promise<void> {
  await db.teacher.updateMany({
    where: { userId: teacherUserId, setupGuideSeenAt: null },
    data: { setupGuideSeenAt: new Date() },
  });
}
