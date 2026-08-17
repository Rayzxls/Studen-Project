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
      CHAT_ENABLED: "1",
      CHAT_MUTATIONS_ENABLED: "1",
      REWARD_ENABLED: "0",
      REWARD_MUTATIONS_ENABLED: "0",
      COURSE_REWARD_MILESTONES_ENABLED: "1",
      COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "1",
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
      CHAT_ENABLED: "0",
      CHAT_MUTATIONS_ENABLED: "0",
      REWARD_ENABLED: "0",
      REWARD_MUTATIONS_ENABLED: "0",
      COURSE_REWARD_MILESTONES_ENABLED: "0",
      COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "0",
    });

    expect(env).toMatchObject({
      LESSON_WORKSPACE_ENABLED: "0",
      LESSON_WORKSPACE_MUTATIONS_ENABLED: "0",
      LESSON_WORKSPACE_DEFAULT_ROUTE_ENABLED: "1",
      MODERATION_CENTER_ENABLED: "0",
      QUIZ_ENABLED: "0",
      QUIZ_MUTATIONS_ENABLED: "0",
      CHAT_ENABLED: "0",
      CHAT_MUTATIONS_ENABLED: "0",
      REWARD_ENABLED: "0",
      REWARD_MUTATIONS_ENABLED: "0",
      COURSE_REWARD_MILESTONES_ENABLED: "0",
      COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "0",
    });
  });
});
