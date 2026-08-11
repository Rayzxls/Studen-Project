// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  AWAY_AFTER_MS,
  derivePresenceState,
  LEFT_AFTER_MS,
  presenceLabel,
  presentInRoom,
} from "@/lib/meeting/presence";

const NOW = new Date("2026-08-12T03:00:00.000Z");

/** A heartbeat `ms` before NOW. */
function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("how present someone in the online room is", () => {
  it("is active when the tab reported in while frontmost", () => {
    expect(
      derivePresenceState(
        { lastSeenAt: ago(3_000), lastActiveAt: ago(3_000) },
        NOW
      )
    ).toBe("ACTIVE");
  });

  it("is idle when the tab still reports but nobody is looking at it", () => {
    // Heartbeats continue, so lastSeenAt stays fresh while lastActiveAt ages.
    expect(
      derivePresenceState(
        { lastSeenAt: ago(3_000), lastActiveAt: ago(60_000) },
        NOW
      )
    ).toBe("IDLE");
  });

  it("is away once untouched for the owner's fifteen minutes", () => {
    expect(
      derivePresenceState(
        { lastSeenAt: ago(3_000), lastActiveAt: ago(AWAY_AFTER_MS) },
        NOW
      )
    ).toBe("AWAY");
  });

  it("is still idle one moment before that threshold", () => {
    expect(
      derivePresenceState(
        { lastSeenAt: ago(3_000), lastActiveAt: ago(AWAY_AFTER_MS - 1) },
        NOW
      )
    ).toBe("IDLE");
  });

  it("has left once the heartbeat stops, without anything sweeping the row", () => {
    expect(
      derivePresenceState(
        {
          lastSeenAt: ago(LEFT_AFTER_MS + 1),
          lastActiveAt: ago(LEFT_AFTER_MS + 1),
        },
        NOW
      )
    ).toBe("LEFT");
  });

  it("counts a closed laptop as left rather than away", () => {
    // Lid shut: both timestamps freeze together. Away is for someone still
    // connected, so a frozen row must not sit in the rail wearing a moon.
    const frozen = ago(AWAY_AFTER_MS + 60_000);
    expect(
      derivePresenceState({ lastSeenAt: frozen, lastActiveAt: frozen }, NOW)
    ).toBe("LEFT");
  });

  it("does not let a future lastActiveAt resurrect a dead tab", () => {
    // Clock skew on the client should never outrank silence on the server.
    expect(
      derivePresenceState(
        {
          lastSeenAt: ago(LEFT_AFTER_MS + 1),
          lastActiveAt: new Date(NOW.getTime() + 60_000),
        },
        NOW
      )
    ).toBe("LEFT");
  });
});

describe("who the rail draws", () => {
  it("drops people who left and keeps the rest with their state", () => {
    const rail = presentInRoom(
      [
        { id: "teacher", lastSeenAt: ago(2_000), lastActiveAt: ago(2_000) },
        { id: "idle", lastSeenAt: ago(2_000), lastActiveAt: ago(90_000) },
        {
          id: "away",
          lastSeenAt: ago(2_000),
          lastActiveAt: ago(AWAY_AFTER_MS),
        },
        { id: "gone", lastSeenAt: ago(600_000), lastActiveAt: ago(600_000) },
      ],
      NOW
    );

    expect(rail.map((row) => [row.id, row.state])).toEqual([
      ["teacher", "ACTIVE"],
      ["idle", "IDLE"],
      ["away", "AWAY"],
    ]);
  });

  it("returns an empty rail rather than throwing when nobody has joined", () => {
    expect(presentInRoom([], NOW)).toEqual([]);
  });
});

describe("the badge says its state in words as well as colour", () => {
  it("labels every state the rail can draw", () => {
    // Green and a hollow circle differ only by hue, which a screen reader and a
    // colour-blind reader cannot use.
    expect(presenceLabel("ACTIVE")).toBe("เปิดแอปอยู่");
    expect(presenceLabel("IDLE")).toBe("สลับไปแท็บอื่น");
    expect(presenceLabel("AWAY")).toBe("ไม่ได้ใช้งานนานแล้ว");
  });
});
