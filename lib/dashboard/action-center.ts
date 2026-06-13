/**
 * Dashboard Action Center reads — Phase 11 dashboard reshape.
 *
 * Answers each role's first question of the day in one Server Component
 * pass:
 *   Student — "วันนี้ต้องจัดการอะไร" (returned work, due work, fresh scores)
 *   Teacher — "ห้องไหนต้องดูแลตอนนี้" (review queue, attendance today,
 *             class health)
 *
 * Same posture as `lib/dashboard/queries.ts`: authorization lives in the
 * caller (the dashboard page resolves the session + role first); every
 * query here is scoped to the actor's own enrollments / own CourseOfferings
 * so nothing widens visibility beyond what the role already sees.
 */

import { db } from "@/lib/db/client";
import { SubmissionStatus } from "@prisma/client";
import { currentTerm } from "./queries";

// ─────────────────────────────────────────────────────────────
// Student — Action Center
// ─────────────────────────────────────────────────────────────

export interface StudentReturnedItem {
  assignmentId: string;
  courseId: string;
  courseName: string;
  title: string;
  /** Submission.updatedAt — when the RETURN landed (status write time). */
  returnedAt: Date;
}

export interface StudentDueItem {
  assignmentId: string;
  courseId: string;
  courseName: string;
  title: string;
  dueAt: Date | null;
  /** Student opened the assignment / saved something but never submitted. */
  hasDraft: boolean;
  /** dueAt passed but the submission window is still open. */
  isOverdue: boolean;
}

export interface StudentRecentScore {
  scoreItemId: string;
  courseId: string;
  courseName: string;
  itemName: string;
  /** Own value — null when the teacher published the item without an entry. */
  value: number | null;
  fullScore: number;
  publishedAt: Date;
}

export interface StudentActionCenter {
  returned: StudentReturnedItem[];
  due: StudentDueItem[];
  recentScores: StudentRecentScore[];
}

