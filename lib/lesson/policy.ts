export type LessonState = "ACTIVE" | "ARCHIVED";

export function lessonState(lesson: { archivedAt: Date | null }): LessonState {
  return lesson.archivedAt === null ? "ACTIVE" : "ARCHIVED";
}

/**
 * Assignment and Material may link only to an active Lesson in the same
 * CourseOffering. This prevents cross-course content moves even though the
 * additive database relation is intentionally nullable during compatibility.
 */
export function canLinkContentToLesson(input: {
  contentCourseOfferingId: string;
  lessonCourseOfferingId: string;
  lessonArchivedAt: Date | null;
}): boolean {
  return (
    input.lessonArchivedAt === null &&
    input.contentCourseOfferingId === input.lessonCourseOfferingId
  );
}

/** Empty Lessons are the only Lessons eligible for permanent deletion. */
export function canDeleteLesson(input: {
  assignmentCount: number;
  materialCount: number;
}): boolean {
  return input.assignmentCount === 0 && input.materialCount === 0;
}

export type LessonArchiveBlockers = {
  openAssignmentCount: number;
  pendingGradingCount: number;
};

/**
 * A Lesson may be archived only after teachers close every submission window
 * and finish grading every submitted/late-submitted row. A due date in the
 * past is considered closed even when the manual switch was not used.
 */
export function getLessonArchiveBlockers(
  assignments: Array<{
    submissionClosed: boolean;
    dueAt: Date | null;
    submissionStatuses: string[];
  }>,
  now: Date = new Date()
): LessonArchiveBlockers {
  let openAssignmentCount = 0;
  let pendingGradingCount = 0;

  for (const assignment of assignments) {
    const isOpen =
      !assignment.submissionClosed &&
      (assignment.dueAt === null || assignment.dueAt.getTime() > now.getTime());
    if (isOpen) openAssignmentCount += 1;

    pendingGradingCount += assignment.submissionStatuses.filter(
      (status) => status === "SUBMITTED" || status === "LATE_SUBMITTED"
    ).length;
  }

  return { openAssignmentCount, pendingGradingCount };
}

export function canArchiveLesson(blockers: LessonArchiveBlockers): boolean {
  return (
    blockers.openAssignmentCount === 0 && blockers.pendingGradingCount === 0
  );
}
