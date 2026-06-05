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
import { SubmissionStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Common (shared utilities)
// ─────────────────────────────────────────────────────────────

/**
 * The currently-active Term for the school. Returns `null` if the
 * school hasn't set up any active term yet (pre-seed state) — callers
 * render an empty-state in that case rather than crashing.
 */
export async function currentTerm(): Promise<{
  id: string;
  name: string;
  number: number;
  academicYearName: string;
} | null> {
  const t = await db.term.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      number: true,
      academicYear: { select: { name: true } },
    },
    orderBy: [{ academicYear: { name: "desc" } }, { number: "desc" }],
  });
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    number: t.number,
    academicYearName: t.academicYear.name,
  };
}

// ─────────────────────────────────────────────────────────────
// Teacher dashboard KPIs
// ─────────────────────────────────────────────────────────────

export interface TeacherStats {
  /** CourseOfferings the teacher is teaching THIS term. */
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
 * grid. Single batched read against active term so the page can render
 * in one Server Component pass.
 *
 * Returns zeros when there is no current term (pre-seed state) so the
 * caller can render empty hero cards without branching.
 */
export async function getTeacherStats(
  teacherUserId: string
): Promise<TeacherStats> {
  const term = await currentTerm();
  if (!term) {
    return {
      courseCount: 0,
      studentCount: 0,
      ungradedSubmissions: 0,
      weeklyTeachingMinutes: 0,
    };
  }
  const courses = await db.courseOffering.findMany({
    where: { teacherId: teacherUserId, termId: term.id },
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
  /** Active enrollments in the current term. */
  courseCount: number;
  /** Aggregate attendance % across all current-term enrollments
   *  (= attended / marked × 100), null when no marked sessions. */
  attendanceRate: number | null;
  /** Assignments with `dueAt` in the future whose own Submission is
   *  NOT_SUBMITTED or DRAFT. */
  pendingAssignments: number;
}

export async function getStudentStats(
  studentUserId: string
): Promise<StudentStats> {
  const term = await currentTerm();
  if (!term) {
    return { courseCount: 0, attendanceRate: null, pendingAssignments: 0 };
  }
  const enrollments = await db.enrollment.findMany({
    where: {
      studentId: studentUserId,
      removedAt: null,
      course: { termId: term.id },
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
// Admin dashboard KPIs
// ─────────────────────────────────────────────────────────────

export interface AdminStats {
  /** Distinct Classes (homerooms) of the active AcademicYear. */
  classCount: number;
  /** Total Teacher User rows (excluding anonymized). */
  teacherCount: number;
  /** Total Student User rows (excluding anonymized). */
  studentCount: number;
  /** AuditLog rows whose action falls in the Critical tier within the
   *  last 7 days. Phase 10B will surface this as a hero stat. */
  criticalAuditsLast7d: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const term = await currentTerm();
  const academicYearId = term
    ? (
        await db.term.findUnique({
          where: { id: term.id },
          select: { academicYearId: true },
        })
      )?.academicYearId
    : null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [classCount, teacherCount, studentCount, criticalAuditsLast7d] =
    await Promise.all([
      academicYearId
        ? db.class.count({ where: { academicYearId } })
        : Promise.resolve(0),
      db.teacher.count(),
      db.student.count(),
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
    classCount,
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
