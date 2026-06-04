"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { gradeSubmission, returnSubmission } from "@/lib/assignment/submission";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Assignment detail page (Phase 6 · P6-5b).
 *
 * Pattern 6 + 8. gradeSubmissionAction routes through
 * lib/assignment.gradeSubmission which inherits the ADR-0018 post-publish
 * reason gate from Phase 5. returnSubmissionAction routes through
 * lib/assignment.returnSubmission which creates the PRIVATE Comment +
 * audit SUBMISSION_RETURNED in one tx.
 */

export type GradeSubmissionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function gradeSubmissionAction(
  _prev: GradeSubmissionState,
  formData: FormData
): Promise<GradeSubmissionState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!courseId || !assignmentId || !submissionId) {
    return { error: "missing_context_id" };
  }

  const valueRaw = String(formData.get("value") ?? "");
  const note = String(formData.get("note") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const markGraded = formData.get("markGraded") === "on";

  const value =
    valueRaw === ""
      ? undefined
      : Number.isFinite(Number(valueRaw))
        ? Number(valueRaw)
        : NaN;
  if (value !== undefined && !Number.isFinite(value)) {
    return { fieldErrors: { value: "คะแนนต้องเป็นตัวเลข" } };
  }

  try {
    await gradeSubmission(
      {
        submissionId,
        value,
        note: note.trim() === "" ? undefined : note,
        reason: reason.trim() === "" ? undefined : reason,
        markGraded,
      },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/assignments/${assignmentId}`);
  return { ok: true };
}

export type ReturnSubmissionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function returnSubmissionAction(
  _prev: ReturnSubmissionState,
  formData: FormData
): Promise<ReturnSubmissionState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const submissionId = String(formData.get("submissionId") ?? "");
  const comment = String(formData.get("comment") ?? "");
  if (!courseId || !assignmentId || !submissionId) {
    return { error: "missing_context_id" };
  }

  try {
    await returnSubmission(
      { submissionId, comment },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/assignments/${assignmentId}`);
  return { ok: true };
}
