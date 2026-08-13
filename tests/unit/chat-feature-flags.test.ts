import { describe, expect, it } from "vitest";
import { chatEnabled, chatMutationsEnabled } from "@/lib/chat/feature-flags";

describe("persistent Chat feature flags", () => {
  it("fails reads closed unless the exact value is enabled", () => {
    expect(chatEnabled({})).toBe(false);
    expect(chatEnabled({ CHAT_ENABLED: "true" })).toBe(false);
    expect(chatEnabled({ CHAT_ENABLED: "0" })).toBe(false);
    expect(chatEnabled({ CHAT_ENABLED: "1" })).toBe(true);
  });

  it("requires the read flag before allowing mutations", () => {
    expect(chatMutationsEnabled({ CHAT_MUTATIONS_ENABLED: "1" })).toBe(false);
    expect(
      chatMutationsEnabled({
        CHAT_ENABLED: "1",
        CHAT_MUTATIONS_ENABLED: "1",
      })
    ).toBe(true);
  });
});
