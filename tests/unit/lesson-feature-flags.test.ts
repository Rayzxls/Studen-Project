import { describe, expect, it } from "vitest";
import {
  lessonWorkspaceCourseEnabled,
  lessonWorkspaceCourseMutationsEnabled,
  lessonWorkspaceDefaultRouteEnabled,
  lessonWorkspaceEnabled,
  lessonWorkspaceMutationsEnabled,
} from "@/lib/lesson/feature-flags";

describe("Lesson Workspace feature flags", () => {
  it("fails closed when flags are absent or use a non-exact value", () => {
    expect(lessonWorkspaceEnabled({})).toBe(false);
    expect(lessonWorkspaceEnabled({ LESSON_WORKSPACE_ENABLED: "true" })).toBe(
      false
    );
  });

  it("enables the read projection only with exact value 1", () => {
    expect(lessonWorkspaceEnabled({ LESSON_WORKSPACE_ENABLED: "1" })).toBe(
      true
    );
  });

  it("keeps all courses enabled when the optional pilot allowlist is absent", () => {
    expect(
      lessonWorkspaceCourseEnabled("course-a", {
        LESSON_WORKSPACE_ENABLED: "1",
      })
    ).toBe(true);
  });

  it("restricts the workspace to exact course ids when a pilot allowlist is present", () => {
    const env = {
      LESSON_WORKSPACE_ENABLED: "1",
      LESSON_WORKSPACE_PILOT_COURSE_IDS: " course-a,course-b ",
    };
    expect(lessonWorkspaceCourseEnabled("course-a", env)).toBe(true);
    expect(lessonWorkspaceCourseEnabled("course-b", env)).toBe(true);
    expect(lessonWorkspaceCourseEnabled("course", env)).toBe(false);
    expect(lessonWorkspaceCourseEnabled("course-c", env)).toBe(false);
  });

  it("enables no course when the pilot allowlist is explicitly empty", () => {
    expect(
      lessonWorkspaceCourseEnabled("course-a", {
        LESSON_WORKSPACE_ENABLED: "1",
        LESSON_WORKSPACE_PILOT_COURSE_IDS: "",
      })
    ).toBe(false);
  });

  it("never enables mutations unless the workspace is also enabled", () => {
    expect(
      lessonWorkspaceMutationsEnabled({
        LESSON_WORKSPACE_MUTATIONS_ENABLED: "1",
      })
    ).toBe(false);
    expect(
      lessonWorkspaceMutationsEnabled({
        LESSON_WORKSPACE_ENABLED: "1",
        LESSON_WORKSPACE_MUTATIONS_ENABLED: "1",
      })
    ).toBe(true);
  });

  it("applies the pilot allowlist to mutations as well as reads", () => {
    const env = {
      LESSON_WORKSPACE_ENABLED: "1",
      LESSON_WORKSPACE_MUTATIONS_ENABLED: "1",
      LESSON_WORKSPACE_PILOT_COURSE_IDS: "course-a",
    };
    expect(lessonWorkspaceCourseMutationsEnabled("course-a", env)).toBe(true);
    expect(lessonWorkspaceCourseMutationsEnabled("course-b", env)).toBe(false);
  });

  it("keeps the default-route cutover independent and fail closed", () => {
    expect(
      lessonWorkspaceDefaultRouteEnabled({
        LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED: "1",
      })
    ).toBe(false);
    expect(
      lessonWorkspaceDefaultRouteEnabled({
        LESSON_WORKSPACE_ENABLED: "1",
        LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED: "1",
      })
    ).toBe(true);
  });
});
