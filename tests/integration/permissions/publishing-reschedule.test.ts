import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAnnouncement } from "@/lib/announcement";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, ValidationError } from "@/lib/errors";
import {
  publishScheduledNow,
  reschedulePublishAt,
} from "@/lib/publishing/reschedule";
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

/**
 * Anchored to the real clock, not to fixed dates: `createAnnouncement` decides
 * whether a post is already live by comparing with the actual now, so a
 * hardcoded "future" would quietly become a published post — and an unmovable
 * one — as soon as that date passed.
 */
const NOW = new Date();
const SCHEDULED = new Date(NOW.getTime() + 60 * 60_000);
const MOVED = new Date(NOW.getTime() + 3 * 60 * 60_000);

async function scheduleAnnouncement(publishAt: Date) {
  return createAnnouncement(
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
}

describe("rescheduling an unpublished post", () => {
  it("moves the publish time and leaves the notification unclaimed", async () => {
    const announcement = await scheduleAnnouncement(SCHEDULED);

    await reschedulePublishAt(
      "ANNOUNCEMENT",
      announcement.id,
      MOVED,
      { actorUserId: ctx.teacherUserId },
      NOW
    );

    const row = await db.announcement.findUniqueOrThrow({
      where: { id: announcement.id },
      select: { publishAt: true, notifiedAt: true },
    });
    expect(row.publishAt).toEqual(MOVED);
    // Still the sweep's to announce, at the new time.
    expect(row.notifiedAt).toBeNull();
  });

  it("refuses a teacher who does not own the course", async () => {
    const announcement = await scheduleAnnouncement(SCHEDULED);

    await expect(
      reschedulePublishAt(
        "ANNOUNCEMENT",
        announcement.id,
        MOVED,
        { actorUserId: ctx.otherTeacherUserId },
        NOW
      )
    ).rejects.toBeInstanceOf(Forbidden);

    const row = await db.announcement.findUniqueOrThrow({
      where: { id: announcement.id },
      select: { publishAt: true },
    });
    expect(row.publishAt).toEqual(SCHEDULED);
  });

  it("refuses to pull a post the class can already see back into the future", async () => {
    const announcement = await scheduleAnnouncement(SCHEDULED);
    const afterItWentLive = new Date(SCHEDULED.getTime() + 60_000);

    await expect(
      reschedulePublishAt(
        "ANNOUNCEMENT",
        announcement.id,
        MOVED,
        { actorUserId: ctx.teacherUserId },
        afterItWentLive
      )
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("refuses a new time that is not in the future", async () => {
    const announcement = await scheduleAnnouncement(SCHEDULED);

    await expect(
      reschedulePublishAt(
        "ANNOUNCEMENT",
        announcement.id,
        new Date(NOW.getTime() - 60_000),
        { actorUserId: ctx.teacherUserId },
        NOW
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("publishing a scheduled post immediately", () => {
  it("makes it visible now and tells the class without waiting for the sweep", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const announcement = await scheduleAnnouncement(SCHEDULED);

    await publishScheduledNow(
      "ANNOUNCEMENT",
      announcement.id,
      { actorUserId: ctx.teacherUserId },
      NOW
    );

    const row = await db.announcement.findUniqueOrThrow({
      where: { id: announcement.id },
      select: { publishAt: true, notifiedAt: true },
    });
    expect(row.publishAt).toEqual(NOW);
    expect(row.notifiedAt).toEqual(NOW);

    const notifications = await db.notification.findMany({
      where: {
        sourceEntityType: "ANNOUNCEMENT",
        sourceEntityId: announcement.id,
      },
      select: { recipientId: true },
    });
    expect(notifications).toEqual([{ recipientId: ctx.studentUserId }]);
  });

  it("refuses a teacher who does not own the course", async () => {
    const announcement = await scheduleAnnouncement(SCHEDULED);

    await expect(
      publishScheduledNow(
        "ANNOUNCEMENT",
        announcement.id,
        { actorUserId: ctx.otherTeacherUserId },
        NOW
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("does not notify twice when the post has already gone out", async () => {
    const announcement = await scheduleAnnouncement(SCHEDULED);
    await db.announcement.update({
      where: { id: announcement.id },
      data: { notifiedAt: SCHEDULED },
    });

    await expect(
      publishScheduledNow(
        "ANNOUNCEMENT",
        announcement.id,
        { actorUserId: ctx.teacherUserId },
        NOW
      )
    ).rejects.toBeInstanceOf(Conflict);
  });
});
