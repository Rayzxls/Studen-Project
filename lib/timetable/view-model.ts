export const TIMETABLE_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const TIMETABLE_DAY_LABELS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
] as const;

export const TIMETABLE_DAY_SHORT_LABELS = [
  "อา.",
  "จ.",
  "อ.",
  "พ.",
  "พฤ.",
  "ศ.",
  "ส.",
] as const;

export type TimetableRole = "student" | "teacher";

export interface BangkokClock {
  dayOfWeek: number;
  minutes: number;
  timeLabel: string;
}

export interface TimetableDisplaySlot {
  id: string;
  courseId: string;
  courseName: string;
  subjectCode: string | null;
  className: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
  href: string;
}

export interface PositionedTimetableSlot extends TimetableDisplaySlot {
  startMinutes: number;
  endMinutes: number;
  lane: number;
}

export interface PositionedTimetableDay {
  slots: PositionedTimetableSlot[];
  laneCount: number;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function minutesToTime(value: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, value));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timetableBounds(slots: readonly TimetableDisplaySlot[]): {
  startMinutes: number;
  endMinutes: number;
} {
  if (slots.length === 0) {
    return { startMinutes: 8 * 60, endMinutes: 17 * 60 };
  }

  const earliest = Math.min(
    ...slots.map((slot) => timeToMinutes(slot.startTime))
  );
  const latest = Math.max(...slots.map((slot) => timeToMinutes(slot.endTime)));
  const startMinutes = Math.max(0, Math.floor(earliest / 60) * 60);
  const roundedEnd = Math.ceil(latest / 60) * 60;

  return {
    startMinutes,
    endMinutes: Math.min(24 * 60, Math.max(startMinutes + 60, roundedEnd)),
  };
}

/**
 * Assign each overlapping slot to its own visual lane. Cross-course overlaps
 * are valid in the domain, so the timetable must display them without blocks
 * covering one another.
 */
export function positionDaySlots(
  slots: readonly TimetableDisplaySlot[]
): PositionedTimetableDay {
  const sorted = [...slots]
    .map((slot) => ({
      ...slot,
      startMinutes: timeToMinutes(slot.startTime),
      endMinutes: timeToMinutes(slot.endTime),
    }))
    .sort(
      (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
    );
  const laneEnds: number[] = [];
  const positioned = sorted.map((slot) => {
    let lane = laneEnds.findIndex(
      (endMinutes) => endMinutes <= slot.startMinutes
    );
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = slot.endMinutes;
    return { ...slot, lane };
  });

  return {
    slots: positioned,
    laneCount: Math.max(1, laneEnds.length),
  };
}

export function visibleTimetableDays(
  slots: readonly TimetableDisplaySlot[]
): number[] {
  const occupied = new Set(slots.map((slot) => slot.dayOfWeek));
  return TIMETABLE_DAY_ORDER.filter(
    (day) => (day >= 1 && day <= 5) || occupied.has(day)
  );
}

/**
 * Suggest a one-hour slot for quick creation on a selected mobile day.
 * Prefer continuing after the day's last class, then scan from 08:00 in
 * 15-minute increments. The server remains authoritative for overlap checks.
 */
export function suggestTimetableSlot(
  slots: readonly Pick<
    TimetableDisplaySlot,
    "startTime" | "endTime" | "dayOfWeek"
  >[],
  dayOfWeek: number
): { dayOfWeek: number; startTime: string; endTime: string } {
  const daySlots = slots.filter((slot) => slot.dayOfWeek === dayOfWeek);
  const sorted = [...daySlots].sort((a, b) =>
    a.endTime.localeCompare(b.endTime)
  );
  const lastEnd = sorted.at(-1)?.endTime;
  const candidates: number[] = [];

  if (lastEnd) {
    candidates.push(Math.ceil(timeToMinutes(lastEnd) / 15) * 15);
  }
  for (let minute = 8 * 60; minute <= 23 * 60; minute += 15) {
    candidates.push(minute);
  }

  const startMinutes =
    candidates.find(
      (candidate) =>
        candidate + 60 <= 24 * 60 &&
        daySlots.every(
          (slot) =>
            candidate + 60 <= timeToMinutes(slot.startTime) ||
            timeToMinutes(slot.endTime) <= candidate
        )
    ) ?? 8 * 60;

  return {
    dayOfWeek,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(Math.min(startMinutes + 60, 23 * 60 + 55)),
  };
}

export function getNextTimetableSlot(
  slots: readonly TimetableDisplaySlot[],
  currentDay: number,
  currentMinutes: number
): { slot: TimetableDisplaySlot; distanceMinutes: number } | null {
  let next: { slot: TimetableDisplaySlot; distanceMinutes: number } | null =
    null;

  for (const slot of slots) {
    const startMinutes = timeToMinutes(slot.startTime);
    let dayDistance = (slot.dayOfWeek - currentDay + 7) % 7;
    if (dayDistance === 0 && startMinutes < currentMinutes) dayDistance = 7;
    const distanceMinutes =
      dayDistance * 24 * 60 + startMinutes - currentMinutes;
    if (!next || distanceMinutes < next.distanceMinutes) {
      next = { slot, distanceMinutes };
    }
  }

  return next;
}

export function getBangkokClock(date: Date): BangkokClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hours = Number(values.hour ?? 0);
  const minutes = Number(values.minute ?? 0);
  return {
    dayOfWeek: dayMap[values.weekday ?? "Mon"] ?? 1,
    minutes: hours * 60 + minutes,
    timeLabel: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

export function formatTimetableDistance(distanceMinutes: number): string {
  if (distanceMinutes < 60) return `อีก ${distanceMinutes} นาที`;
  if (distanceMinutes < 24 * 60) {
    const hours = Math.floor(distanceMinutes / 60);
    const minutes = distanceMinutes % 60;
    return minutes > 0
      ? `อีก ${hours} ชม. ${minutes} นาที`
      : `อีก ${hours} ชม.`;
  }
  const days = Math.floor(distanceMinutes / (24 * 60));
  return days === 1 ? "พรุ่งนี้" : `อีก ${days} วัน`;
}
