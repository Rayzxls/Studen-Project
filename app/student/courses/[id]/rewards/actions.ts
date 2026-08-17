"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import { claimHighestEligibleCourseReward } from "@/lib/reward/course-milestones";

export type ClaimCourseRewardState = {
  ok?: boolean;
  error?: string;
};

export async function claimCourseRewardAction(
  _previous: ClaimCourseRewardState,
  formData: FormData
): Promise<ClaimCourseRewardState> {
  const session = await requireRole(["STUDENT"]);
  const courseId = String(formData.get("courseId") ?? "");
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!courseId || !enrollmentId) return { error: "ข้อมูลการรับรางวัลไม่ครบ" };

  try {
    await claimHighestEligibleCourseReward({
      enrollmentId,
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    if (error instanceof HttpError) {
      const messages: Record<string, string> = {
        course_reward_milestone_mutations_disabled:
          "ระบบรับรางวัลจากคะแนนยังไม่เปิดใช้งาน",
        course_reward_no_published_score: "ยังไม่มีคะแนนที่ครูประกาศ",
        course_reward_no_eligible_tier: "ยังไม่มีรางวัลใหม่ที่รับได้",
        course_reward_enrollment_removed: "คุณไม่ได้อยู่ในรายวิชานี้แล้ว",
      };
      return { error: messages[error.code] ?? error.message };
    }
    throw error;
  }

  revalidatePath(`/student/courses/${courseId}/rewards`);
  revalidatePath(`/teacher/courses/${courseId}/rewards`);
  return { ok: true };
}
