"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { createAssignment } from "@/lib/assignment/assignment";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Assignment list page (Phase 6 · P6-5a).
 *
 * Pattern 6 (hidden form fields, no `.bind()`) + Pattern 8 (`"use server"`
 * = async exports only). createAssignment lib lives in lib/assignment/assignment.ts
 * and handles the ADR-0019 atomic ScoreItem coupling.
 */

export type CreateAssignmentState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function createAssignmentAction(
  _prev: CreateAssignmentState,
  formData: FormData
): Promise<CreateAssignmentState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "missing_course_id" };

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const dueAtStr = String(formData.get("dueAt") ?? "");
  const allowText = formData.get("allowText") === "on";
  const allowFile = formData.get("allowFile") === "on";
  const allowLink = formData.get("allowLink") === "on";
  const autoCloseAtDue = formData.get("autoCloseAtDue") === "on";
  const isScored = formData.get("isScored") === "on";
  const weightPctRaw = String(formData.get("weightPct") ?? "");
  const fullScoreRaw = String(formData.get("fullScore") ?? "");

  // % → basis points conversion at the edge (Pattern from Phase 5 ADR-0017).
  let weightBp: number | undefined;
  let fullScore: number | undefined;
  if (isScored) {
    const pct = Number.parseFloat(weightPctRaw);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return { fieldErrors: { weightPct: "ระบุน้ำหนัก 0.01–100%" } };
    }
    weightBp = Math.round(pct * 100);
    fullScore = Number.parseInt(fullScoreRaw, 10);
    if (!Number.isInteger(fullScore) || fullScore <= 0) {
      return { fieldErrors: { fullScore: "ระบุคะแนนเต็มเป็นจำนวนเต็มบวก" } };
    }
  }

  try {
    await createAssignment(
      {
        courseOfferingId: courseId,
        title,
        description,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
        allowText,
        allowFile,
        allowLink,
        submissionClosed: false,
        autoCloseAtDue,
        isScored,
        weight: weightBp,
        fullScore,
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

  revalidatePath(`/teacher/courses/${courseId}/assignments`);
  return { ok: true };
}
