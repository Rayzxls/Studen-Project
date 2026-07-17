import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCourse: vi.fn(),
  findLessons: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    courseOffering: { findUnique: mocks.findCourse },
    lesson: { findMany: mocks.findLessons },
  },
}));

import {
  buildStudentLessonProjection,
  getStudentLessonWorkspace,
} from "@/lib/lesson";

describe("Student Lesson projection", () => {
  it("calculates progress from submitted Assignments only", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    const [lesson] = buildStudentLessonProjection(
      [
        {
          id: "lesson-1",
          title: "แรงและการเคลื่อนที่",
          description: null,
          position: 0,
          archivedAt: null,
          materials: [
            {
              id: "material-1",
              title: "อ่านก่อนเรียน",
              postedAt: new Date("2026-07-14T08:00:00Z"),
            },
          ],
          assignments: [
            {
              id: "assignment-done",
              title: "งานที่ส่งแล้ว",
              description: "",
              dueAt: new Date("2026-07-16T10:00:00Z"),
              createdAt: new Date("2026-07-14T08:00:00Z"),
              submissions: [{ status: "SUBMITTED" }],
            },
            {
              id: "assignment-overdue",
              title: "งานที่ค้าง",
              description: "",
              dueAt: new Date("2026-07-14T10:00:00Z"),
              createdAt: new Date("2026-07-14T09:00:00Z"),
              submissions: [],
            },
          ],
        },
      ],
      now
    );

    expect(lesson.materialCount).toBe(1);
    expect(lesson.completedAssignmentCount).toBe(1);
    expect(lesson.progressPercent).toBe(50);
    expect(lesson.hasOverdue).toBe(true);
    expect(lesson.nextTask?.id).toBe("assignment-overdue");
    expect(lesson.nextTask?.isOverdue).toBe(true);
  });

  it("keeps empty Lessons at zero progress instead of marking them complete", () => {
    const [lesson] = buildStudentLessonProjection([
      {
        id: "lesson-empty",
        title: "บทเรียนใหม่",
        description: null,
        position: 0,
        archivedAt: null,
        materials: [],
        assignments: [],
      },
    ]);

    expect(lesson.progressPercent).toBe(0);
    expect(lesson.nextTask).toBeNull();
  });
});

describe("Student Lesson privacy boundary", () => {
  beforeEach(() => {
    mocks.findCourse.mockReset();
    mocks.findLessons.mockReset();
  });

  it("filters nested Submissions by the current Enrollment id", async () => {
    mocks.findCourse.mockResolvedValue({
      enrollments: [{ id: "enrollment-self" }],
    });
    mocks.findLessons.mockResolvedValue([]);

    const result = await getStudentLessonWorkspace({
      courseOfferingId: "course-1",
      studentId: "student-self",
      env: { LESSON_WORKSPACE_ENABLED: "1" },
    });

    expect(result.lessons).toEqual([]);
    expect(mocks.findLessons).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          assignments: expect.objectContaining({
            select: expect.objectContaining({
              submissions: {
                where: { enrollmentId: "enrollment-self" },
                select: { status: true },
                take: 1,
              },
            }),
          }),
        }),
      })
    );
  });

  it("rejects a Student without an active Enrollment before reading Lessons", async () => {
    mocks.findCourse.mockResolvedValue({ enrollments: [] });

    await expect(
      getStudentLessonWorkspace({
        courseOfferingId: "course-1",
        studentId: "student-removed",
        env: { LESSON_WORKSPACE_ENABLED: "1" },
      })
    ).rejects.toMatchObject({ code: "lesson_workspace_forbidden" });
    expect(mocks.findLessons).not.toHaveBeenCalled();
  });
});
