import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAnnouncement } from "@/lib/announcement";
import { db } from "@/lib/db/client";
import { getTeacherPublishingSchedule } from "@/lib/publishing/teacher-schedule";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

describe("teacher publishing schedule", () => {
  it("projects a future post, recipient count, push readiness, and later fan-out", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await db.webPushSubscription.create({
      data: {
        userId: ctx.studentUserId,
        endpoint: `https://push.test/${ctx.prefix}`,
        p256dh: "test-p256dh",
        auth: "test-auth",
      },
    });

    const now = new Date("2026-08-01T12:29:27.064Z");
    const publishAt = new Date("2026-08-03T07:05:00.000Z");
    const announcement = await createAnnouncement(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: null,
        body: "Scheduled test announcement",
        fileAttachmentIds: [],
        linkUrls: [],
        publishAt,
      },
      { actorUserId: ctx.teacherUserId }
    );

    const waiting = await getTeacherPublishingSchedule(
      ctx.courseOfferingId,
      now
    );
    expect(waiting.activeStudentCount).toBe(1);
    expect(waiting.studentsWithPushCount).toBe(1);
    expect(waiting.upcoming).toEqual([
      expect.objectContaining({
        id: announcement.id,
        kind: "ANNOUNCEMENT",
        title: "ประกาศไม่มีหัวข้อ",
        publishAt,
        status: "SCHEDULED",
        notificationCount: 0,
      }),
    ]);

    const deliveredAt = new Date("2026-08-03T07:05:30.000Z");
    await db.announcement.update({
      where: { id: announcement.id },
      data: { notifiedAt: deliveredAt },
    });
    await db.notification.create({
      data: {
        recipientId: ctx.studentUserId,
        kind: "ANNOUNCEMENT_POSTED",
        sourceEntityType: "ANNOUNCEMENT",
        sourceEntityId: announcement.id,
        courseOfferingId: ctx.courseOfferingId,
        payloadJson: {},
        readAt: deliveredAt,
      },
    });

    const published = await getTeacherPublishingSchedule(
      ctx.courseOfferingId,
      deliveredAt
    );
    expect(published.upcoming).toHaveLength(0);
    expect(published.recent[0]).toEqual(
      expect.objectContaining({
        id: announcement.id,
        status: "LIVE_NOTIFIED",
        notificationCount: 1,
        notificationReadCount: 1,
      })
    );
  });
});
