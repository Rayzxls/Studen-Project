"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import {
  createScoreItem,
  deleteScoreItem,
  publishScoreItem,
} from "@/lib/scoring/score-item";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — ScoreItem create / publish / delete (Phase 5 · P5-4a + P5-4c)
 *
 * All actions follow Pattern 6 (hidden form fields, no `.bind()`) and
 * Pattern 8 (only async exports from a "use server" file).
 *
 * Pre-publish lifecycle is unaudited per ADR-0018 § Negative consequences.
 * Post-publish delete fires `SCORE_DELETE_AFTER_PUBLISH` (Critical tier,
 * reason ≥ 5). Publish itself fires `SCORE_ITEM_PUBLISHED` (Important tier)
 * after the `Σ === 10000` gate passes.
 */

export type CreateScoreItemState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function createScoreItemAction(
  _prev: CreateScoreItemState,
  formData: FormData
): Promise<CreateScoreItemState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const name = String(formData.get("name") ?? "");
  const fullScoreRaw = String(formData.get("fullScore") ?? "");
  const weightRaw = String(formData.get("weight") ?? ""); // basis points, integer
  const positionRaw = String(formData.get("position") ?? "0");

  if (!courseId) return { error: "missing_course_id" };

  const fullScore = Number.parseInt(fullScoreRaw, 10);
  const weight = Number.parseInt(weightRaw, 10);
  const position = Number.parseInt(positionRaw, 10) || 0;

  const fieldErrors: Record<string, string> = {};
  if (Number.isNaN(fullScore) || fullScore <= 0) {
    fieldErrors.fullScore = "ระบุคะแนนเต็มเป็นจำนวนเต็มบวก";
  }
  if (Number.isNaN(weight) || weight < 0 || weight > 10000) {
    fieldErrors.weight = "ระบุน้ำหนัก 0..100% (ทศนิยม 2 ตำแหน่ง)";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    await createScoreItem(
      { courseOfferingId: courseId, name, fullScore, weight, position },
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

  revalidatePath(`/teacher/courses/${courseId}/scores`);
  return { ok: true };
}

export type PublishScoreItemState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function publishScoreItemAction(
  _prev: PublishScoreItemState,
  formData: FormData
): Promise<PublishScoreItemState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const scoreItemId = String(formData.get("scoreItemId") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  if (!scoreItemId) return { error: "missing_score_item_id" };

  try {
    await publishScoreItem(scoreItemId, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/scores`);
  revalidatePath(`/teacher/courses/${courseId}/scores/${scoreItemId}`);
  return { ok: true };
}

export type DeleteScoreItemState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function deleteScoreItemAction(
  _prev: DeleteScoreItemState,
  formData: FormData
): Promise<DeleteScoreItemState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const scoreItemId = String(formData.get("scoreItemId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!courseId) return { error: "missing_course_id" };
  if (!scoreItemId) return { error: "missing_score_item_id" };

  try {
    await deleteScoreItem(scoreItemId, {
      actorUserId: session.user.id,
      reason: reason || null,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/scores`);
  return { ok: true };
}
