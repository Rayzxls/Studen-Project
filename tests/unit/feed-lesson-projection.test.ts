import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAssignments: vi.fn(),
  findMaterials: vi.fn(),
  findAnnouncements: vi.fn(),
  findScoreItems: vi.fn(),
  findFiles: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    assignment: { findMany: mocks.findAssignments },
    material: { findMany: mocks.findMaterials },
    announcement: { findMany: mocks.findAnnouncements },
    scoreItem: { findMany: mocks.findScoreItems },
    fileAttachment: { findMany: mocks.findFiles },
  },
}));

vi.mock("@/lib/moderation/queries", () => ({
  getModerationRestrictions: vi.fn().mockResolvedValue(new Map()),
  moderationTargetKey: (type: string, id: string) => `${type}:${id}`,
}));

import { getCourseFeed } from "@/lib/feed/aggregator";

describe("Course Feed Lesson projection", () => {
  beforeEach(() => {
    mocks.findAssignments.mockReset();
    mocks.findMaterials.mockReset().mockResolvedValue([]);
    mocks.findAnnouncements.mockReset().mockResolvedValue([]);
    mocks.findScoreItems.mockReset().mockResolvedValue([]);
    mocks.findFiles.mockReset().mockResolvedValue([]);
  });

  it("projects the linked Lesson so Feed cards can render its flag", async () => {
    mocks.findAssignments.mockResolvedValue([
      {
        id: "assignment-1",
        courseOfferingId: "course-1",
        title: "สรุปงาน",
        description: "ส่งสรุปท้ายบท",
        fileAttachmentIds: [],
        linkUrls: [],
        dueAt: null,
        createdAt: new Date("2026-07-16T00:00:00Z"),
        lessonId: "lesson-1",
        lesson: { title: "บทที่ 1" },
        course: {
          teacher: {
            userId: "teacher-1",
            firstName: "ครู",
            lastName: "ทดสอบ",
            user: { profileImageId: null },
          },
        },
      },
    ]);

    const page = await getCourseFeed("course-1");

    expect(mocks.findAssignments).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          lessonId: true,
          lesson: { select: { title: true } },
        }),
      })
    );
    expect(page.items[0]).toMatchObject({
      lessonId: "lesson-1",
      lessonTitle: "บทที่ 1",
    });
  });
});
