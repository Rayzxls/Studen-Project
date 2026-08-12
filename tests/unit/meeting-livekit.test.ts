// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  mintStageToken,
  readLiveKitConfig,
  roomNameForSession,
  stageEnabled,
} from "@/lib/meeting/livekit";

const CONFIG = {
  url: "wss://example.livekit.cloud",
  apiKey: "APItestkey",
  apiSecret: "a-test-secret-long-enough-to-sign-with",
};

/** Read a JWT's payload without verifying it — enough to assert the grant. */
function payloadOf(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

describe("whether the stage is configured at all", () => {
  it("is off when nothing is set, so the room still works without it", () => {
    expect(stageEnabled({})).toBe(false);
    expect(readLiveKitConfig({})).toBeNull();
  });

  it("is off when only some of the three are set", () => {
    expect(
      stageEnabled({ LIVEKIT_URL: CONFIG.url, LIVEKIT_API_KEY: CONFIG.apiKey })
    ).toBe(false);
  });

  it("treats blank as absent, the way a half-filled .env leaves it", () => {
    expect(
      stageEnabled({
        LIVEKIT_URL: CONFIG.url,
        LIVEKIT_API_KEY: CONFIG.apiKey,
        LIVEKIT_API_SECRET: "   ",
      })
    ).toBe(false);
  });

  it("is on once all three are present", () => {
    expect(
      stageEnabled({
        LIVEKIT_URL: CONFIG.url,
        LIVEKIT_API_KEY: CONFIG.apiKey,
        LIVEKIT_API_SECRET: CONFIG.apiSecret,
      })
    ).toBe(true);
  });
});

describe("the room a period gets", () => {
  it("derives its name from the session, so nothing has to be kept in sync", () => {
    expect(roomNameForSession("abc123")).toBe("session-abc123");
  });
});

describe("what a stage token permits", () => {
  it("lets a teacher speak and put things on the stage", async () => {
    const jwt = await mintStageToken(
      {
        sessionId: "s1",
        userId: "teacher-1",
        participantName: "ครูสมชาย",
        canPresent: true,
      },
      CONFIG
    );
    const video = payloadOf(jwt).video as Record<string, unknown>;
    expect(video.room).toBe("session-s1");
    expect(video.roomJoin).toBe(true);
    expect(video.canPublishSources).toContain("microphone");
    expect(video.canPublishSources).toContain("screen_share");
  });

  it("lets a student speak but never take the stage", async () => {
    // A class where students cannot answer is not a class, so the microphone
    // is theirs. Presenting is the teacher's to hand over (ADR-0053), and the
    // token is the gate rather than the button: a student who edits the page
    // still cannot share a screen.
    const jwt = await mintStageToken(
      {
        sessionId: "s1",
        userId: "student-1",
        participantName: "มานี",
        canPresent: false,
      },
      CONFIG
    );
    const video = payloadOf(jwt).video as Record<string, unknown>;
    expect(video.canSubscribe).toBe(true);
    expect(video.canPublishSources).toEqual(["microphone"]);
  });

  it("scopes the token to one room, so it cannot open another period", async () => {
    const jwt = await mintStageToken(
      {
        sessionId: "only-this-one",
        userId: "student-1",
        participantName: "มานี",
        canPresent: false,
      },
      CONFIG
    );
    expect((payloadOf(jwt).video as Record<string, unknown>).room).toBe(
      "session-only-this-one"
    );
  });

  it("names the participant so the roster is not a wall of ids", async () => {
    const jwt = await mintStageToken(
      {
        sessionId: "s1",
        userId: "student-1",
        participantName: "มานี ใจดี",
        canPresent: false,
      },
      CONFIG
    );
    const payload = payloadOf(jwt);
    expect(payload.sub).toBe("student-1");
    expect(payload.name).toBe("มานี ใจดี");
  });

  it("expires, so a token cannot outlive the term it was minted in", async () => {
    const jwt = await mintStageToken(
      {
        sessionId: "s1",
        userId: "student-1",
        participantName: "มานี",
        canPresent: false,
      },
      CONFIG
    );
    // The SDK emits nbf rather than iat, so the lifetime is measured from it.
    const payload = payloadOf(jwt);
    expect(typeof payload.exp).toBe("number");
    const hours = ((payload.exp as number) - (payload.nbf as number)) / 3600;
    expect(hours).toBe(3);
  });
});
