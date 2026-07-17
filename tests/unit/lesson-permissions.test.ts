import { describe, expect, it } from "vitest";
import { can, type Session } from "@/lib/auth/permissions";

function session(role: "ADMIN" | "TEACHER" | "STUDENT", id: string): Session {
  return {
    user: { id, role, identifier: id, mustResetPwd: false },
  };
}

const activeScope = {
  teacherId: "teacher-1",
  archivedAt: null,
  enrollment: { studentId: "student-1", removedAt: null },
};

describe("Lesson Workspace permissions", () => {
  it("lets the owning Teacher read and mutate active Lesson structure", () => {
    const teacher = session("TEACHER", "teacher-1");
    expect(can.viewLessonWorkspace(teacher, activeScope)).toBe(true);
    expect(
      can.mutateLesson(teacher, {
        course: { teacherId: "teacher-1", archivedAt: null },
      })
    ).toBe(true);
  });

  it("lets only the actively enrolled Student read", () => {
    expect(
      can.viewLessonWorkspace(session("STUDENT", "student-1"), activeScope)
    ).toBe(true);
    expect(
      can.viewLessonWorkspace(session("STUDENT", "student-2"), activeScope)
    ).toBe(false);
    expect(
      can.viewLessonWorkspace(session("STUDENT", "student-1"), {
        ...activeScope,
        enrollment: {
          studentId: "student-1",
          removedAt: new Date("2026-07-15T00:00:00Z"),
        },
      })
    ).toBe(false);
  });

  it("keeps Admin read-only observer access", () => {
    const admin = session("ADMIN", "admin-1");
    expect(can.viewLessonWorkspace(admin, activeScope)).toBe(true);
    expect(
      can.viewLessonWorkspace(admin, {
        ...activeScope,
        archivedAt: new Date("2026-07-15T00:00:00Z"),
      })
    ).toBe(true);
    expect(
      can.mutateLesson(admin, {
        course: { teacherId: "teacher-1", archivedAt: null },
      })
    ).toBe(false);
  });

  it("rejects mutation for non-owner and archived CourseOffering", () => {
    expect(
      can.mutateLesson(session("TEACHER", "teacher-2"), {
        course: { teacherId: "teacher-1", archivedAt: null },
      })
    ).toBe(false);
    expect(
      can.mutateLesson(session("TEACHER", "teacher-1"), {
        course: {
          teacherId: "teacher-1",
          archivedAt: new Date("2026-07-15T00:00:00Z"),
        },
      })
    ).toBe(false);
  });
});
