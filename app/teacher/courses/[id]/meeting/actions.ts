"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import { closeRoom, openRoom } from "@/lib/meeting/room";

/**
 * Server Actions — a teacher opening and closing the live online room
 * (ADR-0053).
 *
 * Both sit on top of idempotent lib calls, so a double-submitted form is
 * harmless: opening an open room returns the moment it opened rather than
 * restarting the clock, and closing a closed one is a no-op.
 *
 * Not audited, matching the rest of course configuration. Opening a room is
 * where a class happens, not a record of what a student did.
 */

export type RoomActionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function openRoomAction(
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
    await openRoom({ sessionId, actorUserId: session.user.id });
  } catch (err) {
    return toState(err);
  }

  // The students' Join control comes from the poll rather than this
  // revalidation; this is for the teacher's own page and the standing
  // reminder that a room is open.
  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher");
  return { ok: true };
}

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

function toState(err: unknown): RoomActionState {
  if (err instanceof ValidationError) {
    return { fieldErrors: err.errors };
  }
  if (err instanceof HttpError) {
    return { error: err.message };
  }
  throw err;
}
