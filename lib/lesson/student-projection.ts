import type { SubmissionStatus } from "@prisma/client";
import { lessonState, type LessonState } from "./policy";

const COMPLETED_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
  "SUBMITTED",
  "LATE_SUBMITTED",
  "GRADED",
]);

export type StudentLessonSource = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  archivedAt: Date | null;
  materials: Array<{
    id: string;
    title: string;
    postedAt: Date;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    description: string;
    dueAt: Date | null;
    createdAt: Date;
    submissions: Array<{ status: SubmissionStatus }>;
  }>;
};

export type StudentLessonAssignment = {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  status: SubmissionStatus;
  isCompleted: boolean;
  isOverdue: boolean;
};

export type StudentLessonItem = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  state: LessonState;
  materialCount: number;
  assignmentCount: number;
  completedAssignmentCount: number;
  progressPercent: number;
  hasOverdue: boolean;
  nextTask: StudentLessonAssignment | null;
  materials: StudentLessonSource["materials"];
  assignments: StudentLessonAssignment[];
};

export type StudentLessonWorkspaceProjection = {
  enabled: boolean;
  courseOfferingId: string;
  lessons: StudentLessonItem[];
};

export function buildStudentLessonProjection(
  rows: StudentLessonSource[],
  now: Date = new Date()
): StudentLessonItem[] {
  return rows.map((row) => {
    const assignments = row.assignments.map((assignment) => {
      const status = assignment.submissions[0]?.status ?? "NOT_SUBMITTED";
      const isCompleted = COMPLETED_STATUSES.has(status);
      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        dueAt: assignment.dueAt,
        status,
        isCompleted,
        isOverdue:
          !isCompleted && assignment.dueAt !== null && assignment.dueAt < now,
      } satisfies StudentLessonAssignment;
    });
    const completedAssignmentCount = assignments.filter(
      (assignment) => assignment.isCompleted
    ).length;
    const nextTask =
      [...assignments]
        .filter((assignment) => !assignment.isCompleted)
        .sort((left, right) => {
          const leftDue = left.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
          const rightDue = right.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
          return leftDue - rightDue;
        })[0] ?? null;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      position: row.position,
      state: lessonState(row),
      materialCount: row.materials.length,
      assignmentCount: assignments.length,
      completedAssignmentCount,
      progressPercent:
        assignments.length === 0
          ? 0
          : Math.round((completedAssignmentCount / assignments.length) * 100),
      hasOverdue: assignments.some((assignment) => assignment.isOverdue),
      nextTask,
      materials: row.materials,
      assignments,
    };
  });
}

export function studentSubmissionStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "ส่งแล้ว";
    case "LATE_SUBMITTED":
      return "ส่งสาย";
    case "GRADED":
      return "ตรวจแล้ว";
    case "RETURNED":
      return "ส่งกลับให้แก้";
    case "DRAFT":
      return "ฉบับร่าง";
    default:
      return "ยังไม่ส่ง";
  }
}
