import {
  bangkokDateTimeToUtc,
  dayOfWeekForDateString,
  todayInBangkok,
} from "@/lib/attendance/format";
import { findOrCreateSession } from "@/lib/attendance/session";
import { db } from "@/lib/db/client";
import { choosePeriodForNow } from "@/lib/meeting/current-period";
import { joinRoom, openRoom } from "@/lib/meeting/room";

/**
 * One press: open the period's room and walk the teacher into it (ADR-0053).
 *
 * The teacher's intent when they reach for this is "start the class", not
 * "record that a class is starting". So the same press resolves the period,
 * creates the Session if today has not had one, opens the room, tells the
 * class, puts the teacher in the room's own occupant list, and answers with
 * where the class is — null when the stage carries it and there is nowhere
 * else to go.
 *
 * Every step is idempotent, so a double press is the same as one.
 */
export async function openRoomNow(params: {
  courseOfferingId: string;
  actorUserId: string;
  /** See openRoom — injectable so tests do not depend on the machine's .env. */
  stageAvailable?: boolean;
  /** Injectable clock for deterministic boundary tests. */
  now?: Date;
}): Promise<{ sessionId: string; meetingUrl: string | null }> {
  const sessionId = await resolveSessionForNow(
    params.courseOfferingId,
    params.actorUserId,
    params.now
  );

  await openRoom({
    sessionId,
    actorUserId: params.actorUserId,
    stageAvailable: params.stageAvailable,
  });

  // The teacher is in the room they just opened. Without this the rail shows
  // an empty room to the first student who arrives, which reads as "nobody is
  // here" at precisely the wrong moment.
  const { meetingUrl } = await joinRoom({
    sessionId,
    actorUserId: params.actorUserId,
    stageAvailable: params.stageAvailable,
  });

  return { sessionId, meetingUrl };
}

/**
 * The period a teacher means at this moment, created if today has not had one.
 *
 * Ownership is checked by findOrCreateSession and again by openRoom; the
 * timetable is read only to decide which period, never to decide who may.
 */
export async function resolveSessionForNow(
  courseOfferingId: string,
  actorUserId: string,
  now = new Date()
): Promise<string> {
  const dateStr = todayInBangkok(now);
  const slots = await db.timetableSlot.findMany({
    where: { courseOfferingId },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
  });

  const chosen = choosePeriodForNow(slots, {
    dayOfWeek: dayOfWeekForDateString(dateStr),
    timeStr: nowTimeInBangkok(now),
  });

  const scheduledEnd = bangkokDateTimeToUtc(dateStr, chosen.endTime);
  if (chosen.endDayOffset === 1) {
    scheduledEnd.setUTCDate(scheduledEnd.getUTCDate() + 1);
  }

  const created = await findOrCreateSession({
    courseOfferingId,
    scheduledStart: bangkokDateTimeToUtc(dateStr, chosen.startTime),
    scheduledEnd,
    timetableSlotId: chosen.timetableSlotId,
    actorUserId,
  });
  return created.id;
}

/** Current Bangkok wall clock as "HH:mm", the shape the timetable stores. */
function nowTimeInBangkok(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}
