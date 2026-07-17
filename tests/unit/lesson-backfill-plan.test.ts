import { describe, expect, it } from "vitest";
import {
  buildLegacyBackfillPlan,
  legacyLessonId,
} from "@/lib/lesson/backfill-plan";

describe("Lesson compatibility backfill planner", () => {
  it("builds a stable fallback Lesson id per CourseOffering", () => {
    expect(legacyLessonId("course-1")).toBe(legacyLessonId("course-1"));
    expect(legacyLessonId("course-1")).not.toBe(legacyLessonId("course-2"));
    expect(legacyLessonId("course-1")).toMatch(/^legacy_[a-f0-9]{24}$/);
  });

  it("plans one fallback Lesson after existing positions", () => {
    const plan = buildLegacyBackfillPlan([
      {
        courseOfferingId: "course-1",
        teacherId: "teacher-1",
        lessonPositions: [0, 4, 2],
        legacyLessonOwnerCourseOfferingId: null,
        legacyLessonArchivedAt: null,
        unassignedAssignmentCount: 3,
        unassignedMaterialCount: 2,
      },
    ]);

    expect(plan.summary).toEqual({
      coursesAffected: 1,
      lessonsToCreate: 1,
      assignmentsToLink: 3,
      materialsToLink: 2,
      totalContentLinks: 5,
    });
    expect(plan.courses[0]).toMatchObject({
      courseOfferingId: "course-1",
      legacyLessonPosition: 5,
      willCreateLesson: true,
      assignmentsToLink: 3,
      materialsToLink: 2,
    });
  });

  it("is a no-op when a course has no unassigned content", () => {
    const plan = buildLegacyBackfillPlan([
      {
        courseOfferingId: "course-1",
        teacherId: "teacher-1",
        lessonPositions: [],
        legacyLessonOwnerCourseOfferingId: null,
        legacyLessonArchivedAt: null,
        unassignedAssignmentCount: 0,
        unassignedMaterialCount: 0,
      },
    ]);

    expect(plan.courses).toEqual([]);
    expect(plan.summary.totalContentLinks).toBe(0);
  });

  it("reuses the deterministic fallback Lesson on a repeated run", () => {
    const plan = buildLegacyBackfillPlan([
      {
        courseOfferingId: "course-1",
        teacherId: "teacher-1",
        lessonPositions: [0],
        legacyLessonOwnerCourseOfferingId: "course-1",
        legacyLessonArchivedAt: null,
        unassignedAssignmentCount: 1,
        unassignedMaterialCount: 0,
      },
    ]);

    expect(plan.courses[0]?.willCreateLesson).toBe(false);
    expect(plan.summary.lessonsToCreate).toBe(0);
  });

  it("fails closed if the deterministic id belongs to another course", () => {
    expect(() =>
      buildLegacyBackfillPlan([
        {
          courseOfferingId: "course-1",
          teacherId: "teacher-1",
          lessonPositions: [],
          legacyLessonOwnerCourseOfferingId: "course-2",
          legacyLessonArchivedAt: null,
          unassignedAssignmentCount: 1,
          unassignedMaterialCount: 0,
        },
      ])
    ).toThrow(/legacy_lesson_id_collision/);
  });

  it("fails closed instead of linking into an archived fallback Lesson", () => {
    expect(() =>
      buildLegacyBackfillPlan([
        {
          courseOfferingId: "course-1",
          teacherId: "teacher-1",
          lessonPositions: [0],
          legacyLessonOwnerCourseOfferingId: "course-1",
          legacyLessonArchivedAt: new Date("2026-07-15T00:00:00Z"),
          unassignedAssignmentCount: 1,
          unassignedMaterialCount: 0,
        },
      ])
    ).toThrow(/legacy_lesson_archived/);
  });
});
