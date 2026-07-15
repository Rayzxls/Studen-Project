import { describe, expect, it } from "vitest";
import {
  canDeleteLesson,
  canLinkContentToLesson,
  lessonState,
} from "@/lib/lesson/policy";

describe("Lesson domain policy", () => {
  it("derives active and archived state from archivedAt", () => {
    expect(lessonState({ archivedAt: null })).toBe("ACTIVE");
    expect(lessonState({ archivedAt: new Date("2026-07-15T00:00:00Z") })).toBe(
      "ARCHIVED"
    );
  });

  it("links content only to an active Lesson in the same CourseOffering", () => {
    expect(
      canLinkContentToLesson({
        contentCourseOfferingId: "course-1",
        lessonCourseOfferingId: "course-1",
        lessonArchivedAt: null,
      })
    ).toBe(true);
    expect(
      canLinkContentToLesson({
        contentCourseOfferingId: "course-1",
        lessonCourseOfferingId: "course-2",
        lessonArchivedAt: null,
      })
    ).toBe(false);
    expect(
      canLinkContentToLesson({
        contentCourseOfferingId: "course-1",
        lessonCourseOfferingId: "course-1",
        lessonArchivedAt: new Date("2026-07-15T00:00:00Z"),
      })
    ).toBe(false);
  });

  it("permits permanent deletion only for an empty Lesson", () => {
    expect(canDeleteLesson({ assignmentCount: 0, materialCount: 0 })).toBe(
      true
    );
    expect(canDeleteLesson({ assignmentCount: 1, materialCount: 0 })).toBe(
      false
    );
    expect(canDeleteLesson({ assignmentCount: 0, materialCount: 1 })).toBe(
      false
    );
  });
});
