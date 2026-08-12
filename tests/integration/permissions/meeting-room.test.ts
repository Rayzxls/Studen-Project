import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { Forbidden, ValidationError } from "@/lib/errors";
import { setCourseMeetingUrl } from "@/lib/meeting/meeting-link";
import { openRoomNow } from "@/lib/meeting/open-now";
import {
  closeRoom,
  getRoomState,
  heartbeat,
  joinRoom,
  openRoom,
  openRoomsForTeacher,
} from "@/lib/meeting/room";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

const ROOM = "https://meet.google.com/abc-defg-hij";

/** A period the teacher has opened for attendance, with no online room yet. */
async function makeSession(): Promise<string> {
  const session = await db.session.create({
    data: {
      courseOfferingId: ctx.courseOfferingId,
      scheduledStart: new Date("2026-08-12T02:00:00.000Z"),
      scheduledEnd: new Date("2026-08-12T03:00:00.000Z"),
      createdById: ctx.teacherUserId,
    },
    select: { id: true },
  });
  return session.id;
}

async function withLink(): Promise<string> {
  const sessionId = await makeSession();
  await setCourseMeetingUrl({
    courseOfferingId: ctx.courseOfferingId,
    meetingUrl: ROOM,
    actorUserId: ctx.teacherUserId,
  });
  return sessionId;
}

