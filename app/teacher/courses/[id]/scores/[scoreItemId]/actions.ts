"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { bulkUpsertScoreEntries } from "@/lib/scoring/score-entry";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Action — submit the per-ScoreItem grid (Phase 5 · P5-4b).
 *
 * Pattern 6: courseId + scoreItemId arrive as hidden form fields. Each
 * student's value + note are sent as `value_<enrollmentId>` /
 * `note_<enrollmentId>` keys, so the action discovers the row set by
 * iterating FormData. Missing value keys → that enrollment is skipped
 * (not re-upserted to 0) — matches the "leave blank = don't touch"
 * cell semantic of a typed gradebook.
 *
 * Reason field is always present in the form but only enforced inside
 * `bulkUpsertScoreEntries` when `publishedAt !== null` AND there is at
 * least one real value change.
 */
export type SubmitGridState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
  upserted?: number;
  audited?: boolean;
};

export async function submitScoreGridAction(
  _prev: SubmitGridState,
  formData: FormData
): Promise<SubmitGridState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const scoreItemId = String(formData.get("scoreItemId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  if (!scoreItemId) return { error: "missing_score_item_id" };

  // Collect all value_<id> entries; pair with note_<id> if present.
  const items: { enrollmentId: string; value: number; note: string | null }[] =
    [];
  const fieldErrors: Record<string, string> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("value_")) continue;
    const enrollmentId = key.slice("value_".length);
    if (!enrollmentId) continue;
    const valueStr = String(raw).trim();
    if (valueStr === "") continue; // empty cell → skip (don't upsert to 0)
    const value = Number.parseInt(valueStr, 10);
    if (!Number.isInteger(value) || value < 0) {
      fieldErrors[`value_${enrollmentId}`] = "คะแนนต้องเป็นจำนวนเต็มไม่ติดลบ";
      continue;
    }
    const noteRaw = formData.get(`note_${enrollmentId}`);
    const note = noteRaw ? String(noteRaw) : null;
    items.push({ enrollmentId, value, note });
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (items.length === 0) {
    return { error: "no_changes" };
  }

  try {
    const result = await bulkUpsertScoreEntries({
      scoreItemId,
      items,
      actorUserId: session.user.id,
      reason: reason || null,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    revalidatePath(`/teacher/courses/${courseId}/scores`);
    revalidatePath(`/teacher/courses/${courseId}/scores/${scoreItemId}`);
    return { ok: true, upserted: result.upserted, audited: result.audited };
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
}
