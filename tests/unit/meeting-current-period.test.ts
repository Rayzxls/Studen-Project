// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  AD_HOC_MINUTES,
  choosePeriodForNow,
  EARLY_LEAD_MINUTES,
  type PeriodSlot,
} from "@/lib/meeting/current-period";

const MONDAY = 1;
const TUESDAY = 2;

const lecture: PeriodSlot = {
  id: "lecture",
  dayOfWeek: MONDAY,
  startTime: "09:00",
  endTime: "10:00",
};
const lab: PeriodSlot = {
  id: "lab",
  dayOfWeek: MONDAY,
  startTime: "13:00",
  endTime: "15:00",
};

describe("which period the teacher means", () => {
  it("picks the period that is running right now", () => {
    expect(
      choosePeriodForNow([lecture, lab], {
        dayOfWeek: MONDAY,
        timeStr: "09:30",
      })
    ).toEqual({
      timetableSlotId: "lecture",
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("picks a period that starts shortly, because teachers open the room early", () => {
    expect(
      choosePeriodForNow([lecture], { dayOfWeek: MONDAY, timeStr: "08:50" })
    ).toEqual({
      timetableSlotId: "lecture",
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("does not reach for a period that is still further off", () => {
    const chosen = choosePeriodForNow([lecture], {
      dayOfWeek: MONDAY,
      timeStr: "08:00",
    });
    expect(chosen.timetableSlotId).toBeNull();
  });

  it("stops claiming a period the moment it ends", () => {
    const chosen = choosePeriodForNow([lecture], {
      dayOfWeek: MONDAY,
      timeStr: "10:00",
    });
    expect(chosen.timetableSlotId).toBeNull();
  });

  it("ignores periods on other days", () => {
    const chosen = choosePeriodForNow([lecture, lab], {
      dayOfWeek: TUESDAY,
      timeStr: "09:30",
    });
    expect(chosen.timetableSlotId).toBeNull();
  });

  it("takes the period that started most recently when two overlap", () => {
    // A double period runs ten minutes into the lab. Both are live at 13:05,
    // and the one that just began is the class the teacher is starting.
    const overrunning: PeriodSlot = {
      id: "overrunning",
      dayOfWeek: MONDAY,
      startTime: "12:00",
      endTime: "13:10",
    };
    const chosen = choosePeriodForNow([overrunning, lab], {
      dayOfWeek: MONDAY,
      timeStr: "13:05",
    });
    expect(chosen.timetableSlotId).toBe("lab");
  });

  it("falls back to an hour from now when nothing on the timetable fits", () => {
    expect(
      choosePeriodForNow([], { dayOfWeek: MONDAY, timeStr: "20:15" })
    ).toEqual({ timetableSlotId: null, startTime: "20:15", endTime: "21:15" });
  });

  it("does not run an ad-hoc period past midnight", () => {
    const chosen = choosePeriodForNow([], {
      dayOfWeek: MONDAY,
      timeStr: "23:30",
    });
    expect(chosen.endTime).toBe("23:59");
  });

  it("ignores a malformed timetable row rather than refusing to open", () => {
    // A bad row must never be the reason a class cannot start.
    const broken: PeriodSlot = {
      id: "broken",
      dayOfWeek: MONDAY,
      startTime: "9:00",
      endTime: "??",
    };
    const chosen = choosePeriodForNow([broken, lecture], {
      dayOfWeek: MONDAY,
      timeStr: "09:30",
    });
    expect(chosen.timetableSlotId).toBe("lecture");
  });

  it("ignores a row whose end is not after its start", () => {
    const inverted: PeriodSlot = {
      id: "inverted",
      dayOfWeek: MONDAY,
      startTime: "09:00",
      endTime: "09:00",
    };
    const chosen = choosePeriodForNow([inverted], {
      dayOfWeek: MONDAY,
      timeStr: "09:00",
    });
    expect(chosen.timetableSlotId).toBeNull();
  });

  it("keeps its two thresholds where the interface promises them", () => {
    expect(EARLY_LEAD_MINUTES).toBe(15);
    expect(AD_HOC_MINUTES).toBe(60);
  });
});
