"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import { applyModerationCaseAction } from "@/lib/moderation/service";

export type ModerationActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ACTIONS = new Set([
  "START_REVIEW",
  "HIDE",
  "QUARANTINE",
  "RESTORE",
  "RESOLVE",
  "DISMISS",
]);

export async function moderationCaseAction(
  _previous: ModerationActionState,
  formData: FormData
): Promise<ModerationActionState> {
  const session = await requireRole(["ADMIN"]);
  const caseId = String(formData.get("caseId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  const internalReason = String(formData.get("internalReason") ?? "");
  const userMessage = String(formData.get("userMessage") ?? "");
  const confirmed = formData.get("confirmed") === "yes";

  if (!caseId || !ACTIONS.has(action)) {
    return { error: "moderation_action_invalid" };
  }
  if (!confirmed) return { error: "moderation_confirmation_required" };

  try {
    await applyModerationCaseAction({
      actor: { userId: session.user.id, role: session.user.role },
      caseId,
      action: action as
        | "START_REVIEW"
        | "HIDE"
        | "QUARANTINE"
        | "RESTORE"
        | "RESOLVE"
        | "DISMISS",
      internalReason,
      userMessage,
    });
    revalidatePath("/admin/moderation");
    revalidatePath(`/admin/moderation/${caseId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.code, fieldErrors: error.errors };
    }
    if (error instanceof HttpError) return { error: error.code };
    throw error;
  }
}
