import { AttendanceStatus, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { courseLearnerGroup } from "@/lib/course/display";
import { publishedWhere } from "@/lib/publishing/visibility";
import {
  evaluateEarlyWarning,
  type EarlyWarningAttendance,
  type EarlyWarningRow,
} from "./evaluate";

const HANDED_IN_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.LATE_SUBMITTED,
  SubmissionStatus.RETURNED,
  SubmissionStatus.GRADED,
];

const DASHBOARD_ROW_LIMIT = 8;

export interface TeacherEarlyWarningSummary {
  total: number;
  urgentCount: number;
  watchCount: number;
  rows: EarlyWarningRow[];
}

const EMPTY_SUMMARY: TeacherEarlyWarningSummary = {
  total: 0,
  urgentCount: 0,
  watchCount: 0,
  rows: [],
};

function emptyAttendance(): EarlyWarningAttendance {
  return { present: 0, late: 0, excused: 0, absent: 0 };
}

function countSignal(row: EarlyWarningRow, kind: "MISSING_WORK"): number;
function countSignal(row: EarlyWarningRow, kind: "ATTENDANCE"): number;
function countSignal(row: EarlyWarningRow, kind: "SCORE_DROP"): number;
function countSignal(
  row: EarlyWarningRow,
  kind: "MISSING_WORK" | "ATTENDANCE" | "SCORE_DROP"
): number {
  const signal = row.signals.find((candidate) => candidate.kind === kind);
  if (!signal) return 0;
  if (signal.kind === "MISSING_WORK") return signal.count;
  if (signal.kind === "ATTENDANCE") return 100 - signal.rate;
  return signal.drop;
}

function compareRows(a: EarlyWarningRow, b: EarlyWarningRow): number {
  if (a.severity !== b.severity) return a.severity === "URGENT" ? -1 : 1;
  if (a.signals.length !== b.signals.length) {
    return b.signals.length - a.signals.length;
  }
  const missing =
    countSignal(b, "MISSING_WORK") - countSignal(a, "MISSING_WORK");
  if (missing !== 0) return missing;
  const attendance =
    countSignal(b, "ATTENDANCE") - countSignal(a, "ATTENDANCE");
  if (attendance !== 0) return attendance;
  const scoreDrop = countSignal(b, "SCORE_DROP") - countSignal(a, "SCORE_DROP");
  if (scoreDrop !== 0) return scoreDrop;
  return a.studentName.localeCompare(b.studentName, "th");
}

/**
 * Teacher-only projection. Ownership is enforced in the first query and every
 * later read is constrained to the Enrollment/Course ids it returned.
 */
