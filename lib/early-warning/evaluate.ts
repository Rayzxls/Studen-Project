export const EARLY_WARNING_THRESHOLDS = {
  attendanceMinimumMarked: 3,
  attendanceRatePercent: 80,
  missingAssignments: 2,
  scoreWindowSize: 2,
  scoreDropPoints: 10,
} as const;

export interface EarlyWarningAttendance {
  present: number;
  late: number;
  excused: number;
  absent: number;
}

export interface EarlyWarningScoreItem {
  scoreItemId: string;
  fullScore: number;
  value: number | null;
  publishedAt: Date;
}

export interface EarlyWarningSnapshot {
  enrollmentId: string;
  studentUserId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  learnerGroupLabel: string;
  attendance: EarlyWarningAttendance;
  missingAssignments: number;
  scoreItems: EarlyWarningScoreItem[];
}

export type EarlyWarningSignal =
  | {
      kind: "ATTENDANCE";
      rate: number;
      marked: number;
    }
  | {
      kind: "MISSING_WORK";
      count: number;
    }
  | {
      kind: "SCORE_DROP";
      drop: number;
      recentPercent: number;
      previousPercent: number;
    };

export interface EarlyWarningRow {
  enrollmentId: string;
  studentUserId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  learnerGroupLabel: string;
  severity: "WATCH" | "URGENT";
  signals: EarlyWarningSignal[];
}

function scoreWindowPercent(items: EarlyWarningScoreItem[]): number | null {
  const fullScore = items.reduce((sum, item) => sum + item.fullScore, 0);
  if (fullScore <= 0) return null;
  const earned = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  return Math.round((earned / fullScore) * 100);
}

/**
 * Convert one Enrollment's current evidence into a transparent warning.
 * Null means none of the documented signals currently fires.
 */
export function evaluateEarlyWarning(
  snapshot: EarlyWarningSnapshot
): EarlyWarningRow | null {
  const signals: EarlyWarningSignal[] = [];
  const marked =
    snapshot.attendance.present +
    snapshot.attendance.late +
    snapshot.attendance.excused +
    snapshot.attendance.absent;

  if (marked >= EARLY_WARNING_THRESHOLDS.attendanceMinimumMarked) {
    const rate = Math.round(
      ((snapshot.attendance.present + snapshot.attendance.late) / marked) * 100
    );
    if (rate < EARLY_WARNING_THRESHOLDS.attendanceRatePercent) {
      signals.push({ kind: "ATTENDANCE", rate, marked });
    }
  }

  if (
    snapshot.missingAssignments >= EARLY_WARNING_THRESHOLDS.missingAssignments
  ) {
    signals.push({
      kind: "MISSING_WORK",
      count: snapshot.missingAssignments,
    });
  }

  const scoreWindow = EARLY_WARNING_THRESHOLDS.scoreWindowSize;
  const recentScores = [...snapshot.scoreItems]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, scoreWindow * 2);
  if (recentScores.length === scoreWindow * 2) {
    const recentPercent = scoreWindowPercent(
      recentScores.slice(0, scoreWindow)
    );
    const previousPercent = scoreWindowPercent(recentScores.slice(scoreWindow));
    if (recentPercent !== null && previousPercent !== null) {
      const drop = previousPercent - recentPercent;
      if (drop >= EARLY_WARNING_THRESHOLDS.scoreDropPoints) {
        signals.push({
          kind: "SCORE_DROP",
          drop,
          recentPercent,
          previousPercent,
        });
      }
    }
  }

  if (signals.length === 0) return null;

  return {
    enrollmentId: snapshot.enrollmentId,
    studentUserId: snapshot.studentUserId,
    studentName: snapshot.studentName,
    courseId: snapshot.courseId,
    courseName: snapshot.courseName,
    learnerGroupLabel: snapshot.learnerGroupLabel,
    severity: signals.length >= 2 ? "URGENT" : "WATCH",
    signals,
  };
}
