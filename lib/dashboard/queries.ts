/**
 * Shared dashboard read queries — Phase 10A foundation for Phase 11D.
 *
 * One module, three role consumers (Teacher / Student / Admin) — so a
 * metric is defined once and matches across all surfaces. Authorization
 * lives in the caller; these queries take a pre-checked `actorUserId`
 * + `role` and return raw numbers (no projection of PII other than
 * what the role already legitimately sees).
 *
 * Phase 10A ships the lib only — UI consumers land in Phase 11D when
 * dashboards are re-skinned in the new iOS+Win11 theme (Phase 11).
 * Same posture as Phase 5's `lib/scoring/*` shipping before its UI
 * surface.
 *
 * Q10e of the Phase 10 grill locked this as the single source of
 * truth for dashboard KPIs across roles.
 */

import { db } from "@/lib/db/client";
import { courseLearnerGroup } from "@/lib/course/display";
import { SubmissionStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Common (shared utilities)
// ─────────────────────────────────────────────────────────────

/**
 * Dashboard metrics are scoped to active standalone courses.
 */
// ─────────────────────────────────────────────────────────────
// Teacher dashboard KPIs
// ─────────────────────────────────────────────────────────────

export interface TeacherStats {
  /** Active CourseOfferings taught by the teacher. */
  courseCount: number;
  /** Distinct active enrollments across all of those courses. */
  studentCount: number;
  /** Submissions in {SUBMITTED, LATE_SUBMITTED} awaiting grading. */
  ungradedSubmissions: number;
  /** TimetableSlot minutes / week summed across the teacher's courses. */
  weeklyTeachingMinutes: number;
}

/**
 * Teacher dashboard KPI bundle — Pattern-matched to Father's StatCard
 * grid. Single batched read against active courses so the page can render
 * in one Server Component pass.
 *
 * Returns zeros when the teacher has no active courses.
 */
export async function getTeacherStats(
  teacherUserId: string
): Promise<TeacherStats> {
  const courses = await db.courseOffering.findMany({
    where: { teacherId: teacherUserId, archivedAt: null },
    select: {
      id: true,
      _count: { select: { enrollments: { where: { removedAt: null } } } },
      timetableSlots: {
        select: { startTime: true, endTime: true },
      },
    },
  });
  const courseIds = courses.map((c) => c.id);

  const ungradedSubmissions = await db.submission.count({
    where: {
      assignment: { courseOfferingId: { in: courseIds }, isScored: true },
      status: {
        in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
      },
    },
  });

  const studentCount = courses.reduce(
    (acc, c) => acc + c._count.enrollments,
    0
  );

  let weeklyTeachingMinutes = 0;
  for (const c of courses) {
    for (const slot of c.timetableSlots) {
      weeklyTeachingMinutes += slotMinutes(slot.startTime, slot.endTime);
    }
  }

  return {
    courseCount: courses.length,
    studentCount,
    ungradedSubmissions,
    weeklyTeachingMinutes,
  };
}

// ─────────────────────────────────────────────────────────────
// Student dashboard KPIs
// ─────────────────────────────────────────────────────────────

export interface StudentStats {
  /** Active enrollments in active courses. */
  courseCount: number;
  /** Aggregate attendance % across all active enrollments
   *  (= attended / marked × 100), null when no marked sessions. */
  attendanceRate: number | null;
  /** Assignments with `dueAt` in the future whose own Submission is
   *  NOT_SUBMITTED or DRAFT. */
  pendingAssignments: number;
}

export async function getStudentStats(
  studentUserId: string
): Promise<StudentStats> {
  const enrollments = await db.enrollment.findMany({
    where: {
      studentId: studentUserId,
      removedAt: null,
      course: { archivedAt: null },
    },
    select: { id: true, courseOfferingId: true },
  });
  const enrollmentIds = enrollments.map((e) => e.id);
  const courseIds = enrollments.map((e) => e.courseOfferingId);

  // Attendance — sum across active enrollments.
  let attendanceMarked = 0;
  let attendanceAttended = 0;
  const attendanceRows = await db.attendanceRecord.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { status: true },
  });
  for (const r of attendanceRows) {
    attendanceMarked += 1;
    if (r.status === "PRESENT" || r.status === "LATE") {
      attendanceAttended += 1;
    }
  }
  const attendanceRate =
    attendanceMarked === 0
      ? null
      : Math.round((attendanceAttended / attendanceMarked) * 100);

  // Pending assignments — own submission missing/draft and not past close.
  const pendingAssignments = await db.assignment.count({
    where: {
      courseOfferingId: { in: courseIds },
      OR: [
        {
          submissions: {
            none: { enrollment: { studentId: studentUserId } },
          },
        },
        {
          submissions: {
            some: {
              enrollment: { studentId: studentUserId },
              status: {
                in: [SubmissionStatus.NOT_SUBMITTED, SubmissionStatus.DRAFT],
              },
            },
          },
        },
      ],
    },
  });

  return {
    courseCount: enrollments.length,
    attendanceRate,
    pendingAssignments,
  };
}

