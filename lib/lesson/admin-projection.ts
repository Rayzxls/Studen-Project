import type { SubmissionStatus } from "@prisma/client";
import { lessonState, type LessonState } from "./policy";

export type AdminLessonSource = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  archivedAt: Date | null;
  createdAt: Date;
  materialCount: number;
  assignments: Array<{
    submissions: Array<{
      status: SubmissionStatus;
      enrollment: { removedAt: Date | null };
    }>;
  }>;
};

export type AdminLessonItem = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  state: LessonState;
  archivedAt: Date | null;
  createdAt: Date;
  assignmentCount: number;
  materialCount: number;
  submittedCount: number;
  missingCount: number;
  pendingGradingCount: number;
  completionPercent: number;
};

export type AdminLessonWorkspaceProjection = {
  enabled: boolean;
  courseOfferingId: string;
  activeStudentCount: number;
  lessons: AdminLessonItem[];
};

const COMPLETED_STATUSES: SubmissionStatus[] = [
  "SUBMITTED",
  "LATE_SUBMITTED",
  "GRADED",
];

const PENDING_STATUSES: SubmissionStatus[] = ["SUBMITTED", "LATE_SUBMITTED"];

/**
 * Build aggregate-only Admin progress. No Student ids, scores, attendance,
 * Submission versions, comments, or private files cross this projection.
 */
export function buildAdminLessonProjection(
  rows: AdminLessonSource[],
  activeStudentCount: number
): AdminLessonItem[] {
  return rows.map((row) => {
    const activeSubmissions = row.assignments.flatMap((assignment) =>
      assignment.submissions.filter(
        (submission) => submission.enrollment.removedAt === null
      )
    );
    const submittedCount = activeSubmissions.filter((submission) =>
      COMPLETED_STATUSES.includes(submission.status)
    ).length;
    const pendingGradingCount = activeSubmissions.filter((submission) =>
      PENDING_STATUSES.includes(submission.status)
    ).length;
    const possibleSubmissionCount = activeStudentCount * row.assignments.length;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      position: row.position,
      state: lessonState(row),
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      assignmentCount: row.assignments.length,
      materialCount: row.materialCount,
      submittedCount,
      missingCount: Math.max(possibleSubmissionCount - submittedCount, 0),
      pendingGradingCount,
      completionPercent:
        possibleSubmissionCount === 0
          ? 0
          : Math.round((submittedCount / possibleSubmissionCount) * 100),
    };
  });
}
