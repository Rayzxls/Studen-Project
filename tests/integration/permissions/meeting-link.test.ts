import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTimetableSlot,
  updateTimetableSlot,
} from "@/lib/attendance/timetable";
import { db } from "@/lib/db/client";
import { Forbidden, ValidationError } from "@/lib/errors";
import { setCourseMeetingUrl } from "@/lib/meeting/meeting-link";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

const ROOM = "https://meet.google.com/abc-defg-hij";
const LAB = "https://meet.google.com/lab-room-xyz";

describe("the course's standing online room", () => {
  it("saves a link and clears it again", async () => {
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: ROOM,
      actorUserId: ctx.teacherUserId,
    });
    await expect(
      db.courseOffering.findUniqueOrThrow({
        where: { id: ctx.courseOfferingId },
        select: { meetingUrl: true },
      })
    ).resolves.toEqual({ meetingUrl: ROOM });

    // Blank is how a teacher removes it, not an error.
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: "",
      actorUserId: ctx.teacherUserId,
    });
    await expect(
      db.courseOffering.findUniqueOrThrow({
        where: { id: ctx.courseOfferingId },
        select: { meetingUrl: true },
      })
    ).resolves.toEqual({ meetingUrl: null });
  });

  it("refuses a teacher who does not own the course", async () => {
    await expect(
      setCourseMeetingUrl({
        courseOfferingId: ctx.courseOfferingId,
        meetingUrl: ROOM,
        actorUserId: ctx.otherTeacherUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("refuses a link that is not https", async () => {
    await expect(
      setCourseMeetingUrl({
        courseOfferingId: ctx.courseOfferingId,
        meetingUrl: "http://meet.google.com/abc",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("a period that meets somewhere else", () => {
  it("keeps its own link separate from the course link", async () => {
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: ROOM,
      actorUserId: ctx.teacherUserId,
    });

    const slot = await createTimetableSlot({
      courseOfferingId: ctx.courseOfferingId,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
      meetingUrl: LAB,
      actorUserId: ctx.teacherUserId,
    });
    expect(slot.meetingUrl).toBe(LAB);

    // Clearing the override sends the period back to the course link, which is
    // resolved at read time rather than copied here.
    const cleared = await updateTimetableSlot({
      slotId: slot.id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
      meetingUrl: "",
      actorUserId: ctx.teacherUserId,
    });
    expect(cleared.meetingUrl).toBeNull();
  });

  it("refuses a slot link that is not https", async () => {
    await expect(
      createTimetableSlot({
        courseOfferingId: ctx.courseOfferingId,
        dayOfWeek: 2,
        startTime: "10:00",
        endTime: "11:00",
        meetingUrl: "ftp://example.com/room",
        actorUserId: ctx.teacherUserId,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