// ─────────────────────────────────────────────────────────────
// Today's schedule (Phase 11D — Dashboard hero supporting reads)
// ─────────────────────────────────────────────────────────────

export interface TodayClass {
  /** CourseOffering id — link target for the row. */
  courseId: string;
  /** Stable key that drives the course identity colour. */
  courseVisualKey: string;
  /** Display name of the CourseOffering ("คณิตศาสตร์"). */
  courseName: string;
  /** Teacher-provided learner group label ("ม.4/2"). */
  className: string;
  /** "HH:mm" start. */
  startTime: string;
  /** "HH:mm" end. */
  endTime: string;
  /** Room / location free text. Optional. */
  location: string | null;
}

/**
 * Today's timetable rows for a teacher's active CourseOfferings.
 * Reads TimetableSlot only (no Session materialization required) —
 * the dashboard hero just shows the planned timetable for today regardless
 * of whether the teacher has opened a Session yet.
 *
 * Returns [] when there are no slots today.
 */
export async function getTeacherTodaySchedule(
  teacherUserId: string,
  now: Date = new Date()
): Promise<TodayClass[]> {
  const dayOfWeek = now.getDay();

  const slots = await db.timetableSlot.findMany({
    where: {
      dayOfWeek,
      course: { teacherId: teacherUserId, archivedAt: null },
    },
    orderBy: { startTime: "asc" },
    select: {
      startTime: true,
      endTime: true,
      location: true,
      course: {
        select: {
          id: true,
          name: true,
          learnerGroupLabel: true,
        },
      },
    },
  });

  return slots.map((s) => ({
    courseId: s.course.id,
    courseVisualKey: s.course.id,
    courseName: s.course.name,
    className: courseLearnerGroup(s.course) ?? "",
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
  }));
}

/**
 * Today's timetable rows for a student's active enrollments in the active
 * Term — same shape as the teacher variant so the UI consumer doesn't
 * branch on role.
 */
export async function getStudentTodaySchedule(
  studentUserId: string,
  now: Date = new Date()
): Promise<TodayClass[]> {
  const dayOfWeek = now.getDay();

  const slots = await db.timetableSlot.findMany({
    where: {
      dayOfWeek,
      course: {
        archivedAt: null,
        enrollments: { some: { studentId: studentUserId, removedAt: null } },
      },
    },
    orderBy: { startTime: "asc" },
    select: {
      startTime: true,
      endTime: true,
      location: true,
      course: {
        select: {
          id: true,
          name: true,
          learnerGroupLabel: true,
        },
      },
    },
  });

  return slots.map((s) => ({
    courseId: s.course.id,
    courseVisualKey: s.course.id,
    courseName: s.course.name,
    className: courseLearnerGroup(s.course) ?? "",
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
  }));
}

// ─────────────────────────────────────────────────────────────
// Admin dashboard KPIs
// ─────────────────────────────────────────────────────────────

export interface AdminStats {
  /** Active Teacher-owned CourseOfferings visible to Admin Observer. */
  courseCount: number;
  /** Total Teacher rows whose User account has not been soft-deleted. */
  teacherCount: number;
  /** Total Student rows whose identity is active and not anonymized. */
  studentCount: number;
  /** AuditLog rows whose action falls in the Critical tier within the
   *  last 7 days. Phase 10B will surface this as a hero stat. */
  criticalAuditsLast7d: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [courseCount, teacherCount, studentCount, criticalAuditsLast7d] =
    await Promise.all([
      db.courseOffering.count({ where: { archivedAt: null } }),
      db.teacher.count({ where: { user: { deletedAt: null } } }),
      db.student.count({
        where: { anonymized: false, user: { deletedAt: null } },
      }),
      // The Critical tier list lives in `lib/audit/tier.ts`; importing here
      // would create a cycle (audit/tier could one day depend on dashboard
      // queries for KPI widgets). Inline the Critical-tier action list for
      // the count — the source of truth is Security.md § 7 / Phase 8 P8-1.
      db.auditLog.count({
        where: {
          timestamp: { gte: sevenDaysAgo },
          action: {
            in: [
              "SCORE_DELETE_AFTER_PUBLISH",
              "SESSION_CANCELLED",
              "FILE_INFECTED_BLOCKED",
            ],
          },
        },
      }),
    ]);

  return {
    courseCount,
    teacherCount,
    studentCount,
    criticalAuditsLast7d,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Compute the minute-count between two "HH:mm" 24h Bangkok-local
 *  TimetableSlot fields. Returns 0 on malformed input rather than
 *  throwing — dashboard read paths should never crash on dirty data. */
function slotMinutes(start: string, end: string): number {
  const s = parseHM(start);
  const e = parseHM(end);
  if (s === null || e === null) return 0;
  const diff = e - s;
  return diff > 0 ? diff : 0;
}

function parseHM(hm: string): number | null {
  const parts = hm.split(":");
  if (parts.length !== 2) return null;
  const h = Number.parseInt(parts[0]!, 10);
  const m = Number.parseInt(parts[1]!, 10);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
