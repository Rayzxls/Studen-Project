import { describe, expect, it } from "vitest";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatMessageExpiresAt,
  directConversationKey,
  directMessageBlocked,
  normalizeChatMessage,
} from "@/lib/chat/policy";

describe("persistent Chat policy", () => {
  it("uses one stable key for either direction of a DM", () => {
    expect(directConversationKey("user-b", "user-a")).toBe("user-a:user-b");
    expect(directConversationKey("user-a", "user-b")).toBe("user-a:user-b");
    expect(() => directConversationKey("user-a", "user-a")).toThrow(
      "chat_cannot_message_self"
    );
  });

  it("accepts meaningful bounded messages", () => {
    expect(normalizeChatMessage("  สวัสดีครับ  ")).toBe("สวัสดีครับ");
    expect(() => normalizeChatMessage("   ")).toThrow("chat_message_required");
    expect(() =>
      normalizeChatMessage("x".repeat(CHAT_MESSAGE_MAX_LENGTH + 1))
    ).toThrow("chat_message_too_long");
  });

  it("expires content after twelve calendar months", () => {
    expect(chatMessageExpiresAt(new Date("2026-08-14T10:00:00.000Z"))).toEqual(
      new Date("2027-08-14T10:00:00.000Z")
    );
  });

  it("treats a block in either direction as bilateral", () => {
    const blocks = [{ blockerId: "teacher", blockedId: "student" }];
    expect(
      directMessageBlocked({
        firstUserId: "student",
        secondUserId: "teacher",
        blocks,
      })
    ).toBe(true);
    expect(
      directMessageBlocked({
        firstUserId: "student",
        secondUserId: "friend",
        blocks,
      })
    ).toBe(false);
  });
});