describe("who may open and close the online room", () => {
  it("lets the owning teacher open it, and says when", async () => {
    const sessionId = await withLink();
    const opened = await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    expect(opened.openedAt).toBeInstanceOf(Date);
  });

  it("refuses a teacher who does not own the course", async () => {
    const sessionId = await withLink();
    await expect(
      openRoom({
        sessionId,
        actorUserId: ctx.otherTeacherUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("refuses an enrolled student — opening is not a student's to do", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await expect(
      openRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("refuses to open a room the course has no link for", async () => {
    // Otherwise the class is told to join somewhere that does not exist.
    const sessionId = await makeSession();
    await expect(
      openRoom({
        sessionId,
        actorUserId: ctx.teacherUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("is idempotent, so a double click does not restart the clock", async () => {
    const sessionId = await withLink();
    const first = await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    const second = await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    expect(second.openedAt.getTime()).toBe(first.openedAt.getTime());
  });

  it("only lets the owning teacher close it", async () => {
    const sessionId = await withLink();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    await expect(
      closeRoom({ sessionId, actorUserId: ctx.studentUserId })
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(
      closeRoom({ sessionId, actorUserId: ctx.otherTeacherUserId })
    ).rejects.toBeInstanceOf(Forbidden);

    await closeRoom({ sessionId, actorUserId: ctx.teacherUserId });
    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
    });
    expect(state.isOpen).toBe(false);
  });
});

describe("who may join, and what they get", () => {
  it("gives an active member the link", async () => {
    const sessionId = await withLink();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: false,
      })
    ).resolves.toEqual({ meetingUrl: ROOM });
  });

  it("refuses a student who is not enrolled in this course", async () => {
    const sessionId = await withLink();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.otherStudentUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("refuses a student who was removed from the course", async () => {
    // ADR-0052: a leaked meeting link is a stranger in a room with children,
    // so losing the course loses the room in the same breath.
    const sessionId = await withLink();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await db.enrollment.updateMany({
      where: {
        studentId: ctx.studentUserId, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
        courseOfferingId: ctx.courseOfferingId,
      },
      data: { removedAt: new Date() },
    });

    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("refuses to hand out a link before the teacher opens the room", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("stops handing it out once the room is closed", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await joinRoom({
      sessionId,
      actorUserId: ctx.studentUserId,
      stageAvailable: false,
    });
    await closeRoom({ sessionId, actorUserId: ctx.teacherUserId });

    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("writes no attendance record — ADR-0052 keeps that the teacher's", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await joinRoom({
      sessionId,
      actorUserId: ctx.studentUserId,
      stageAvailable: false,
    });

    await expect(
      db.attendanceRecord.count({ where: { sessionId } })
    ).resolves.toBe(0);
  });
});

describe("who may see who is in the room", () => {
  it("refuses a non-member entirely", async () => {
    await withLink();
    await expect(
      getRoomState({
        courseOfferingId: ctx.courseOfferingId,
        actorUserId: ctx.otherStudentUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("shows a joined student as active, and marks the teacher", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await joinRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await joinRoom({
      sessionId,
      actorUserId: ctx.studentUserId,
      stageAvailable: false,
    });

    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.studentUserId,
    });

    expect(state.isOpen).toBe(true);
    expect(state.meetingUrl).toBe(ROOM);
    const teacher = state.participants.find(
      (p) => p.userId === ctx.teacherUserId
    );
    const student = state.participants.find(
      (p) => p.userId === ctx.studentUserId
    );
    expect(teacher?.isTeacher).toBe(true);
    expect(student?.isTeacher).toBe(false);
    expect(student?.state).toBe("ACTIVE");
  });

  it("drops someone whose tab stopped reporting", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await joinRoom({
      sessionId,
      actorUserId: ctx.studentUserId,
      stageAvailable: false,
    });

    // No sweeper runs; the row simply ages out of the rail.
    const later = new Date(Date.now() + 10 * 60_000);
    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      now: later,
    });
    expect(state.participants).toHaveLength(0);
  });

  it("turns the dot hollow when a heartbeat says the tab is not frontmost", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await joinRoom({
      sessionId,
      actorUserId: ctx.studentUserId,
      stageAvailable: false,
    });

    const later = new Date(Date.now() + 60_000);
    await heartbeat({
      sessionId,
      actorUserId: ctx.studentUserId,
      focused: false,
      now: later,
    });

    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      now: later,
    });
    expect(
      state.participants.find((p) => p.userId === ctx.studentUserId)?.state
    ).toBe("IDLE");
  });

  it("refuses a heartbeat from someone who is not in the course", async () => {
    const sessionId = await withLink();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await expect(
      heartbeat({
        sessionId,
        actorUserId: ctx.otherStudentUserId,
        focused: true,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("the reminder that a room is still open", () => {
  it("lists the teacher's own open rooms and forgets them once closed", async () => {
    const sessionId = await withLink();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    await expect(
      openRoomsForTeacher({ teacherUserId: ctx.teacherUserId })
    ).resolves.toHaveLength(1);

    // Another teacher must not be nagged about a room that is not theirs.
    await expect(
      openRoomsForTeacher({ teacherUserId: ctx.otherTeacherUserId })
    ).resolves.toHaveLength(0);

    await closeRoom({ sessionId, actorUserId: ctx.teacherUserId });
    await expect(
      openRoomsForTeacher({ teacherUserId: ctx.teacherUserId })
    ).resolves.toHaveLength(0);
  });
});

describe("telling the class the room is open", () => {
  it("notifies every active member once, and not the teacher", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    const rows = await db.notification.findMany({
      where: { kind: "MEETING_ROOM_OPENED", sourceEntityId: sessionId },
      select: { recipientId: true, courseOfferingId: true, payloadJson: true },
    });

    expect(rows.map((r) => r.recipientId)).toEqual([ctx.studentUserId]);
    expect(rows[0]?.courseOfferingId).toBe(ctx.courseOfferingId);
  });

  it("carries no meeting link in the payload", async () => {
    // A bell row is read over a shoulder as readily as a lock screen, and the
    // link is the room. ADR-0047 allows the course name and the kind of event.
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    const row = await db.notification.findFirstOrThrow({
      where: { kind: "MEETING_ROOM_OPENED", sourceEntityId: sessionId },
      select: { payloadJson: true },
    });
    expect(JSON.stringify(row.payloadJson)).not.toContain("meet.google.com");
    expect(JSON.stringify(row.payloadJson)).not.toContain("meetingUrl");
  });

  it("does not tell the class twice when the teacher double-clicks", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    await expect(
      db.notification.count({
        where: { kind: "MEETING_ROOM_OPENED", sourceEntityId: sessionId },
      })
    ).resolves.toBe(1);
  });

  it("tells them again when a room is genuinely reopened after closing", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    await closeRoom({ sessionId, actorUserId: ctx.teacherUserId });
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    await expect(
      db.notification.count({
        where: { kind: "MEETING_ROOM_OPENED", sourceEntityId: sessionId },
      })
    ).resolves.toBe(2);
  });

  it("does not notify a student who was removed from the course", async () => {
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await db.enrollment.updateMany({
      where: {
        studentId: ctx.studentUserId, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
        courseOfferingId: ctx.courseOfferingId,
      },
      data: { removedAt: new Date() },
    });
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    await expect(
      db.notification.count({
        where: { kind: "MEETING_ROOM_OPENED", sourceEntityId: sessionId },
      })
    ).resolves.toBe(0);
  });
});

describe("starting a class in one press", () => {
  it("creates the period, opens the room, and hands back the link", async () => {
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: ROOM,
      actorUserId: ctx.teacherUserId,
    });

    const opened = await openRoomNow({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    expect(opened.meetingUrl).toBe(ROOM);
    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
    });
    expect(state.isOpen).toBe(true);
    expect(state.sessionId).toBe(opened.sessionId);
  });

  it("puts the teacher in the room they just opened", async () => {
    // Otherwise the first student to arrive sees an empty rail, which reads as
    // "nobody is here" at exactly the wrong moment.
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: ROOM,
      actorUserId: ctx.teacherUserId,
    });
    await openRoomNow({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
    });
    const teacher = state.participants.find(
      (p) => p.userId === ctx.teacherUserId
    );
    expect(teacher?.isTeacher).toBe(true);
    expect(teacher?.state).toBe("ACTIVE");
  });

  it("lands on the same period when pressed twice", async () => {
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: ROOM,
      actorUserId: ctx.teacherUserId,
    });
    // Someone has to be enrolled for the count below to mean anything: fan-out
    // writes a row per active enrolment, so an empty course notifies nobody.
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    const first = await openRoomNow({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });
    const second = await openRoomNow({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: false,
    });

    expect(second.sessionId).toBe(first.sessionId);
    await expect(
      db.notification.count({
        where: { kind: "MEETING_ROOM_OPENED", sourceEntityId: first.sessionId },
      })
    ).resolves.toBe(1);
  });

  it("refuses a teacher who does not own the course", async () => {
    await setCourseMeetingUrl({
      courseOfferingId: ctx.courseOfferingId,
      meetingUrl: ROOM,
      actorUserId: ctx.teacherUserId,
    });
    await expect(
      openRoomNow({
        courseOfferingId: ctx.courseOfferingId,
        actorUserId: ctx.otherTeacherUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("refuses when the course has no link, before creating anything", async () => {
    await expect(
      openRoomNow({
        courseOfferingId: ctx.courseOfferingId,
        actorUserId: ctx.teacherUserId,
        stageAvailable: false,
      })
    ).rejects.toBeInstanceOf(ValidationError);

    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
    });
    expect(state.isOpen).toBe(false);
  });
});

describe("with a stage of our own", () => {
  it("opens a room for a course that has no link at all", async () => {
    // The room is the product now. Requiring an outside link would be asking
    // a teacher to configure plumbing the class no longer uses.
    const sessionId = await makeSession();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: true,
    });

    const state = await getRoomState({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.studentUserId,
    });
    expect(state.isOpen).toBe(true);
  });

  it("sends nobody anywhere — the room they are looking at is the room", async () => {
    const sessionId = await makeSession();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: true,
    });

    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: true,
      })
    ).resolves.toEqual({ meetingUrl: null });
  });

  it("prefers the stage over a link the course still has", async () => {
    // Staying in the app beats bouncing to a second tab.
    const sessionId = await withLink();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: true,
    });

    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.studentUserId,
        stageAvailable: true,
      })
    ).resolves.toEqual({ meetingUrl: null });
  });

  it("still refuses someone who is not in the course", async () => {
    const sessionId = await makeSession();
    await openRoom({
      sessionId,
      actorUserId: ctx.teacherUserId,
      stageAvailable: true,
    });
    await expect(
      joinRoom({
        sessionId,
        actorUserId: ctx.otherStudentUserId,
        stageAvailable: true,
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});
