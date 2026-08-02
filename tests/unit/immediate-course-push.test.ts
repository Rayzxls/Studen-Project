import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    courseOffering: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    teacher: { findUniqueOrThrow: vi.fn() },
    material: { create: vi.fn() },
    assignment: { create: vi.fn(), update: vi.fn() },
    scoreItem: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    fanOutBroadcast: vi.fn(),
    sendCoursePush: vi.fn(),
    assertLinkableLesson: vi.fn(),
    suppressNotificationsForDeletedEntity: vi.fn(),
    events: [] as string[],
  };
});

vi.mock("@/lib/db/client", () => ({
  db: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/notification", () => ({
  fanOutBroadcast: mocks.fanOutBroadcast,
  suppressNotificationsForDeletedEntity:
    mocks.suppressNotificationsForDeletedEntity,
}));

vi.mock("@/lib/notification/push", () => ({
  sendCoursePush: mocks.sendCoursePush,
}));

vi.mock("@/lib/lesson/linking", () => ({
  assertLinkableLesson: mocks.assertLinkableLesson,
}));

import { createAssignment } from "@/lib/assignment/assignment";
import { createMaterial } from "@/lib/material/material";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.events.length = 0;
  mocks.tx.courseOffering.findUnique.mockResolvedValue({
    teacherId: "teacher-1",
    name: "คณิตศาสตร์",
  });
  mocks.tx.courseOffering.findUniqueOrThrow.mockResolvedValue({
    name: "คณิตศาสตร์",
  });
  mocks.tx.teacher.findUniqueOrThrow.mockResolvedValue({
    firstName: "ครู",
    lastName: "ใจดี",
  });
  mocks.tx.material.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "material-1",
      ...data,
    })
  );
  mocks.tx.assignment.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "assignment-1",
      scoreItemId: null,
      ...data,
    })
  );
  mocks.transaction.mockImplementation(
    async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
      const result = await callback(mocks.tx);
      mocks.events.push("commit");
      return result;
    }
  );
  mocks.sendCoursePush.mockImplementation(async () => {
    mocks.events.push("push");
  });
});

describe("immediate course Web Push", () => {
  it("pushes a live Material only after its transaction commits", async () => {
    await createMaterial(
      {
        courseOfferingId: "course-1",
        title: "เอกสารใหม่",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: "teacher-1" }
    );

    expect(mocks.sendCoursePush).toHaveBeenCalledWith("course-1", {
      title: "คณิตศาสตร์",
      body: "มีเอกสารใหม่",
      url: "/student/courses/course-1/feed",
      tag: "material:material-1",
    });
    expect(mocks.events).toEqual(["commit", "push"]);
  });

  it("leaves a scheduled Material for the publishing sweep", async () => {
    await createMaterial(
      {
        courseOfferingId: "course-1",
        title: "เอกสารพรุ่งนี้",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
        publishAt: new Date("2099-01-01T00:00:00.000Z"),
      },
      { actorUserId: "teacher-1" }
    );

    expect(mocks.sendCoursePush).not.toHaveBeenCalled();
    expect(mocks.events).toEqual(["commit"]);
  });

  it("pushes a live Assignment only after its transaction commits", async () => {
    await createAssignment(
      {
        courseOfferingId: "course-1",
        title: "งานใหม่",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
      },
      { actorUserId: "teacher-1" }
    );

    expect(mocks.sendCoursePush).toHaveBeenCalledWith("course-1", {
      title: "คณิตศาสตร์",
      body: "มีงานใหม่ที่ต้องส่ง",
      url: "/student/courses/course-1/assignments/assignment-1",
      tag: "assignment:assignment-1",
    });
    expect(mocks.events).toEqual(["commit", "push"]);
  });

  it("leaves a scheduled Assignment for the publishing sweep", async () => {
    await createAssignment(
      {
        courseOfferingId: "course-1",
        title: "งานพรุ่งนี้",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
        publishAt: new Date("2099-01-01T00:00:00.000Z"),
      },
      { actorUserId: "teacher-1" }
    );

    expect(mocks.sendCoursePush).not.toHaveBeenCalled();
    expect(mocks.events).toEqual(["commit"]);
  });
});
