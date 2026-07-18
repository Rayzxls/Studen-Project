import { describe, expect, it } from "vitest";
import {
  getNextTimetableSlot,
  positionDaySlots,
  suggestTimetableSlot,
  timetableBounds,
  type TimetableDisplaySlot,
} from "@/lib/timetable/view-model";

function slot(
  id: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string
): TimetableDisplaySlot {
  return {
    id,
    courseId: `course-${id}`,
    courseName: `Course ${id}`,
    subjectCode: null,
    className: "ม.4/1",
    classId: `class-${id}`,
    dayOfWeek,
    startTime,
    endTime,
    location: null,
    href: `/courses/${id}`,
  };
}

describe("timetable view model", () => {
  it("rounds the visible bounds to whole hours", () => {
    expect(
      timetableBounds([
        slot("a", 1, "08:15", "09:30"),
        slot("b", 2, "13:00", "14:10"),
      ])
    ).toEqual({ startMinutes: 8 * 60, endMinutes: 15 * 60 });
  });

  it("places overlapping courses in separate lanes", () => {
    const result = positionDaySlots([
      slot("a", 1, "08:00", "10:00"),
      slot("b", 1, "09:00", "11:00"),
      slot("c", 1, "11:00", "12:00"),
    ]);

    expect(result.laneCount).toBe(2);
    expect(result.slots.map((item) => [item.id, item.lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("wraps the next recurring slot to the following week", () => {
    const monday = slot("monday", 1, "08:00", "09:00");
    const result = getNextTimetableSlot([monday], 1, 9 * 60);
    expect(result?.slot.id).toBe("monday");
    expect(result?.distanceMinutes).toBe(6 * 24 * 60 + 23 * 60);
  });

  it("suggests a default morning slot on an empty day", () => {
    expect(suggestTimetableSlot([], 3)).toEqual({
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "09:00",
    });
  });

  it("prefers the hour immediately after the final class", () => {
    expect(
      suggestTimetableSlot(
        [slot("a", 1, "08:00", "09:00"), slot("b", 1, "10:15", "11:15")],
        1
      )
    ).toEqual({
      dayOfWeek: 1,
      startTime: "11:15",
      endTime: "12:15",
    });
  });

  it("falls back to an earlier gap when the final class ends too late", () => {
    expect(
      suggestTimetableSlot(
        [slot("a", 5, "07:00", "08:00"), slot("b", 5, "22:30", "23:45")],
        5
      )
    ).toEqual({
      dayOfWeek: 5,
      startTime: "08:00",
      endTime: "09:00",
    });
  });
});
