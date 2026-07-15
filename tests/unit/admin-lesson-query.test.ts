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

import { getAdminLessonWorkspace } from "@/lib/lesson";

describe("Admin Lesson observer query", () => {
  beforeEach(() => {
    mocks.findCourse.mockReset();
    mocks.findLessons.mockReset();
  });

  it("rejects non-Admin viewers before reading the database", async () => {
    await expect(
      getAdminLessonWorkspace({
        courseOfferingId: "course-a",
        viewer: { id: "teacher-1", role: "TEACHER" },
        env: { LESSON_WORKSPACE_ENABLED: "1" },
      })
    ).rejects.toMatchObject({ code: "lesson_workspace_forbidden" });
    expect(mocks.findCourse).not.toHaveBeenCalled();
    expect(mocks.findLessons).not.toHaveBeenCalled();
  });

  it("returns a disabled projection without database reads outside the pilot", async () => {
    const result = await getAdminLessonWorkspace({
      courseOfferingId: "course-b",
      viewer: { id: "admin-1", role: "ADMIN" },
      env: {
        LESSON_WORKSPACE_ENABLED: "1",
        LESSON_WORKSPACE_PILOT_COURSE_IDS: "course-a",
      },
    });

    expect(result).toEqual({
      enabled: false,
      courseOfferingId: "course-b",
      activeStudentCount: 0,
      lessons: [],
    });
    expect(mocks.findCourse).not.toHaveBeenCalled();
    expect(mocks.findLessons).not.toHaveBeenCalled();
  });

  it("selects aggregate submission state without student identity or private content", async () => {
    mocks.findCourse.mockResolvedValue({ _count: { enrollments: 1 } });
    mocks.findLessons.mockResolvedValue([
      {
        id: "lesson-1",
        title: "Lesson",
        description: null,
        position: 0,
        archivedAt: null,
        createdAt: new Date("2026-07-15T00:00:00Z"),
        _count: { materials: 1 },
        assignments: [
          {
            submissions: [
              { status: "SUBMITTED", enrollment: { removedAt: null } },
            ],
          },
        ],
      },
    ]);

    const result = await getAdminLessonWorkspace({
      courseOfferingId: "course-a",
      viewer: { id: "admin-1", role: "ADMIN" },
      env: { LESSON_WORKSPACE_ENABLED: "1" },
    });

    expect(result.lessons[0]).toMatchObject({
      submittedCount: 1,
      pendingGradingCount: 1,
      completionPercent: 100,
    });
    const query = mocks.findLessons.mock.calls[0][0];
    const serializedSelect = JSON.stringify(query.select);
    expect(serializedSelect).toContain("status");
    expect(serializedSelect).toContain("removedAt");
    expect(serializedSelect).not.toContain("studentId");
    expect(serializedSelect).not.toContain("enrollmentId");
    expect(serializedSelect).not.toContain("version");
    expect(serializedSelect).not.toContain("file");
    expect(serializedSelect).not.toContain("comment");
  });
});
