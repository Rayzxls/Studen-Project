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
