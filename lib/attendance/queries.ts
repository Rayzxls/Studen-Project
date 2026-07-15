import type { AttendanceStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";

/**
 * Attendance read queries — Phase 4
 *
 * Two surfaces:
 *
 *   - getAttendanceGridForTeacher → full grid (one row per student) for the
 *     attendance UI. Members = active ∪ ever-marked in this Session (ADR-0016
 *     § 3). Returns enough to render + edit (status + note + edit metadata).
 *
 *   - getAttendanceStatsForStudent → L1 projection (Pattern 4 from HANDOFF).
 *     The student sees ONLY their own counts; peer enrollmentIds, peer
 *     statuses, and peer rows never leave Prisma. Returns null if the user
 *     has no enrollment row at all for the course.
 */

export interface AttendanceGridRow {
  enrollmentId: string;
  removed: boolean;
  student: {
    userId: string;
    studentId: string;
    firstName: string;
    lastName: string;
  };
  record: {
    id: string;
    status: AttendanceStatus;
    note: string | null;
    markedAt: Date;
    updatedAt: Date;
    editCount: number;
  } | null;
}

export interface AttendanceGrid {
  session: {
    id: string;
    courseOfferingId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    cancelledAt: Date | null;
    cancelledReason: string | null;
    note: string | null;
    courseName: string;
    teacherId: string;
  };
  rows: AttendanceGridRow[];
}

export type AttendanceCounts = Record<AttendanceStatus, number>;

export interface TeacherAttendanceSummaryRow {
  enrollmentId: string;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
  };
  counts: AttendanceCounts;
}

export interface TeacherAttendanceSummary {
  totalSessions: number;
  rows: TeacherAttendanceSummaryRow[];
}

/**
 * Course-level attendance summary shared by the Teacher table and CSV export.
 * Only the owning Teacher may request it; Admin observer access is separate
 * and never reuses a Teacher export route.
 */
export async function getAttendanceSummaryForTeacher(
  courseOfferingId: string,
  actorUserId: string
): Promise<TeacherAttendanceSummary> {
  const course = await db.courseOffering.findUnique({
    where: { id: courseOfferingId },
    select: { teacherId: true },
  });
  if (!course) throw new NotFound("course_not_found");
  if (course.teacherId !== actorUserId) {
    throw new Forbidden("not_course_owner");
  }

  const [totalSessions, enrollments, grouped] = await Promise.all([
    db.session.count({
      where: { courseOfferingId, cancelledAt: null },
    }),
    db.enrollment.findMany({
      where: { courseOfferingId, removedAt: null },
      select: {
        id: true,
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { student: { firstName: "asc" } },
        { student: { lastName: "asc" } },
      ],
    }),
    db.attendanceRecord.groupBy({
      by: ["enrollmentId", "status"],
      where: { session: { courseOfferingId, cancelledAt: null } },
      _count: { _all: true },
    }),
  ]);

  const countsByEnrollment = new Map<string, AttendanceCounts>();
  for (const row of grouped) {
    const counts = countsByEnrollment.get(row.enrollmentId) ?? {
      PRESENT: 0,
      LATE: 0,
      EXCUSED: 0,
      ABSENT: 0,
    };
    counts[row.status] = row._count._all;
    countsByEnrollment.set(row.enrollmentId, counts);
  }

  return {
    totalSessions,
    rows: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: enrollment.student,
      counts: countsByEnrollment.get(enrollment.id) ?? {
        PRESENT: 0,
        LATE: 0,
        EXCUSED: 0,
        ABSENT: 0,
      },
    })),
  };
}

