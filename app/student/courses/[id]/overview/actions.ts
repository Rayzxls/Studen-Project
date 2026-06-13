"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { leaveCourseAsStudent } from "@/lib/course/enrollment";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

export type LeaveCourseState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function leaveCourseAction(
  _prev: LeaveCourseState,
  formData: FormData
): Promise<LeaveCourseState> {
  const session = await requireRole(["STUDENT"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  if (!courseId) return { error: "missing_course_id" };

  try {
    await leaveCourseAsStudent({
      courseOfferingId: courseId,
      studentUserId: session.user.id,
      reason,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath("/dashboard");
  revalidatePath("/student/courses");
  revalidatePath(`/student/courses/${courseId}`);
  revalidatePath(`/student/courses/${courseId}/overview`);
  return { ok: true };
}
