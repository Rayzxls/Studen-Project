import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";

/**
 * Changing what is being shared, mid-lesson (ADR-0053).
 *
 * The two things worth pinning are both about not punishing a change of mind.
 * The picker opens over the running share, so dismissing it costs nothing; and
 * the swap replaces the media on the existing publication rather than
 * republishing, so a class never sees the picture stop and start.
 */

const h = vi.hoisted(() => ({
  createLocalScreenTracks: vi.fn(),
  state: { participant: {} as Record<string, unknown> },
}));

vi.mock("livekit-client", () => ({
  createLocalScreenTracks: h.createLocalScreenTracks,
  Track: {
    Kind: { Video: "video", Audio: "audio" },
    Source: {
      ScreenShare: "screen_share",
      ScreenShareAudio: "screen_share_audio",
    },
  },
}));

vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({ localParticipant: h.state.participant }),
}));

const { useScreenShare } =
  await import("@/components/meeting/use-screen-share");
const { SharingBar } = await import("@/components/meeting/sharing-bar");

/** A local participant already sharing one surface. */
function sharingParticipant() {
  const previousMedia = { stop: vi.fn() };
  const videoTrack = {
    mediaStreamTrack: previousMedia,
    replaceTrack: vi.fn(async () => {}),
  };
  return {
    isScreenShareEnabled: true,
    setScreenShareEnabled: vi.fn(async () => {}),
    getTrackPublication: (source: string) =>
      source === "screen_share" ? { videoTrack } : undefined,
    videoTrack,
    previousMedia,
  };
}

function newScreenTrack() {
  return {
    kind: "video",
    mediaStreamTrack: { stop: vi.fn() },
    stop: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("switching the shared screen", () => {
  it("leaves the running share alone when the picker is dismissed", async () => {
    const participant = sharingParticipant();
    h.state.participant = participant;
    // What the browser throws when someone closes the dialog.
    h.createLocalScreenTracks.mockRejectedValue(new Error("NotAllowedError"));

    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      result.current.switchSource();
    });

    await waitFor(() => expect(result.current.failed).toBe(true));
    // The class keeps looking at exactly what it was looking at.
    expect(participant.videoTrack.replaceTrack).not.toHaveBeenCalled();
    expect(participant.previousMedia.stop).not.toHaveBeenCalled();
    expect(participant.setScreenShareEnabled).not.toHaveBeenCalled();
    expect(result.current.sharing).toBe(true);
  });

  it("replaces the media instead of republishing, and releases the old capture", async () => {
    const participant = sharingParticipant();
    h.state.participant = participant;
    const next = newScreenTrack();
    h.createLocalScreenTracks.mockResolvedValue([next]);

    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      result.current.switchSource();
    });

    await waitFor(() =>
      expect(participant.videoTrack.replaceTrack).toHaveBeenCalledTimes(1)
    );
    expect(participant.videoTrack.replaceTrack).toHaveBeenCalledWith(
      next.mediaStreamTrack,
      { userProvidedTrack: false }
    );
    // Stopping and starting would drop the picture for everyone.
    expect(participant.setScreenShareEnabled).not.toHaveBeenCalled();
    // Left running, the browser goes on naming a surface no longer shared.
    expect(participant.previousMedia.stop).toHaveBeenCalledTimes(1);
    // The new media is in use now, so its wrapper must not be torn down.
    expect(next.stop).not.toHaveBeenCalled();
  });

  it("releases what the picker opened when there is nothing to swap into", async () => {
    const participant = {
      isScreenShareEnabled: true,
      setScreenShareEnabled: vi.fn(async () => {}),
      getTrackPublication: () => undefined,
    };
    h.state.participant = participant;
    const next = newScreenTrack();
    h.createLocalScreenTracks.mockResolvedValue([next]);

    const { result } = renderHook(() => useScreenShare());
    await act(async () => {
      result.current.switchSource();
    });

    // Otherwise a capture keeps running with nowhere to go.
    await waitFor(() => expect(next.stop).toHaveBeenCalledTimes(1));
    expect(result.current.failed).toBe(true);
  });
});

describe("the standing sharing bar", () => {
  const share = {
    sharing: true,
    pending: false,
    failed: false,
    toggle: vi.fn(),
    switchSource: vi.fn(),
  };

  it("offers stopping and switching while a share is running", () => {
    render(<SharingBar share={share} hidden={false} />);
    expect(screen.getByText("กำลังแชร์หน้าจออยู่")).toBeTruthy();
    expect(screen.getByRole("button", { name: "หยุดแชร์" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "เปลี่ยนหน้าจอ" })).toBeTruthy();
  });

  it("stays out of the way when nothing is being shared", () => {
    render(<SharingBar share={{ ...share, sharing: false }} hidden={false} />);
    expect(screen.queryByText("กำลังแชร์หน้าจออยู่")).toBeNull();
  });

  it("defers to fullscreen, which already carries the same controls", () => {
    render(<SharingBar share={share} hidden />);
    expect(screen.queryByText("กำลังแชร์หน้าจออยู่")).toBeNull();
  });
});
