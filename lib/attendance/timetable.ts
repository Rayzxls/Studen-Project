import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { NOTE_MAX, TX_OPTS } from "./constants";

/**
 * TimetableSlot CRUD — Phase 4
 *
 * TimetableSlot is a recurring weekly template (DOW + time range). Editing
 * or deleting a slot does NOT propagate to existing Session rows — see
 * ADR-0015 § 4. No audit on slot CUD (Q11C decision: configuration mutation
 * with no student-data impact until a Session is materialized).
 *
 * Intra-course overlap is rejected at lib layer; the schema also enforces
 * exact-duplicate via `@@unique([courseOfferingId, dayOfWeek, startTime])`.
 * Cross-course overlap on the same teacher is silently allowed (Q4b).
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeString(t: string): boolean {
  return TIME_RE.test(t);
}

export function isValidDayOfWeek(d: number): boolean {
  return Number.isInteger(d) && d >= 0 && d <= 6;
}

/**
 * Pure overlap detector — given existing slots on a course and a candidate
 * (dayOfWeek + startTime + endTime), return the offending slot if the
 * candidate would create a time-range overlap on the same DOW. Exported
 * for unit tests; HH:mm strings compare lexicographically (fixed-width).
 *
 * Caller is responsible for filtering out the slot being updated when
 * checking edits (otherwise the slot will detect itself as overlapping).
 */
export function detectOverlap<
  T extends { dayOfWeek: number; startTime: string; endTime: string },
>(
  existing: readonly T[],
  candidate: { dayOfWeek: number; startTime: string; endTime: string }
): T | null {
  for (const e of existing) {
    if (e.dayOfWeek !== candidate.dayOfWeek) continue;
    if (candidate.startTime < e.endTime && e.startTime < candidate.endTime) {
      return e;
    }
  }
  return null;
}

function validateSlotInput(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string | null;
}): void {
  const errors: Record<string, string> = {};
  if (!isValidDayOfWeek(input.dayOfWeek)) {
    errors.dayOfWeek = "วันต้องเป็น 0..6 (อาทิตย์..เสาร์)";
  }
  if (!isValidTimeString(input.startTime)) {
    errors.startTime = "รูปแบบเวลาไม่ถูกต้อง (HH:mm)";
  }
  if (!isValidTimeString(input.endTime)) {
    errors.endTime = "รูปแบบเวลาไม่ถูกต้อง (HH:mm)";
  }
  if (
    isValidTimeString(input.startTime) &&
    isValidTimeString(input.endTime) &&
    input.startTime >= input.endTime
  ) {
    errors.endTime = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }
  if (input.location && input.location.length > NOTE_MAX) {
    errors.location = `สถานที่ยาวเกินไป (ไม่เกิน ${NOTE_MAX} ตัวอักษร)`;
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}

export async function createTimetableSlot(params: {
  courseOfferingId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string | null;
  actorUserId: string;
}): Promise<{
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
}> {
  validateSlotInput(params);
  const location = params.location?.trim() || null;

  return db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: params.courseOfferingId },
      select: { id: true, teacherId: true },
    });
    if (!course) throw new NotFound("course_not_found");
    if (course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const existing = await tx.timetableSlot.findMany({
      where: { courseOfferingId: course.id, dayOfWeek: params.dayOfWeek },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    });
    const overlap = detectOverlap(existing, {
      dayOfWeek: params.dayOfWeek,
      startTime: params.startTime,
      endTime: params.endTime,
    });
    if (overlap) throw new Conflict("slot_overlap");

    return tx.timetableSlot.create({
      data: {
        courseOfferingId: course.id,
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime,
        endTime: params.endTime,
        location,
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        location: true,
      },
    });
  }, TX_OPTS);
}

export async function updateTimetableSlot(params: {
  slotId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string | null;
  actorUserId: string;
}): Promise<{
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
}> {
  validateSlotInput(params);
  const location = params.location?.trim() || null;

  return db.$transaction(async (tx) => {
    const slot = await tx.timetableSlot.findUnique({
      where: { id: params.slotId },
      select: {
        id: true,
        courseOfferingId: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!slot) throw new NotFound("slot_not_found");
    if (slot.course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const siblings = await tx.timetableSlot.findMany({
      where: {
        courseOfferingId: slot.courseOfferingId,
        dayOfWeek: params.dayOfWeek,
        NOT: { id: slot.id },
      },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    });
    const overlap = detectOverlap(siblings, {
      dayOfWeek: params.dayOfWeek,
      startTime: params.startTime,
      endTime: params.endTime,
    });
    if (overlap) throw new Conflict("slot_overlap");

    return tx.timetableSlot.update({
      where: { id: slot.id },
      data: {
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime,
        endTime: params.endTime,
        location,
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        location: true,
      },
    });
  }, TX_OPTS);
}

export async function deleteTimetableSlot(params: {
  slotId: string;
  actorUserId: string;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const slot = await tx.timetableSlot.findUnique({
      where: { id: params.slotId },
      select: { id: true, course: { select: { teacherId: true } } },
    });
    if (!slot) throw new NotFound("slot_not_found");
    if (slot.course.teacherId !== params.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    await tx.timetableSlot.delete({ where: { id: slot.id } });
  }, TX_OPTS);
}

/** Read-only list — no authz; callers gate at action layer. */
export async function listTimetableSlots(courseOfferingId: string) {
  return db.timetableSlot.findMany({
    where: { courseOfferingId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      location: true,
    },
  });
}
