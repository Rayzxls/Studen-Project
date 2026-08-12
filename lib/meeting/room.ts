import { db } from "@/lib/db/client";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { derivePresenceState, presentInRoom } from "@/lib/meeting/presence";
import { resolveMeetingLink } from "@/lib/meeting/resolve";
import { fanOutBroadcast } from "@/lib/notification";
import { sendCoursePush } from "@/lib/notification/push";

/**
 * Opening, closing and occupying the live online room (ADR-0053).
 *
 * The room is ours; the meeting is not. Nothing here talks to Meet — it records
 * that a teacher declared a period open, tells the room who is looking at it,
 * and hands out the link the course already had.
 *
 * Not audited, matching `setCourseMeetingUrl` and timetable CRUD: opening a
 * room is where a class happens, not a record of what a student did. The one
 * thing in this file that touches a student's record is nothing at all —
 * ADR-0052's rule that only a teacher writes an AttendanceRecord is why
 * `joinRoom` writes to MeetingPresence and stops there.
 */

export interface RoomParticipant {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  profileImageId: string | null;
  isTeacher: boolean;
  state: "ACTIVE" | "IDLE" | "AWAY";
}

export interface RoomState {
  sessionId: string | null;
  isOpen: boolean;
  openedAt: Date | null;
  /** Absent unless the room is open — there is nowhere to go when it is not. */
  meetingUrl: string | null;
  /**
   * Whether opening a room would find a link at all — the fact, never the URL.
   * Lets the teacher's control say "set a link first" instead of offering a
   * button whose only outcome is an error.
   */
  hasMeetingLink: boolean;
  participants: RoomParticipant[];
}

/** Teacher declares the period's online room open. Idempotent. */
export async function openRoom(params: {
  sessionId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ sessionId: string; openedAt: Date }> {
  const now = params.now ?? new Date();
  const session = await loadSessionForTeacher(
    params.sessionId,
    params.actorUserId
  );

  if (session.cancelledAt !== null) {
    throw new ValidationError({ room: "คาบนี้ถูกยกเลิกไปแล้ว" });
  }

  // A room with no link is a Join button that goes nowhere. Refuse rather than
  // let a teacher announce a class the students cannot reach.
  const link = resolveMeetingLink({
    slotMeetingUrl: session.timetableSlot?.meetingUrl ?? null,
    courseMeetingUrl: session.course.meetingUrl,
  });
  if (!link) {
    throw new ValidationError({
      room: "ยังไม่ได้ตั้งลิงก์ห้องเรียนออนไลน์ของวิชานี้",
    });
  }

  // Already open: say when, and tell nobody. A second click is a slip, and a
  // class does not need telling twice about the same room.
  if (session.roomOpenedAt !== null && session.roomClosedAt === null) {
    return { sessionId: session.id, openedAt: session.roomOpenedAt };
  }

  const opened = await db.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id: session.id },
      // Reopening clears the previous close, so the pair always describes the
      // current interval rather than a mix of two.
      data: { roomOpenedAt: now, roomClosedAt: null },
      select: { id: true, roomOpenedAt: true },
    });

    await fanOutBroadcast(tx, {
      kind: "MEETING_ROOM_OPENED",
      sourceEntityType: "SESSION",
      sourceEntityId: updated.id,
      courseOfferingId: session.course.id,
      // No meetingUrl in the payload. The bell is read over a shoulder as
      // readily as a lock screen, and the link is the room itself.
      payload: { courseId: session.course.id, courseName: session.course.name },
    });

    return updated;
  });

  // Third-party delivery stays outside the transaction, matching Materials and
  // Assignments: a push that fails must not roll back an opened room.
  await sendCoursePush(session.course.id, {
    title: session.course.name,
    body: "ครูเปิดห้องเรียนออนไลน์แล้ว",
    url: `/student/courses/${session.course.id}`,
    tag: `meeting-room:${opened.id}`,
  });

  return { sessionId: opened.id, openedAt: opened.roomOpenedAt ?? now };
}

/**
 * Teacher closes the room. Idempotent.
 *
 * Nothing closes it automatically — the owner chose that, so that a lesson
 * running long is never cut off by a clock. Presence rows are left where they
 * are: they decay into "left" on their own and are the only trace that the
 * period had anyone in it.
 */
