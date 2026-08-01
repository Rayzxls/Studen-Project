// @vitest-environment node

import { describe, expect, it } from "vitest";

import { teacherCourseTabs } from "@/app/teacher/courses/[id]/_tabs";

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
});