export async function getStudentActionCenter(
  studentUserId: string,
  now: Date = new Date()
): Promise<StudentActionCenter> {
  const term = await currentTerm();
  if (!term) return { returned: [], due: [], recentScores: [] };

  const enrollments = await db.enrollment.findMany({
    where: {
      studentId: studentUserId,
      removedAt: null,
      course: { termId: term.id, archivedAt: null },
    },
    select: { id: true, courseOfferingId: true },
  });
  if (enrollments.length === 0) {
    return { returned: [], due: [], recentScores: [] };
  }
  const enrollmentIds = enrollments.map((e) => e.id);
  const courseIds = enrollments.map((e) => e.courseOfferingId);

  const [returnedRows, dueRows, scoreRows] = await Promise.all([
    // Work the teacher sent back — must be fixed and resubmitted.
    db.submission.findMany({
      where: {
        enrollmentId: { in: enrollmentIds },
        status: SubmissionStatus.RETURNED,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        updatedAt: true,
        assignment: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, name: true } },
          },
        },
      },
    }),
    // Assignments still owed: window open + own submission absent or
    // never actually submitted (NOT_SUBMITTED / version-less DRAFT).
    db.assignment.findMany({
      where: {
        courseOfferingId: { in: courseIds },
        submissionClosed: false,
        OR: [
          { submissions: { none: { enrollmentId: { in: enrollmentIds } } } },
          {
            submissions: {
              some: {
                enrollmentId: { in: enrollmentIds },
                status: {
                  in: [SubmissionStatus.NOT_SUBMITTED, SubmissionStatus.DRAFT],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        autoCloseAtDue: true,
        course: { select: { id: true, name: true } },
        submissions: {
          where: { enrollmentId: { in: enrollmentIds } },
          select: { status: true },
        },
      },
    }),
    // Freshly published score items with own value.
    db.scoreItem.findMany({
      where: {
        courseOfferingId: { in: courseIds },
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        fullScore: true,
        publishedAt: true,
        course: { select: { id: true, name: true } },
        entries: {
          where: { enrollmentId: { in: enrollmentIds } },
          select: { value: true },
        },
      },
    }),
  ]);

  const due: StudentDueItem[] = dueRows
    // autoCloseAtDue + past due = window already shut; not actionable.
    .filter((a) => !(a.autoCloseAtDue && a.dueAt !== null && a.dueAt <= now))
    .map((a) => ({
      assignmentId: a.id,
      courseId: a.course.id,
      courseName: a.course.name,
      title: a.title,
      dueAt: a.dueAt,
      hasDraft: a.submissions.some((s) => s.status === SubmissionStatus.DRAFT),
      isOverdue: a.dueAt !== null && a.dueAt < now,
    }))
    // Earliest deadline first; no-deadline work sinks to the bottom.
    .sort((a, b) => {
      if (a.dueAt === null && b.dueAt === null) return 0;
      if (a.dueAt === null) return 1;
      if (b.dueAt === null) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    })
    .slice(0, 8);

  return {
    returned: returnedRows.map((s) => ({
      assignmentId: s.assignment.id,
      courseId: s.assignment.course.id,
      courseName: s.assignment.course.name,
      title: s.assignment.title,
      returnedAt: s.updatedAt,
    })),
    due,
    recentScores: scoreRows.map((it) => ({
      scoreItemId: it.id,
      courseId: it.course.id,
      courseName: it.course.name,
      itemName: it.name,
      value: it.entries[0]?.value ?? null,
      fullScore: it.fullScore,
      publishedAt: it.publishedAt as Date,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Teacher — Review Queue
// ─────────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  assignmentId: string;
  courseId: string;
  classId: string;
  courseName: string;
  className: string;
  title: string;
  pendingCount: number;
}

/**
 * Assignments with submissions waiting in the review queue (SUBMITTED +
 * LATE_SUBMITTED), largest queue first. Links straight into the
 * Assignment Review Workspace.
 */
export async function getTeacherReviewQueue(
  teacherUserId: string
): Promise<ReviewQueueItem[]> {
  const term = await currentTerm();
  if (!term) return [];

  const grouped = await db.submission.groupBy({
    by: ["assignmentId"],
    where: {
      status: {
        in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
      },
      assignment: {
        course: { teacherId: teacherUserId, termId: term.id, archivedAt: null },
      },
    },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const top = [...grouped]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 6);

  const assignments = await db.assignment.findMany({
    where: { id: { in: top.map((g) => g.assignmentId) } },
    select: {
      id: true,
      title: true,
      course: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
  });
  const metaById = new Map(assignments.map((a) => [a.id, a]));

  return top.flatMap((g) => {
    const a = metaById.get(g.assignmentId);
    if (!a) return [];
    return [
      {
        assignmentId: a.id,
        courseId: a.course.id,
        classId: a.course.class.id,
        courseName: a.course.name,
        className: a.course.class.name,
        title: a.title,
        pendingCount: g._count._all,
      },
    ];
  });
}

// ─────────────────────────────────────────────────────────────
// Teacher — Attendance today
// ─────────────────────────────────────────────────────────────

export type AttendanceTodayStatus = "NOT_OPENED" | "OPENED" | "MARKED";

export interface AttendanceTodayRow {
  courseId: string;
  classId: string;
  courseName: string;
  className: string;
  startTime: string;
  endTime: string;
  location: string | null;
  /** NOT_OPENED = no Session materialised yet (lazy per ADR-0015). */
  status: AttendanceTodayStatus;
  markedCount: number;
  activeStudents: number;
}

/**
 * Today's timetable slots + whether a Session has been opened/marked for
 * that course today. Sessions are lazily materialised (ADR-0015), so
 * "no Session row" simply means the teacher hasn't opened the check-in
 * page yet — the CTA drives them there.
 */
export async function getTeacherAttendanceToday(
  teacherUserId: string,
  now: Date = new Date()
): Promise<AttendanceTodayRow[]> {
  const term = await currentTerm();
  if (!term) return [];
  const dayOfWeek = now.getDay();

  const slots = await db.timetableSlot.findMany({
    where: {
      dayOfWeek,
      course: { teacherId: teacherUserId, termId: term.id, archivedAt: null },
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
          class: { select: { id: true, name: true } },
          _count: { select: { enrollments: { where: { removedAt: null } } } },
        },
      },
    },
  });
  if (slots.length === 0) return [];

  // Bangkok calendar-day window in UTC (UTC+7, no DST).
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const bkk = new Date(now.getTime() + BKK_OFFSET_MS);
  const dayStart = new Date(
    Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) -
      BKK_OFFSET_MS
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const sessions = await db.session.findMany({
    where: {
      courseOfferingId: { in: slots.map((s) => s.course.id) },
      cancelledAt: null,
      scheduledStart: { gte: dayStart, lt: dayEnd },
    },
    select: {
      courseOfferingId: true,
      _count: { select: { records: true } },
    },
  });
  const sessionByCourse = new Map<string, number>();
  for (const s of sessions) {
    sessionByCourse.set(
      s.courseOfferingId,
      (sessionByCourse.get(s.courseOfferingId) ?? 0) + s._count.records
    );
  }

  return slots.map((s) => {
    const hasSession = sessionByCourse.has(s.course.id);
    const markedCount = sessionByCourse.get(s.course.id) ?? 0;
    return {
      courseId: s.course.id,
      classId: s.course.class.id,
      courseName: s.course.name,
      className: s.course.class.name,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      status: !hasSession
        ? "NOT_OPENED"
        : markedCount === 0
          ? "OPENED"
          : "MARKED",
      markedCount,
      activeStudents: s.course._count.enrollments,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Teacher — Class health
// ─────────────────────────────────────────────────────────────

export interface ClassHealthRow {
  courseId: string;
  classId: string;
  courseName: string;
  className: string;
  activeStudents: number;
  /** Submissions sitting in the review queue for this course. */
  pendingReview: number;
  /** ScoreItems still in draft (not published to students). */
  draftScoreItems: number;
  /** % of (assignment × student) slots with a real submission — null when
   *  the course has no assignments or no students yet. */
  submitRate: number | null;
}

export async function getTeacherClassHealth(
  teacherUserId: string
): Promise<ClassHealthRow[]> {
  const term = await currentTerm();
  if (!term) return [];

  const courses = await db.courseOffering.findMany({
    where: { teacherId: teacherUserId, termId: term.id, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true } },
      _count: {
        select: {
          enrollments: { where: { removedAt: null } },
          assignments: true,
          scoreItems: { where: { publishedAt: null } },
        },
      },
    },
  });
  if (courses.length === 0) return [];
  const courseIds = courses.map((c) => c.id);

  const [pendingGroups, submittedGroups] = await Promise.all([
    db.submission.groupBy({
      by: ["assignmentId"],
      where: {
        status: {
          in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
        },
        assignment: { courseOfferingId: { in: courseIds } },
      },
      _count: { _all: true },
    }),
    // Every submission that left the student's hands at least once.
    db.submission.groupBy({
      by: ["assignmentId"],
      where: {
        status: {
          in: [
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.LATE_SUBMITTED,
            SubmissionStatus.RETURNED,
            SubmissionStatus.GRADED,
          ],
        },
        assignment: { courseOfferingId: { in: courseIds } },
      },
      _count: { _all: true },
    }),
  ]);

  // groupBy can't return the parent courseOfferingId, so resolve the
  // assignment → course mapping in one slim read.
  const allAssignmentIds = Array.from(
    new Set([
      ...pendingGroups.map((g) => g.assignmentId),
      ...submittedGroups.map((g) => g.assignmentId),
    ])
  );
  const assignmentCourse =
    allAssignmentIds.length > 0
      ? await db.assignment.findMany({
          where: { id: { in: allAssignmentIds } },
          select: { id: true, courseOfferingId: true },
        })
      : [];
  const courseOfAssignment = new Map(
    assignmentCourse.map((a) => [a.id, a.courseOfferingId])
  );

  const pendingByCourse = new Map<string, number>();
  for (const g of pendingGroups) {
    const cid = courseOfAssignment.get(g.assignmentId);
    if (!cid) continue;
    pendingByCourse.set(cid, (pendingByCourse.get(cid) ?? 0) + g._count._all);
  }
  const submittedByCourse = new Map<string, number>();
  for (const g of submittedGroups) {
    const cid = courseOfAssignment.get(g.assignmentId);
    if (!cid) continue;
    submittedByCourse.set(
      cid,
      (submittedByCourse.get(cid) ?? 0) + g._count._all
    );
  }

  return courses.map((c) => {
    const slots = c._count.assignments * c._count.enrollments;
    const submitted = submittedByCourse.get(c.id) ?? 0;
    return {
      courseId: c.id,
      classId: c.class.id,
      courseName: c.name,
      className: c.class.name,
      activeStudents: c._count.enrollments,
      pendingReview: pendingByCourse.get(c.id) ?? 0,
      draftScoreItems: c._count.scoreItems,
      submitRate:
        slots === 0 ? null : Math.round(Math.min(1, submitted / slots) * 100),
    };
  });
}