export async function closeRoom(params: {
  sessionId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ sessionId: string; closedAt: Date }> {
  const now = params.now ?? new Date();
  const session = await loadSessionForTeacher(
    params.sessionId,
    params.actorUserId
  );

  if (session.roomOpenedAt === null || session.roomClosedAt !== null) {
    return { sessionId: session.id, closedAt: session.roomClosedAt ?? now };
  }

  const updated = await db.session.update({
    where: { id: session.id },
    data: { roomClosedAt: now },
    select: { id: true, roomClosedAt: true },
  });
  return { sessionId: updated.id, closedAt: updated.roomClosedAt ?? now };
}

/**
 * Records that someone pressed Join, and returns where to go.
 *
 * A press is not attendance. The student leaves for Meet and nothing comes
 * back, so this row means "asked for the link", which is exactly as much as
 * the interface is allowed to claim.
 */
export async function joinRoom(params: {
  sessionId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ meetingUrl: string }> {
  const now = params.now ?? new Date();
  const session = await loadSessionForMember(
    params.sessionId,
    params.actorUserId
  );

  if (session.roomOpenedAt === null || session.roomClosedAt !== null) {
    throw new ValidationError({ room: "ห้องเรียนออนไลน์ยังไม่เปิด" });
  }

  const link = resolveMeetingLink({
    slotMeetingUrl: session.timetableSlot?.meetingUrl ?? null,
    courseMeetingUrl: session.course.meetingUrl,
  });
  if (!link) throw new ValidationError({ room: "ไม่พบลิงก์ห้องเรียนออนไลน์" });

  await db.meetingPresence.upsert({
    where: {
      sessionId_userId: { sessionId: session.id, userId: params.actorUserId },
    },
    create: {
      sessionId: session.id,
      userId: params.actorUserId,
      lastSeenAt: now,
      lastActiveAt: now,
    },
    // Rejoining after leaving reuses the row; joinedAt keeps the first arrival.
    update: { lastSeenAt: now, lastActiveAt: now },
  });

  return { meetingUrl: link.url };
}

/**
 * A tab reporting that it is still there.
 *
 * `focused` is the whole difference between the green dot and the hollow one.
 * An unfocused tab still beats, which is what lets the room tell "switched
 * away" apart from "closed the laptop".
 */
export async function heartbeat(params: {
  sessionId: string;
  actorUserId: string;
  focused: boolean;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  await loadSessionForMember(params.sessionId, params.actorUserId);

  await db.meetingPresence.updateMany({
    where: { sessionId: params.sessionId, userId: params.actorUserId },
    data: params.focused
      ? { lastSeenAt: now, lastActiveAt: now }
      : { lastSeenAt: now },
  });
}

/**
 * What the poll returns: whether this course has a room open, and who is in it.
 *
 * Reads the newest opened session rather than "today's", because a room opened
 * at 23:50 is still the room at 00:05 and a date boundary is not a lesson
 * boundary.
 */
export async function getRoomState(params: {
  courseOfferingId: string;
  actorUserId: string;
  now?: Date;
}): Promise<RoomState> {
  const now = params.now ?? new Date();
  const course = await db.courseOffering.findUnique({
    where: { id: params.courseOfferingId },
    select: { id: true, teacherId: true, meetingUrl: true, archivedAt: true },
  });
  if (!course) throw new NotFound("course_not_found");

  const isTeacher = course.teacherId === params.actorUserId;
  if (!isTeacher) await requireActiveEnrolment(course.id, params.actorUserId);

  // Whether a link exists anywhere for this course — the standing one, or a
  // period that overrides it. The fact only; the URL stays behind joinRoom.
  const hasMeetingLink =
    (course.meetingUrl ?? "").trim().length > 0 ||
    (await db.timetableSlot.count({
      where: { courseOfferingId: course.id, meetingUrl: { not: null } },
    })) > 0;

  const session = await db.session.findFirst({
    where: {
      courseOfferingId: course.id,
      roomOpenedAt: { not: null },
      roomClosedAt: null,
      cancelledAt: null,
    },
    orderBy: { roomOpenedAt: "desc" },
    select: {
      id: true,
      roomOpenedAt: true,
      timetableSlot: { select: { meetingUrl: true } },
      presence: {
        select: {
          userId: true,
          lastSeenAt: true,
          lastActiveAt: true,
          user: {
            select: { firstName: true, lastName: true, profileImageId: true },
          },
        },
        orderBy: { lastSeenAt: "desc" },
      },
    },
  });

  if (!session) {
    return {
      sessionId: null,
      isOpen: false,
      openedAt: null,
      meetingUrl: null,
      hasMeetingLink,
      participants: [],
    };
  }

  const link = resolveMeetingLink({
    slotMeetingUrl: session.timetableSlot?.meetingUrl ?? null,
    courseMeetingUrl: course.meetingUrl,
  });

  return {
    sessionId: session.id,
    isOpen: true,
    openedAt: session.roomOpenedAt,
    meetingUrl: link?.url ?? null,
    hasMeetingLink,
    participants: presentInRoom(session.presence, now).map((row) => ({
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      profileImageId: row.user.profileImageId,
      isTeacher: row.userId === course.teacherId,
      state: row.state,
    })),
  };
}

/**
 * Who this person is on the stage, and whether they may put anything on it.
 *
 * The same gate as the meeting link — active enrolment or the owning teacher,
 * and a room that is actually open — because the stage is the room. Publishing
 * is the teacher's until they hand it over (ADR-0053), and the answer here is
 * what ends up inside the token rather than inside a button's disabled state.
 */
export async function stageAccessFor(params: {
  sessionId: string;
  actorUserId: string;
}): Promise<{ canPublish: boolean; participantName: string }> {
  const session = await loadSessionForMember(
    params.sessionId,
    params.actorUserId
  );

  if (session.roomOpenedAt === null || session.roomClosedAt !== null) {
    throw new ValidationError({ stage: "ห้องเรียนออนไลน์ยังไม่เปิด" });
  }

  const person = await db.user.findUnique({
    where: { id: params.actorUserId },
    select: { firstName: true, lastName: true },
  });
  const participantName =
    [person?.firstName, person?.lastName]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .trim() || "ผู้เข้าร่วม";

  return {
    canPublish: session.course.teacherId === params.actorUserId,
    participantName,
  };
}

/** Whether a teacher still has a room open anywhere — drives the standing reminder. */
export async function openRoomsForTeacher(params: {
  teacherUserId: string;
  now?: Date;
}): Promise<
  Array<{
    sessionId: string;
    courseId: string;
    courseName: string;
    openedAt: Date;
    occupants: number;
  }>
> {
  const now = params.now ?? new Date();
  const sessions = await db.session.findMany({
    where: {
      roomOpenedAt: { not: null },
      roomClosedAt: null,
      cancelledAt: null,
      course: { teacherId: params.teacherUserId, archivedAt: null },
    },
    orderBy: { roomOpenedAt: "asc" },
    select: {
      id: true,
      roomOpenedAt: true,
      course: { select: { id: true, name: true } },
      presence: { select: { lastSeenAt: true, lastActiveAt: true } },
    },
  });

  return sessions.map((session) => ({
    sessionId: session.id,
    courseId: session.course.id,
    courseName: session.course.name,
    openedAt: session.roomOpenedAt as Date,
    occupants: session.presence.filter(
      (row) => derivePresenceState(row, now) !== "LEFT"
    ).length,
  }));
}

async function loadSessionForTeacher(sessionId: string, actorUserId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      cancelledAt: true,
      roomOpenedAt: true,
      roomClosedAt: true,
      timetableSlot: { select: { meetingUrl: true } },
      course: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          meetingUrl: true,
          archivedAt: true,
        },
      },
    },
  });
  if (!session) throw new NotFound("session_not_found");
  if (session.course.teacherId !== actorUserId) {
    throw new Forbidden("not_course_owner");
  }
  if (session.course.archivedAt !== null) {
    throw new ValidationError({ room: "รายวิชานี้ถูกเก็บถาวรแล้ว" });
  }
  return session;
}

async function loadSessionForMember(sessionId: string, actorUserId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      cancelledAt: true,
      roomOpenedAt: true,
      roomClosedAt: true,
      timetableSlot: { select: { meetingUrl: true } },
      course: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          meetingUrl: true,
          archivedAt: true,
        },
      },
    },
  });
  if (!session) throw new NotFound("session_not_found");
  if (session.course.archivedAt !== null)
    throw new Forbidden("course_archived");
  if (session.course.teacherId === actorUserId) return session;

  await requireActiveEnrolment(session.course.id, actorUserId);
  return session;
}

/**
 * The link is visible only to active enrolments and the owning teacher
 * (ADR-0052). A leaked meeting link is a stranger in a room with children, so
 * a removed student loses the room in the same breath as the course.
 */
async function requireActiveEnrolment(
  courseOfferingId: string,
  userId: string
): Promise<void> {
  const enrolment = await db.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: { studentId: userId, courseOfferingId }, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id; the compound unique key is spelled this way
    },
    select: { removedAt: true },
  });
  if (!enrolment || enrolment.removedAt !== null) {
    throw new Forbidden("not_course_member");
  }
}
