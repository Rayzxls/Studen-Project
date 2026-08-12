import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * One token per room, not one per render (ADR-0053).
 *
 * Production was minting a LiveKit access token per participant every three
 * seconds. The room re-renders at the poll's cadence because the poll always
 * stores a fresh object, and the token effect listed `onUnavailable` among its
 * dependencies while the caller passed an inline arrow — so every render was a
 * new function, a new dependency, and another signed three-hour credential.
 *
 * The cost was not only the invocations: `LiveKitRoom` was handed a new `token`
 * prop at the same cadence.
 */

vi.mock("@livekit/components-react", async () => {
  const { createElement } = await import("react");
  type Props = { children?: React.ReactNode };
  return {
    LiveKitRoom: ({ children }: Props) => createElement("div", null, children),
    RoomAudioRenderer: () => null,
    VideoTrack: () => null,
    useTracks: () => [],
    useParticipants: () => [],
    useRoomContext: () => ({ on: () => {}, off: () => {} }),
    useLocalParticipant: () => ({
      localParticipant: {
        isMicrophoneEnabled: false,
        isScreenShareEnabled: false,
        setMicrophoneEnabled: async () => {},
        setScreenShareEnabled: async () => {},
      },
    }),
  };
});

vi.mock("livekit-client", () => ({
  Track: { Source: { ScreenShare: "screen_share" } },
  RoomEvent: { ParticipantAttributesChanged: "participantAttributesChanged" },
}));

// Needs the room's data channel, which is not what this test is about.
vi.mock("@/components/meeting/room-chat", () => ({
  RoomChat: () => null,
}));

const { StageLive } = await import("@/components/meeting/stage-live");

const SELF_PANEL = {
  self: { userId: "u1", name: "ครูสมชาย", profileImageId: null },
  inRoom: true,
  speaking: false,
  showEnter: false,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      token: "a-token",
      url: "wss://example.livekit.cloud",
      canPresent: true,
    }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fresh arrow every time, which is exactly what the caller used to pass. */
function view(sessionId: string) {
  return (
    <StageLive
      sessionId={sessionId}
      onUnavailable={() => {}}
      selfPanel={SELF_PANEL}
    />
  );
}

function tokenCalls(): number {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes("/stage-token")
  ).length;
}

describe("the stage mints one token per room", () => {
  it("does not re-mint when the room re-renders", async () => {
    const { rerender } = render(view("s1"));
    await waitFor(() => expect(tokenCalls()).toBe(1));

    // Six renders is eighteen seconds of an ordinary lesson.
    for (let i = 0; i < 6; i += 1) rerender(view("s1"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(tokenCalls()).toBe(1);
  });

  it("still mints again for a different session", async () => {
    // The guard must not be so tight that a new period reuses a stale token.
    const { rerender } = render(view("s1"));
    await waitFor(() => expect(tokenCalls()).toBe(1));

    rerender(view("s2"));
    await waitFor(() => expect(tokenCalls()).toBe(2));
  });
});
