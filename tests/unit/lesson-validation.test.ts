import { describe, expect, it } from "vitest";
import {
  CreateLessonSchema,
  LessonReasonSchema,
  MoveLessonContentSchema,
  ReorderLessonsSchema,
} from "@/lib/lesson/validation";

describe("Lesson mutation validation", () => {
  it("accepts teacher-defined titles and normalises blank descriptions", () => {
    expect(
      CreateLessonSchema.parse({
        courseOfferingId: "course-1",
        title: "  การทักทายและแนะนำตัว  ",
        description: "   ",
      })
    ).toMatchObject({
      title: "การทักทายและแนะนำตัว",
      description: null,
    });
  });

  it("requires an audit reason for archive, delete, and content moves", () => {
    expect(() => LessonReasonSchema.parse("สั้น")).toThrow();
    expect(
      MoveLessonContentSchema.parse({
        contentType: "ASSIGNMENT",
        contentId: "assignment-1",
        targetLessonId: "lesson-2",
        reason: "ย้ายให้ตรงกับแผนการสอน",
      })
    ).toMatchObject({ contentType: "ASSIGNMENT" });
  });

  it("rejects an empty reorder payload", () => {
    expect(() =>
      ReorderLessonsSchema.parse({
        courseOfferingId: "course-1",
        lessonIds: [],
      })
    ).toThrow();
  });
});
