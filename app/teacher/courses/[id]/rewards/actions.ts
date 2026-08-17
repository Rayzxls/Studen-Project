"use server";

import type { RewardAchievementType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import {
  awardCourseRewardPoints,
  reverseCourseRewardEntry,
} from "@/lib/reward/course-ledger";
import { getTeacherCourseRewardDashboard } from "@/lib/reward/course-dashboard";

export type RewardActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ALLOWED_TYPES = new Set<RewardAchievementType>([
  "ASSIGNMENT_SUBMITTED",
  "ATTENDANCE_PRESENT",
  "SCORE_THRESHOLD",
]);

function actionError(error: unknown): RewardActionState {
  if (error instanceof ValidationError) {
    return { fieldErrors: error.errors };
  }
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      reward_mutations_disabled: "ระบบให้แต้มยังไม่เปิดใช้งาน",
      reward_course_not_found: "ไม่พบรายวิชานี้ หรือคุณไม่มีสิทธิ์จัดการ",
      reward_enrollment_removed: "นักเรียนออกจากรายวิชาแล้ว จึงแช่แข็งแต้มไว้",
      reward_course_archived: "รายวิชาถูกเก็บถาวร จึงแช่แข็งแต้มไว้",
      reward_entry_already_reversed: "รายการนี้ถูกย้อนแต้มแล้ว",
      reward_entry_not_found: "ไม่พบรายการแต้มนี้",
    };
    return { error: messages[error.code] ?? error.message };
  }
  throw error;
}

export async function awardCourseRewardAction(
  _previous: RewardActionState,
  formData: FormData
): Promise<RewardActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const achievementType = String(
    formData.get("achievementType") ?? ""
  ) as RewardAchievementType;
  const achievementId = String(formData.get("achievementId") ?? "");
  const points = Number.parseInt(String(formData.get("points") ?? ""), 10);
  const reason = String(formData.get("reason") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!courseId || !enrollmentId) fieldErrors.reward = "ข้อมูลนักเรียนไม่ครบ";
  if (!ALLOWED_TYPES.has(achievementType) || !achievementId) {
    fieldErrors.achievement = "เลือกผลงานที่ต้องการให้แต้ม";
  }
  if (!Number.isSafeInteger(points) || points <= 0) {
    fieldErrors.points = "แต้มต้องเป็นจำนวนเต็มที่มากกว่า 0";
  }
  if (reason.length < 5) {
    fieldErrors.reason = "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร";
  } else if (reason.length > 500) {
    fieldErrors.reason = "เหตุผลต้องไม่เกิน 500 ตัวอักษร";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    // Resolve the selectable fact again on the server. A modified hidden
    // field must never turn into a free-form achievement id.
    const dashboard = await getTeacherCourseRewardDashboard({
      courseOfferingId: courseId,
      ctx: { actorUserId: session.user.id },
    });
    const member = dashboard.members.find(
      (item) => item.enrollmentId === enrollmentId
    );
    const candidate = member?.candidates.find(
      (item) =>
        item.achievementType === achievementType &&
        item.achievementId === achievementId
    );
    if (!candidate) {
      return { fieldErrors: { achievement: "ผลงานนี้ไม่อยู่ในรายวิชาแล้ว" } };
    }

    await awardCourseRewardPoints({
      enrollmentId,
      points,
      achievementType,
      achievementId,
      reason,
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/teacher/courses/${courseId}/rewards`);
  revalidatePath(`/student/courses/${courseId}/rewards`);
  return { ok: true };
}

export async function reverseCourseRewardAction(
  _previous: RewardActionState,
  formData: FormData
): Promise<RewardActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!courseId || !entryId) fieldErrors.reward = "ข้อมูลรายการแต้มไม่ครบ";
  if (reason.length < 5) {
    fieldErrors.reason = "เขียนเหตุผลอย่างน้อย 5 ตัวอักษร";
  } else if (reason.length > 500) {
    fieldErrors.reason = "เหตุผลต้องไม่เกิน 500 ตัวอักษร";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    await reverseCourseRewardEntry({
      entryId,
      reason,
      ctx: { actorUserId: session.user.id },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/teacher/courses/${courseId}/rewards`);
  revalidatePath(`/student/courses/${courseId}/rewards`);
  return { ok: true };
}
