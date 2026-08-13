import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";
import {
  listCourseChannelMessages,
  sendCourseChannelMessage,
} from "@/lib/chat/course-channel";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

const ENABLED = { CHAT_ENABLED: "1", CHAT_MUTATIONS_ENABLED: "1" };
let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
  await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
});

afterEach(async () => {
  await ctx.cleanup();
});

describe("persistent Course Channel permissions", () => {
  it("fails closed before touching Chat tables", async () => {
    await expect(
      listCourseChannelMessages({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.teacherUserId, env: {} },
      })
    ).rejects.toBeInstanceOf(NotFound);
    await expect(
      sendCourseChannelMessage({
        courseOfferingId: ctx.courseOfferingId,
        body: "hello",
        ctx: { actorUserId: ctx.teacherUserId, env: { CHAT_ENABLED: "1" } },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("lets the owning teacher and an active student use one derived channel", async () => {
    const first = await sendCourseChannelMessage({
      courseOfferingId: ctx.courseOfferingId,
      body: "ประกาศจากครู",
      now: new Date("2026-08-14T02:00:00.000Z"),
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await sendCourseChannelMessage({
      courseOfferingId: ctx.courseOfferingId,
      body: "รับทราบครับ",
      now: new Date("2026-08-14T02:01:00.000Z"),
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });

    const view = await listCourseChannelMessages({
      courseOfferingId: ctx.courseOfferingId,
      afterMessageId: first.id,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    expect(view.conversationId).not.toBeNull();
    expect(view.messages.map((message) => message.body)).toEqual([
      "รับทราบครับ",
    ]);
    expect(
      await db.chatConversation.count({
        where: { courseOfferingId: ctx.courseOfferingId },
      })
    ).toBe(1);
  });

  it("refuses outsiders and students removed from the course", async () => {
    await expect(
      listCourseChannelMessages({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.otherStudentUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);

    await db.enrollment.update({
      where: {
        studentId_courseOfferingId: {
          studentId: ctx.studentUserId,
          courseOfferingId: ctx.courseOfferingId,
        },
      },
      data: { removedAt: new Date(), removedReason: "permission test" },
    });
    await expect(
      sendCourseChannelMessage({
        courseOfferingId: ctx.courseOfferingId,
        body: "should not send",
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("keeps an archived channel readable but prevents new messages", async () => {
    await sendCourseChannelMessage({
      courseOfferingId: ctx.courseOfferingId,
      body: "history remains",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await db.courseOffering.update({
      where: { id: ctx.courseOfferingId },
      data: { archivedAt: new Date() },
    });

    await expect(
      listCourseChannelMessages({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ messages: [{ body: "history remains" }] });
    await expect(
      sendCourseChannelMessage({
        courseOfferingId: ctx.courseOfferingId,
        body: "new message",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});
