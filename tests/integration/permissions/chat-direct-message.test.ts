import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  getDirectConversation,
  listDirectMessages,
  openDirectConversation,
  searchChatPeople,
  sendDirectMessage,
  setDirectMessageBlock,
} from "@/lib/chat/direct-message";
import { expireChatMessages } from "@/lib/chat/retention";
import { createModerationReport } from "@/lib/moderation/service";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

const ENABLED = { CHAT_ENABLED: "1", CHAT_MUTATIONS_ENABLED: "1" };
let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

describe("persistent Direct Message permissions", () => {
  it("requires a deliberate 3+ character name search", async () => {
    await expect(
      searchChatPeople({
        query: "Bo",
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    const results = await searchChatPeople({
      query: "Bob",
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    expect(results.map((person) => person.userId)).toContain(
      ctx.otherStudentUserId
    );
    expect(results.map((person) => person.userId)).not.toContain(
      ctx.studentUserId
    );
  });

  it("creates one two-person thread that no outsider can read", async () => {
    const { conversationId } = await openDirectConversation({
      otherUserId: ctx.studentUserId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await sendDirectMessage({
      conversationId,
      body: "สวัสดี",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await expect(
      listDirectMessages({
        conversationId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).resolves.toMatchObject([{ body: "สวัสดี" }]);
    await expect(
      listDirectMessages({
        conversationId,
        ctx: { actorUserId: ctx.otherStudentUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(NotFound);
    expect(
      await db.chatConversationMember.count({ where: { conversationId } })
    ).toBe(2);
  });

  it("treats either direction of a block as bilateral", async () => {
    const { conversationId } = await openDirectConversation({
      otherUserId: ctx.studentUserId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await setDirectMessageBlock({
      conversationId,
      blocked: true,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    await expect(
      sendDirectMessage({
        conversationId,
        body: "cannot pass",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);
    const state = await getDirectConversation({
      conversationId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    expect(state).toMatchObject({ blocked: true, blockedByMe: false });
  });

  it("expires content into a structural placeholder", async () => {
    const { conversationId } = await openDirectConversation({
      otherUserId: ctx.studentUserId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    const sent = await sendDirectMessage({
      conversationId,
      body: "temporary",
      now: new Date("2025-08-14T00:00:00.000Z"),
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await expireChatMessages({
      now: new Date("2026-08-15T00:00:00.000Z"),
      env: ENABLED,
    });
    const row = await db.chatMessage.findUniqueOrThrow({
      where: { id: sent.message.id },
      select: { body: true, authorId: true, deletionReason: true },
    });
    expect(row).toEqual({
      body: null,
      authorId: null,
      deletionReason: "RETENTION",
    });
  });

  it("reports an immutable context snapshot without granting thread access", async () => {
    const { conversationId } = await openDirectConversation({
      otherUserId: ctx.studentUserId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await sendDirectMessage({
      conversationId,
      body: "ก่อนหน้า",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    const target = await sendDirectMessage({
      conversationId,
      body: "ข้อความที่รายงาน",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await sendDirectMessage({
      conversationId,
      body: "หลังจากนั้น",
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });

    const report = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "CHAT_MESSAGE",
        targetId: target.message.id,
        category: "HARASSMENT",
        details: "ใช้ถ้อยคำที่ไม่เหมาะสม",
      },
      { enabled: true }
    );
    const moderationCase = await db.moderationCase.findUniqueOrThrow({
      where: { id: report.caseId },
      select: { targetSnapshot: true },
    });
    const snapshot = moderationCase.targetSnapshot as {
      conversationId: string;
      messages: Array<{ id: string; reported: boolean }>;
    };
    expect(snapshot.conversationId).toBe(conversationId);
    expect(snapshot.messages).toHaveLength(3);
    expect(snapshot.messages.find((message) => message.reported)?.id).toBe(
      target.message.id
    );
  });
});
