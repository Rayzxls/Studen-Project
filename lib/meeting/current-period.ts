/**
 * Which period a teacher means when they press "open the room" (ADR-0053).
 *
 * Opening the room is the teacher's first action on a period, which is exactly
 * what materialises a Session. So the control does not ask which period: it
 * works out the obvious one and gets out of the way. A teacher who wants an
 * unusual period still has the existing "เปิดคาบ" form.
 *
 * Pure and clock-free — Bangkok wall-clock components come in as strings, the
 * same shape the timetable already stores, so the rule can be read and tested
 * without a timezone library.
 */

/** A teacher opening the room a few minutes early means this period. */
export const EARLY_LEAD_MINUTES = 15;

/** How long an unscheduled room lasts on paper. Closing is still manual. */
export const AD_HOC_MINUTES = 60;

export interface PeriodSlot {
  id: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string; // "HH:mm" Bangkok
  endTime: string; // "HH:mm" Bangkok
}

export interface ChosenPeriod {
  /** Null when nothing on the timetable fits and the period is ad-hoc. */
  timetableSlotId: string | null;
  startTime: string;
  endTime: string;
  /** Ad-hoc periods opened near midnight may finish on the following day. */
  endDayOffset: 0 | 1;
}

export function choosePeriodForNow(
  slots: readonly PeriodSlot[],
  now: { dayOfWeek: number; timeStr: string }
): ChosenPeriod {
  const today = slots.filter((slot) => slot.dayOfWeek === now.dayOfWeek);
  const nowMin = toMinutes(now.timeStr);

  const candidates = today
    .map((slot) => ({
      slot,
      start: toMinutes(slot.startTime),
      end: toMinutes(slot.endTime),
    }))
    // A malformed or inverted row is not a period; ignore rather than throw,
    // because a bad timetable row must not stop a class from starting.
    .filter(
      (row) => row.start !== null && row.end !== null && row.end > row.start
    )
    .filter(
      (row) =>
        nowMin !== null &&
        nowMin < (row.end as number) &&
        nowMin >= (row.start as number) - EARLY_LEAD_MINUTES
    );

  if (candidates.length > 0) {
    // Latest start wins. At 09:55 a period ending at 10:00 loses to one
    // beginning at 10:00: the teacher reaching for the button is starting the
    // next class, not reopening the one they are finishing.
    candidates.sort((a, b) => (b.start as number) - (a.start as number));
    const chosen = candidates[0];
    if (chosen) {
      return {
        timetableSlotId: chosen.slot.id,
        startTime: chosen.slot.startTime,
        endTime: chosen.slot.endTime,
        endDayOffset: 0,
      };
    }
  }

  const start = nowMin ?? 0;
  const end = start + AD_HOC_MINUTES;
  return {
    timetableSlotId: null,
    startTime: fromMinutes(start),
    endTime: fromMinutes(end % (24 * 60)),
    endDayOffset: end >= 24 * 60 ? 1 : 0,
  };
}

function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
