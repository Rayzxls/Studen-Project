"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import { closeRoom } from "@/lib/meeting/room";

/**
 * Server Actions — a teacher closing the live online room (ADR-0053).
 *
 * Opening does not live here. It ends with the teacher walking into Meet, and
 * a tab opened after an awaited Server Action is a blocked popup, so opening is
 * POST /api/meeting/course/[courseId]/open instead.
 *
 * Closing is idempotent, so a double-submitted form is a no-op.
 *
 * Not audited, matching the rest of course configuration. Opening or closing a
 * room is where a class happens, not a record of what a student did.
 */

export type RoomActionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function closeRoomAction(
  _prev: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!sessionId) {
    return { fieldErrors: { room: "ยังไม่ได้เลือกคาบเรียน" } };
  }

  try {
    await closeRoom({ sessionId, actorUserId: session.user.id });
  } catch (err) {
    return toState(err);
  }

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher");
  return { ok: true };
}

/**
 * Closing from a plain form, for callers that are not driving a useActionState
 * hook — the standing reminder in the top bar is a Server Component and has no
 * hook to hold a result. A failure there is silent by design: the reminder is
 * still on screen with the button still on it, which is the same affordance a
 * retry needs.
 */
export async function closeRoomFormAction(formData: FormData): Promise<void> {
  await closeRoomAction({}, formData);
}

function toState(err: unknown): RoomActionState {
  if (err instanceof ValidationError) {
    return { fieldErrors: err.errors };
  }
  if (err instanceof HttpError) {
    return { error: err.message };
  }
  throw err;
}
