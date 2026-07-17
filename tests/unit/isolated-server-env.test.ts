import { describe, expect, it } from "vitest";
import { prepareIsolatedServerEnv } from "../../scripts/isolated-server-env";

describe("isolated QA server feature flags", () => {
  it("enables Lesson, Moderation, and Quiz QA while keeping route cutover off", () => {
    const env = prepareIsolatedServerEnv({
      DATABASE_URL: "qa-database",
      LESSON_WORKSPACE_PILOT_COURSE_IDS: "production-course-id",
    });

    expect(env).toMatchObject({
      DATABASE_URL: "qa-database",
      LESSON_WORKSPACE_ENABLED: "1",
      LESSON_WORKSPACE_MUTATIONS_ENABLED: "1",
      LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED: "0",
      LESSON_WORKSPACE_PILOT_COURSE_IDS: "*",
      MODERATION_CENTER_ENABLED: "1",
      QUIZ_ENABLED: "1",
      QUIZ_MUTATIONS_ENABLED: "1",
      QUIZ_PILOT_COURSE_IDS: "*",
    });
  });

  it("preserves explicit fail-closed overrides", () => {
    const env = prepareIsolatedServerEnv({
      LESSON_WORKSPACE_ENABLED: "0",
      LESSON_WORKSPACE_MUTATIONS_ENABLED: "0",
      LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED: "1",
      MODERATION_CENTER_ENABLED: "0",
      QUIZ_ENABLED: "0",
      QUIZ_MUTATIONS_ENABLED: "0",
      QUIZ_PILOT_COURSE_IDS: "production-course-id",
    });

    expect(env).toMatchObject({
      LESSON_WORKSPACE_ENABLED: "0",
      LESSON_WORKSPACE_MUTATIONS_ENABLED: "0",
      LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED: "1",
      MODERATION_CENTER_ENABLED: "0",
      QUIZ_ENABLED: "0",
      QUIZ_MUTATIONS_ENABLED: "0",
      QUIZ_PILOT_COURSE_IDS: "*",
    });
  });
});