export async function getTeacherEarlyWarnings(
  teacherUserId: string,
  now: Date = new Date()
): Promise<TeacherEarlyWarningSummary> {
  const enrollments = await db.enrollment.findMany({
    where: {
      removedAt: null,
      course: { teacherId: teacherUserId, archivedAt: null },
    },
    select: {
      id: true,
      enrolledAt: true,
      student: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      course: {
        select: {
          id: true,
          name: true,
          learnerGroupLabel: true,
        },
      },
    },
  });
  if (enrollments.length === 0) return EMPTY_SUMMARY;

  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const courseIds = Array.from(
    new Set(enrollments.map((enrollment) => enrollment.course.id))
  );

  const [attendanceGroups, overdueAssignments, publishedScoreItems] =
    await Promise.all([
      db.attendanceRecord.groupBy({
        by: ["enrollmentId", "status"],
        where: {
          enrollmentId: { in: enrollmentIds },
          session: { cancelledAt: null },
        },
        _count: { _all: true },
      }),
      db.assignment.findMany({
        where: {
          courseOfferingId: { in: courseIds },
          dueAt: { lt: now },
          AND: publishedWhere("STUDENT", now),
        },
        select: {
          id: true,
          courseOfferingId: true,
          dueAt: true,
        },
      }),
      db.scoreItem.findMany({
        where: {
          courseOfferingId: { in: courseIds },
          publishedAt: { not: null },
        },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          courseOfferingId: true,
          fullScore: true,
          publishedAt: true,
        },
      }),
    ]);

  // Only four published items per course are needed for the two score
  // windows. Resolve those ids before loading entries so a long-running
  // course does not pull its entire gradebook onto the dashboard.
  const latestScoreItemsByCourse = new Map<
    string,
    typeof publishedScoreItems
  >();
  for (const scoreItem of publishedScoreItems) {
    const items =
      latestScoreItemsByCourse.get(scoreItem.courseOfferingId) ?? [];
    if (items.length < 4) {
      items.push(scoreItem);
      latestScoreItemsByCourse.set(scoreItem.courseOfferingId, items);
    }
  }
  const overdueAssignmentIds = overdueAssignments.map(
    (assignment) => assignment.id
  );
  const recentScoreItemIds = Array.from(
    latestScoreItemsByCourse.values()
  ).flatMap((items) => items.map((item) => item.id));

  const [handedIn, scoreEntries] = await Promise.all([
    db.submission.findMany({
      where: {
        enrollmentId: { in: enrollmentIds },
        assignmentId: { in: overdueAssignmentIds },
        status: { in: HANDED_IN_STATUSES },
      },
      select: { enrollmentId: true, assignmentId: true },
    }),
    db.scoreEntry.findMany({
      where: {
        enrollmentId: { in: enrollmentIds },
        scoreItemId: { in: recentScoreItemIds },
      },
      select: { enrollmentId: true, scoreItemId: true, value: true },
    }),
  ]);

  const attendanceByEnrollment = new Map<string, EarlyWarningAttendance>();
  for (const group of attendanceGroups) {
    const counts =
      attendanceByEnrollment.get(group.enrollmentId) ?? emptyAttendance();
    if (group.status === AttendanceStatus.PRESENT) {
      counts.present = group._count._all;
    } else if (group.status === AttendanceStatus.LATE) {
      counts.late = group._count._all;
    } else if (group.status === AttendanceStatus.EXCUSED) {
      counts.excused = group._count._all;
    } else {
      counts.absent = group._count._all;
    }
    attendanceByEnrollment.set(group.enrollmentId, counts);
  }

  const assignmentsByCourse = new Map<
    string,
    Array<{ id: string; dueAt: Date }>
  >();
  for (const assignment of overdueAssignments) {
    if (assignment.dueAt === null) continue;
    const assignments =
      assignmentsByCourse.get(assignment.courseOfferingId) ?? [];
    assignments.push({ id: assignment.id, dueAt: assignment.dueAt });
    assignmentsByCourse.set(assignment.courseOfferingId, assignments);
  }

  const handedInByEnrollment = new Map<string, Set<string>>();
  for (const submission of handedIn) {
    const assignmentIds =
      handedInByEnrollment.get(submission.enrollmentId) ?? new Set<string>();
    assignmentIds.add(submission.assignmentId);
    handedInByEnrollment.set(submission.enrollmentId, assignmentIds);
  }

  const scoreEntryByEnrollmentAndItem = new Map(
    scoreEntries.map((entry) => [
      `${entry.enrollmentId}:${entry.scoreItemId}`,
      entry.value,
    ])
  );

  const rows = enrollments.flatMap((enrollment) => {
    const handedInIds =
      handedInByEnrollment.get(enrollment.id) ?? new Set<string>();
    const missingAssignments = (
      assignmentsByCourse.get(enrollment.course.id) ?? []
    ).filter(
      (assignment) =>
        assignment.dueAt >= enrollment.enrolledAt &&
        !handedInIds.has(assignment.id)
    ).length;
    const scores = (latestScoreItemsByCourse.get(enrollment.course.id) ?? [])
      .filter(
        (scoreItem) =>
          scoreItem.publishedAt !== null &&
          scoreItem.publishedAt >= enrollment.enrolledAt
      )
      .map((scoreItem) => ({
        scoreItemId: scoreItem.id,
        fullScore: scoreItem.fullScore,
        value:
          scoreEntryByEnrollmentAndItem.get(
            `${enrollment.id}:${scoreItem.id}`
          ) ?? null,
        publishedAt: scoreItem.publishedAt as Date,
      }));
    const warning = evaluateEarlyWarning({
      enrollmentId: enrollment.id,
      studentUserId: enrollment.student.userId,
      studentName:
        `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
      courseId: enrollment.course.id,
      courseName: enrollment.course.name,
      learnerGroupLabel: courseLearnerGroup(enrollment.course) ?? "",
      attendance:
        attendanceByEnrollment.get(enrollment.id) ?? emptyAttendance(),
      missingAssignments,
      scoreItems: scores,
    });
    return warning ? [warning] : [];
  });

  rows.sort(compareRows);
  const urgentCount = rows.filter((row) => row.severity === "URGENT").length;

  return {
    total: rows.length,
    urgentCount,
    watchCount: rows.length - urgentCount,
    rows: rows.slice(0, DASHBOARD_ROW_LIMIT),
  };
}
