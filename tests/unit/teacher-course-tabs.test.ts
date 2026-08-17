// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import { studentCourseTabs } from "@/app/student/courses/[id]/_tabs";
import { teacherCourseTabs } from "@/app/teacher/courses/[id]/_tabs";

const originalRewardEnabled = process.env.COURSE_REWARD_MILESTONES_ENABLED;

afterEach(() => {
  if (originalRewardEnabled === undefined) {
    delete process.env.COURSE_REWARD_MILESTONES_ENABLED;
  } else {
    process.env.COURSE_REWARD_MILESTONES_ENABLED = originalRewardEnabled;
  }
});

describe("teacher course navigation", () => {
  it("links to the publishing schedule and can show the waiting count", () => {
    const schedule = teacherCourseTabs("course-1", 3).find(
      (tab) => tab.icon === "schedule"
    );

    expect(schedule).toEqual({
      label: "กำหนดการ",
      href: "/teacher/courses/course-1/schedule",
      icon: "schedule",
      badge: 3,
    });
  });

  it("keeps reward navigation fail-closed for both roles", () => {
    delete process.env.COURSE_REWARD_MILESTONES_ENABLED;

    expect(
      teacherCourseTabs("course-1").some((tab) => tab.icon === "rewards")
    ).toBe(false);
    expect(
      studentCourseTabs("course-1").some((tab) => tab.icon === "rewards")
    ).toBe(false);
  });

  it("shows role-specific reward navigation only when the read flag is enabled", () => {
    process.env.COURSE_REWARD_MILESTONES_ENABLED = "1";

    expect(
      teacherCourseTabs("course-1").find((tab) => tab.icon === "rewards")
    ).toEqual({
      label: "รางวัล",
      href: "/teacher/courses/course-1/rewards",
      icon: "rewards",
    });
    expect(
      studentCourseTabs("course-1").find((tab) => tab.icon === "rewards")
    ).toEqual({
      label: "รางวัล",
      href: "/student/courses/course-1/rewards",
      icon: "rewards",
    });
  });
});
