"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { submitVersion } from "@/lib/assignment/submission";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Student submit + voluntary resubmit (Phase 6 · P6-6).
 *
 * Pattern 6 + 8. Routes through lib/assignment.submitVersion which
 * enforces:
 *   - Active enrollment (Pattern 14 / ADR-0013);
 *   - submission window (submissionClosed / autoCloseAtDue per ADR-0020 § 3);
 *   - per-channel allow* gate;
 *   - races on findOrCreateSubmission (P2002 recovery, mirror Phase 4
 *     findOrCreateSession).
 *
 * `links` is a single textarea with newline-separated URLs — split + trim
 * + drop empties at the action edge. fileAttachmentIds stays empty until
 * the P6-3d deferred wiring + UI uploader lands.
 */

export type SubmitVersionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function submitVersionAction(
  _prev: SubmitVersionState,
  formData: FormData
): Promise<SubmitVersionState> {
  const session = await requireRole(["STUDENT"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!courseId || !assignmentId || !submissionId) {
    return { error: "missing_context_id" };
  }

  const textContent = String(formData.get("textContent") ?? "");
  const linksRaw = String(formData.get("links") ?? "");
  const links = linksRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    await submitVersion(
      {
        assignmentId,
        submissionId,
        textContent: textContent.trim() === "" ? undefined : textContent,
        fileAttachmentIds: [],
        links,
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

  revalidatePath(`/student/courses/${courseId}/assignments/${assignmentId}`);
  return { ok: true };
}
