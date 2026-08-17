"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import {
  archiveCourseRewardTier,
  createCourseRewardTier,
  resolveCourseRewardClaim,
  updateCourseRewardTier,
} from "@/lib/reward/course-milestones";

export type CourseRewardActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function actionError(error: unknown): CourseRewardActionState {
  if (error instanceof ValidationError) {
    return { fieldErrors: error.errors };
  }
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      course_reward_milestone_mutations_disabled:
        "ระบบรับรางวัลจากคะแนนยังไม่เปิดให้แก้ไข",
      course_reward_not_course_owner: "คุณไม่มีสิทธิ์จัดการรางวัลของวิชานี้",
      course_reward_course_archived: "วิชานี้ถูกเก็บถาวรแล้ว",
      course_reward_tier_archived: "รางวัลนี้ถูกเก็บถาวรแล้ว",
      course_reward_tier_not_found: "ไม่พบรางวัลนี้",
      course_reward_threshold_exists: "มีรางวัลที่ใช้เกณฑ์คะแนนนี้อยู่แล้ว",
      course_reward_tier_changed:
        "ข้อมูลรางวัลถูกแก้ไขจากอีกหน้าต่าง กรุณาลองใหม่",
      course_reward_claim_not_found: "ไม่พบคำขอรับรางวัลนี้",
      course_reward_claim_already_resolved: "คำขอนี้ถูกดำเนินการแล้ว",
      course_reward_enrollment_removed: "นักเรียนออกจากรายวิชาแล้ว",
      resolution_reason_too_short: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร",
    };
    return { error: messages[error.code] ?? error.message };
  }
  throw error;
}

function tierInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    fulfillmentInstructions: String(
      formData.get("fulfillmentInstructions") ?? ""
    ),
    requiredScore: Number(String(formData.get("requiredScore") ?? "")),
  };
}

function revalidateRewardPages(courseId: string) {
  revalidatePath(`/teacher/courses/${courseId}/rewards`);
  revalidatePath(`/student/courses/${courseId}/rewards`);
}

export async function createCourseRewardTierAction(
  _previous: CourseRewardActionState,
  formData: FormData
): Promise<CourseRewardActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "ข้อมูลรายวิชาไม่ครบ" };
  try {
    await createCourseRewardTier({
      courseOfferingId: courseId,
      ...tierInput(formData),
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    return actionError(error);
  }
  revalidateRewardPages(courseId);
  return { ok: true };
}

export async function updateCourseRewardTierAction(
  _previous: CourseRewardActionState,
  formData: FormData
): Promise<CourseRewardActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  const tierId = String(formData.get("tierId") ?? "");
  if (!courseId || !tierId) return { error: "ข้อมูลรางวัลไม่ครบ" };
  try {
    await updateCourseRewardTier({
      tierId,
      ...tierInput(formData),
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    return actionError(error);
  }
  revalidateRewardPages(courseId);
  return { ok: true };
}

export async function archiveCourseRewardTierAction(
  _previous: CourseRewardActionState,
  formData: FormData
): Promise<CourseRewardActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  const tierId = String(formData.get("tierId") ?? "");
  if (!courseId || !tierId) return { error: "ข้อมูลรางวัลไม่ครบ" };
  try {
    await archiveCourseRewardTier({
      tierId,
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    return actionError(error);
  }
  revalidateRewardPages(courseId);
  return { ok: true };
}

export async function resolveCourseRewardClaimAction(
  _previous: CourseRewardActionState,
  formData: FormData
): Promise<CourseRewardActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  const claimId = String(formData.get("claimId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (!courseId || !claimId) return { error: "ข้อมูลคำขอไม่ครบ" };
  if (outcome !== "FULFILLED" && outcome !== "REJECTED") {
    return { error: "สถานะคำขอไม่ถูกต้อง" };
  }
  try {
    await resolveCourseRewardClaim({
      claimId,
      outcome,
      reason: String(formData.get("reason") ?? ""),
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    return actionError(error);
  }
  revalidateRewardPages(courseId);
  return { ok: true };
}
