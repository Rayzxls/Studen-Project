"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import {
  publishScheduledNow,
  reschedulePublishAt,
} from "@/lib/publishing/reschedule";
import type { ScheduledContentKind } from "@/lib/publishing/schedule";
import { readPublishAt } from "@/lib/publishing/validation";

/**
 * Publishing schedule Server Actions — moving a post that has not gone live.
 *
 * Ownership lives in the service, not here: the action forwards the session
 * user and the service refuses anyone who does not own the course, so a forged
 * id in the form buys nothing.
 */

export type RescheduleState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

const KINDS: readonly ScheduledContentKind[] = [
  "ANNOUNCEMENT",
  "MATERIAL",
  "ASSIGNMENT",
];

function readKind(raw: FormDataEntryValue | null): ScheduledContentKind | null {
  return KINDS.find((kind) => kind === raw) ?? null;
}

export async function reschedulePublishingAction(
  _prev: RescheduleState,
  formData: FormData
): Promise<RescheduleState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = String(formData.get("courseId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const kind = readKind(formData.get("kind"));
  if (!courseId || !itemId || !kind) return { error: "missing_ids" };

  const publishAt = readPublishAt(formData.get("publishAt"));
  if (!publishAt) {
    return { fieldErrors: { publishAt: "เลือกวันและเวลาที่จะเผยแพร่" } };
  }

  try {
    await reschedulePublishAt(kind, itemId, publishAt, {
      actorUserId: session.user.id,
    });
  } catch (err) {
    return toState(err);
  }

  revalidatePaths(courseId);
  return { ok: true };
}

export async function publishNowAction(
  _prev: RescheduleState,
  formData: FormData
): Promise<RescheduleState> {
  const session = await requireRole(["TEACHER"]);

  const courseId = String(formData.get("courseId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const kind = readKind(formData.get("kind"));
  if (!courseId || !itemId || !kind) return { error: "missing_ids" };

  try {
    await publishScheduledNow(kind, itemId, { actorUserId: session.user.id });
  } catch (err) {
    return toState(err);
  }

  revalidatePaths(courseId);
  return { ok: true };
}

/** Both the teacher's own surfaces and the class feed change the moment a
 *  publish time moves, so neither may serve a cached answer afterwards. */
function revalidatePaths(courseId: string): void {
  revalidatePath(`/teacher/courses/${courseId}/schedule`);
  revalidatePath(`/teacher/courses/${courseId}/feed`);
  revalidatePath(`/student/courses/${courseId}/feed`);
}

function toState(err: unknown): RescheduleState {
  if (err instanceof ValidationError) return { fieldErrors: err.errors };
  if (err instanceof HttpError) return { error: err.message };
  throw err;
}
