import { describe, expect, it } from "vitest";
import {
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
