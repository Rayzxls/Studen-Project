"use server";

import { revalidatePath } from "next/cache";

import {
  bangkokDateTimeToUtc,
  dayOfWeekForDateString,
  todayInBangkok,
} from "@/lib/attendance/format";
import { findOrCreateSession } from "@/lib/attendance/session";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { HttpError, ValidationError } from "@/lib/errors";
import { choosePeriodForNow } from "@/lib/meeting/current-period";
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

/**
 * One press, no period picker.
 *
 * Opening the room is the teacher's first action on a period, which is exactly
 * what materialises a Session — so this resolves the obvious period and
 * creates it if it does not exist yet, rather than making a teacher fill in a
 * form while a class waits. The existing "เปิดคาบ" form still covers anything
 * unusual.
 *
 * findOrCreateSession is idempotent and race-safe through the
 * (courseOfferingId, scheduledStart) unique key, so a double press lands on the
 * same period.
 */
export async function openRoomAction(
  _prev: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const session = await requireRole(["TEACHER"]);
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { fieldErrors: { room: "ไม่พบรายวิชา" } };

  try {
    const sessionId =
      String(formData.get("sessionId") ?? "") ||
      (await resolveSessionForNow(courseId, session.user.id));

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

/**
 * The period a teacher means at this moment, created if today has not had one.
 *
 * Ownership is checked by findOrCreateSession and again by openRoom; this
 * function reads the timetable only to decide which period, never to decide
 * who may.
 */
async function resolveSessionForNow(
  courseOfferingId: string,
  actorUserId: string
): Promise<string> {
  const dateStr = todayInBangkok();
  const slots = await db.timetableSlot.findMany({
    where: { courseOfferingId },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
  });

  const chosen = choosePeriodForNow(slots, {
    dayOfWeek: dayOfWeekForDateString(dateStr),
    timeStr: nowTimeInBangkok(),
  });

  const created = await findOrCreateSession({
    courseOfferingId,
    scheduledStart: bangkokDateTimeToUtc(dateStr, chosen.startTime),
    scheduledEnd: bangkokDateTimeToUtc(dateStr, chosen.endTime),
    timetableSlotId: chosen.timetableSlotId,
    actorUserId,
  });
  return created.id;
}

/** Current Bangkok wall clock as "HH:mm", the shape the timetable stores. */
function nowTimeInBangkok(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
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
