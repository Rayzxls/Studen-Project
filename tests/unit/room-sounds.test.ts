import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * The sounds the whole room hears (ADR-0053).
 *
 * Nothing is transmitted — every client answers the same room event locally.
 * What is worth pinning is which event makes which noise, and the two cases
 * where a noise would be wrong: a reconnect delivering everything it missed at
 * once, and someone who has said they do not want to hear the room.
 */

const h = vi.hoisted(() => ({ playSound: vi.fn() }));

vi.mock("@/components/meeting/room-sounds", () => ({
  playSound: h.playSound,
}));

vi.mock("livekit-client", () => ({
  RoomEvent: {
    Connected: "connected",
    Reconnected: "reconnected",
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
    TrackPublished: "trackPublished",
    TrackUnpublished: "trackUnpublished",
    LocalTrackPublished: "localTrackPublished",
    LocalTrackUnpublished: "localTrackUnpublished",
  },
  Track: { Source: { ScreenShare: "screen_share" } },
}));

/** Stands in for the Room's emitter; only on/off/emit are ever used. */
function fakeRoom() {
  const handlers = new Map<string, Set<(payload?: unknown) => void>>();
  return {
    on(event: string, handler: (payload?: unknown) => void) {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
      return this;
    },
    off(event: string, handler: (payload?: unknown) => void) {
      handlers.get(event)?.delete(handler);
      return this;
    },
    emit(event: string, payload?: unknown) {
      for (const handler of handlers.get(event) ?? []) handler(payload);
    },
  };
}

const room = fakeRoom();

vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => room,
}));

const { useRoomSounds } = await import("@/components/meeting/use-room-sounds");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The hook holds sounds briefly after mounting; step past that window. */
function past() {
  vi.setSystemTime(Date.now() + 5_000);
}

describe("the room's own sounds", () => {
  it("rings for an arrival and a departure", () => {
    renderHook(() => useRoomSounds({ deafened: false }));
    past();

    act(() => room.emit("participantConnected"));
    expect(h.playSound).toHaveBeenCalledWith("join");

    act(() => room.emit("participantDisconnected"));
    expect(h.playSound).toHaveBeenCalledWith("leave");
  });

  it("rings when a screen goes up and comes down, including your own", () => {
    renderHook(() => useRoomSounds({ deafened: false }));
    past();

    act(() => room.emit("trackPublished", { source: "screen_share" }));
    expect(h.playSound).toHaveBeenCalledWith("share-start");

    // The person sharing hears it too: it is the room's event, not a report
    // about somebody else.
    act(() => room.emit("localTrackPublished", { source: "screen_share" }));
    expect(h.playSound).toHaveBeenCalledTimes(2);

    act(() => room.emit("trackUnpublished", { source: "screen_share" }));
    expect(h.playSound).toHaveBeenCalledWith("share-stop");
  });

  it("ignores tracks that are not a screen", () => {
    renderHook(() => useRoomSounds({ deafened: false }));
    past();

    act(() => room.emit("trackPublished", { source: "microphone" }));
    expect(h.playSound).not.toHaveBeenCalled();
  });

  it("stays quiet for someone who has shut their ears", () => {
    renderHook(() => useRoomSounds({ deafened: true }));
    past();

    act(() => room.emit("participantConnected"));
    act(() => room.emit("trackPublished", { source: "screen_share" }));
    // Deafened means "I do not want to hear the room", and these are the room.
    expect(h.playSound).not.toHaveBeenCalled();
  });

  it("does not burst after a reconnect delivers everything it missed", () => {
    renderHook(() => useRoomSounds({ deafened: false }));
    past();

    // A reconnect buffers the events it missed and fires them together.
    act(() => room.emit("reconnected"));
    act(() => {
      room.emit("participantConnected");
      room.emit("participantConnected");
      room.emit("participantConnected");
    });

    expect(h.playSound).not.toHaveBeenCalled();
  });

  it("lets go once the room has settled again", () => {
    renderHook(() => useRoomSounds({ deafened: false }));
    act(() => room.emit("reconnected"));
    past();

    act(() => room.emit("participantConnected"));
    expect(h.playSound).toHaveBeenCalledWith("join");
  });
});