export async function getAttendanceGridForTeacher(
  sessionId: string
): Promise<AttendanceGrid | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      courseOfferingId: true,
      scheduledStart: true,
      scheduledEnd: true,
      cancelledAt: true,
      cancelledReason: true,
      note: true,
      course: { select: { name: true, teacherId: true } },
    },
  });
  if (!session) return null;

  const enrollments = await db.enrollment.findMany({
    where: {
      courseOfferingId: session.courseOfferingId,
      OR: [{ removedAt: null }, { attendanceRecords: { some: { sessionId } } }],
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      removedAt: true,
      student: {
        select: {
          userId: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
      attendanceRecords: {
        where: { sessionId },
        select: {
          id: true,
          status: true,
          note: true,
          markedAt: true,
          updatedAt: true,
          editCount: true,
        },
        take: 1,
      },
    },
  });

  return {
    session: {
      id: session.id,
      courseOfferingId: session.courseOfferingId,
      scheduledStart: session.scheduledStart,
      scheduledEnd: session.scheduledEnd,
      cancelledAt: session.cancelledAt,
      cancelledReason: session.cancelledReason,
      note: session.note,
      courseName: session.course.name,
      teacherId: session.course.teacherId,
    },
    rows: enrollments.map((e) => ({
      enrollmentId: e.id,
      removed: e.removedAt !== null,
      student: e.student,
      record: e.attendanceRecords[0] ?? null,
    })),
  };
}

export interface StudentSessionAttendance {
  sessionId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  note: string | null;
  ownStatus: AttendanceStatus | null;
  ownNote: string | null;
}

/**
 * Per-Session attendance for THIS student in one CourseOffering — L1
 * projection (Pattern 4). The query joins Session × this-enrollment's
 * AttendanceRecord. Peer rows are never selected — there is no `select`
 * clause that fetches other enrollments at all.
 *
 * Cancelled Sessions are included so the student can see "ครูยกเลิกคาบ
 * วันที่ X (เหตุผล: Y)" — but `ownStatus` will be null in that case (and
 * the row should render with cancelled-styling in the UI).
 *
 * Returns empty array if the student has no Enrollment row for this course
 * (which the caller's L1 gate should have already rejected). The query
 * doesn't return that distinction itself — use getAttendanceStatsForStudent
 * (returns null) to distinguish "never joined" from "no sessions yet".
 */
export async function getStudentSessionAttendance(params: {
  courseOfferingId: string;
  studentUserId: string;
}): Promise<StudentSessionAttendance[]> {
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: params.studentUserId,
        courseOfferingId: params.courseOfferingId,
      },
    },
    select: { id: true },
  });
  if (!enrollment) return [];

  const sessions = await db.session.findMany({
    where: { courseOfferingId: params.courseOfferingId },
    orderBy: { scheduledStart: "desc" },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      cancelledAt: true,
      cancelledReason: true,
      note: true,
      records: {
        // Only THIS enrollment's records — peer rows are never fetched.
        where: { enrollmentId: enrollment.id },
        select: { status: true, note: true },
        take: 1,
      },
    },
  });

  return sessions.map((s) => ({
    sessionId: s.id,
    scheduledStart: s.scheduledStart,
    scheduledEnd: s.scheduledEnd,
    cancelledAt: s.cancelledAt,
    cancelledReason: s.cancelledReason,
    note: s.note,
    ownStatus: s.records[0]?.status ?? null,
    ownNote: s.records[0]?.note ?? null,
  }));
}

export interface StudentAttendanceStats {
  totalSessions: number;
  marked: number;
  notMarkedYet: number;
  counts: Record<AttendanceStatus, number>;
}

/**
 * Student-side attendance statistics for one CourseOffering — L1 projection.
 *
 * Per CONTEXT.md § L1 Visibility + ADR-0016 § Consequences, the student sees:
 *   ✅ own counts per status
 *   ✅ denominator = total opened (non-cancelled) Sessions
 *   ❌ peer rows, peer statuses, peer enrollmentIds — never queried, never
 *      stripped at the caller; the DB returns only own-enrollment rows.
 *
 * Returns null if no Enrollment row exists at all (never joined). Removed
 * Enrollments still return stats — useful for the "ภาพรวมเทอมก่อนหน้า" UI.
 */
export async function getAttendanceStatsForStudent(params: {
  courseOfferingId: string;
  studentUserId: string;
}): Promise<StudentAttendanceStats | null> {
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: params.studentUserId,
        courseOfferingId: params.courseOfferingId,
      },
    },
    select: { id: true },
  });
  if (!enrollment) return null;

  const [totalSessions, grouped] = await Promise.all([
    db.session.count({
      where: {
        courseOfferingId: params.courseOfferingId,
        cancelledAt: null,
      },
    }),
    db.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        enrollmentId: enrollment.id,
        session: { cancelledAt: null },
      },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    LATE: 0,
    EXCUSED: 0,
    ABSENT: 0,
  };
  for (const g of grouped) {
    counts[g.status] = g._count._all;
  }
  const marked = counts.PRESENT + counts.LATE + counts.EXCUSED + counts.ABSENT;

  return {
    totalSessions,
    marked,
    notMarkedYet: Math.max(0, totalSessions - marked),
    counts,
  };
}
