"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { removeMember } from "@/lib/course/enrollment";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

export type RemoveMemberState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

/**
 * Server Action — soft-delete an Enrollment row from the teacher Members
 * tab dialog. Thin wrapper around lib/course/enrollment.removeMember; the
 * lower-level wrapper already enforces ownership inside its $transaction,
 * so this layer just collects request metadata + serialises errors back
 * to the form via useActionState.
 *
 * `courseId` arrives via a hidden form field (NOT `.bind`) — under
 * Next 16 + Auth.js v5 beta the bound-Server-Action path intermittently
 * drops the session cookie after a prior revalidatePath cycle. Reading
 * from FormData side-steps the binding code path entirely.
 */
export async function removeMemberAction(
  _prev: RemoveMemberState,
  formData: FormData
): Promise<RemoveMemberState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = String(formData.get("courseId") ?? "");
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!courseId) return { error: "missing_course_id" };
  if (!enrollmentId) return { fieldErrors: { enrollmentId: "missing" } };

  const meta = await getRequestMeta();

  try {
    await removeMember({
      enrollmentId,
      actorUserId: session.user.id,
      actorRole: "TEACHER",
      reason,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/members`);
  revalidatePath(`/teacher/courses/${courseId}`);
  return { ok: true };
}
