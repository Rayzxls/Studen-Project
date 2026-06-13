"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { gradeSubmission, returnSubmission } from "@/lib/assignment/submission";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Assignment detail page (Phase 6 · P6-5b) +
 * Assignment Review Workspace (Phase 11 · CONTEXT § Assignment Review Workspace).
 *
 * Pattern 6 + 8. gradeSubmissionAction routes through
 * lib/assignment.gradeSubmission which inherits the ADR-0018 post-publish
 * reason gate from Phase 5. returnSubmissionAction routes through
 * lib/assignment.returnSubmission which creates the PRIVATE Comment +
 * audit SUBMISSION_RETURNED in one tx.
 *
 * The `*AndAdvance` variants back the master-detail review workspace: they
 * perform the same mutation, then server-redirect to the next item in the
 * "รอตรวจ" queue (SUBMITTED + LATE_SUBMITTED, ordered by current version
 * submittedAt ASC) so the teacher reviews continuously without leaving the
 * page. The mutation moves the just-handled submission out of that queue
 * (GRADED / RETURNED), so "next pending" is simply the new head of the queue.
 */

const workspaceBase = (courseId: string, assignmentId: string) =>
  `/teacher/courses/${courseId}/assignments/${assignmentId}`;

/**
 * Resolve the next submission still awaiting review on this Assignment.
 *
 * Pending = SUBMITTED ∪ LATE_SUBMITTED. Ordered by the current
 * SubmissionVersion.submittedAt ASC (earliest unreviewed work first) — the
 * ordering can't be expressed as a single Prisma `orderBy` on a filtered
 * relation, so we sort the bounded (≈ class-size) candidate set in memory.
 */
async function nextPendingSubmissionId(
  assignmentId: string
): Promise<string | null> {
  const pendings = await db.submission.findMany({
    where: {
      assignmentId,
      status: { in: ["SUBMITTED", "LATE_SUBMITTED"] },
    },
    select: {
      id: true,
      versions: {
        where: { isCurrent: true },
        select: { submittedAt: true },
        take: 1,
      },
    },
  });
  pendings.sort(
    (a, b) =>
      (a.versions[0]?.submittedAt?.getTime() ?? 0) -
      (b.versions[0]?.submittedAt?.getTime() ?? 0)
  );
  return pendings[0]?.id ?? null;
}

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

/**
 * Workspace secondary action — return the submission for revision (private
 * feedback comment + SUBMISSION_RETURNED audit + notification, all via the
 * existing `returnSubmission` lib path), then advance to the next queued
 * submission. Returning moves this one to RETURNED, out of the pending queue.
 */
export async function returnAndAdvanceAction(
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

  const base = workspaceBase(courseId, assignmentId);
  revalidatePath(base);
  const nextSid = await nextPendingSubmissionId(assignmentId);
  redirect(
    nextSid ? `${base}?filter=pending&sid=${nextSid}` : `${base}?filter=pending`
  );
}

/**
 * Workspace primary action — save the score (when scored) and mark the
 * submission GRADED in one step, then advance to the next queued submission.
 *
 * No `markGraded` checkbox: confirming in the review panel always means
 * "done with this one" (CONTEXT § Assignment Review Workspace). For an
 * ungraded Assignment no score is sent and the call simply transitions the
 * submission to GRADED. The ADR-0018 post-publish reason gate still applies
 * because we route through the same `gradeSubmission` lib path.
 */
export async function quickGradeAndAdvanceAction(
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
        markGraded: true,
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

  const base = workspaceBase(courseId, assignmentId);
  revalidatePath(base);
  const nextSid = await nextPendingSubmissionId(assignmentId);
  redirect(
    nextSid ? `${base}?filter=pending&sid=${nextSid}` : `${base}?filter=pending`
  );
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
