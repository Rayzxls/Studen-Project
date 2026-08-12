"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  MonitorX,
  Volume2,
  VolumeX,
} from "lucide-react";

import { StateToggle } from "@/components/meeting/state-toggle";

import "@livekit/components-styles";

/**
 * The stage, connected (ADR-0053).
 *
 * Loaded only through the lazy wrapper in `stage.tsx`, and only once a room is
 * actually open: the LiveKit client is large and has no business in the bundle
 * of a course page that is not in a lesson.
 *
 * Screen share, not a camera grid. A class is one person showing something to
 * thirty, which is a single publisher and thirty subscribers — far cheaper in
 * bandwidth than everyone publishing, and the thing a lesson actually needs.
 */
export function StageLive({
  sessionId,
  onUnavailable,
}: {
  sessionId: string;
  onUnavailable: () => void;
}) {
  const [auth, setAuth] = useState<{
    token: string;
    url: string;
    canPresent: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/meeting/session/${sessionId}/stage-token`,
          { method: "POST" }
        );
        if (!res.ok) {
          if (!cancelled) onUnavailable();
          return;
        }
        const data = (await res.json()) as {
          token: string;
          url: string;
          canPresent: boolean;
        };
        if (!cancelled) setAuth(data);
      } catch {
        if (!cancelled) onUnavailable();
      }
    };

    const id = window.setTimeout(() => void load(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [sessionId, onUnavailable]);

  if (!auth) {
    return (
      <div className="card grid min-h-72 place-items-center p-8 text-sm text-ink-mute">
        กำลังเชื่อมต่อหน้าจอ…
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={auth.token}
      serverUrl={auth.url}
      connect
      audio={false}
      video={false}
      onError={onUnavailable}
      className="contents"
    >
      <StageSurface canPresent={auth.canPresent} />
    </LiveKitRoom>
  );
}

function StageSurface({ canPresent }: { canPresent: boolean }) {
  const screenShares = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const shown = screenShares[0];
  const [full, setFull] = useState(false);

  return (
    <div
      className={
        full
          ? "fixed inset-0 z-50 flex flex-col gap-3 bg-bg p-4"
          : "flex flex-col gap-3"
      }
    >
      <div
        className={
          "card relative grid place-items-center overflow-hidden p-0 " +
          (full ? "min-h-0 flex-1" : "min-h-72")
        }
      >
        {shown ? (
          <VideoTrack
            trackRef={shown}
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <p className="p-8 text-center text-sm leading-6 text-ink-mute">
            {canPresent
              ? "ยังไม่มีการแชร์หน้าจอ — กดปุ่มด้านล่างเพื่อเริ่มแชร์"
              : "ยังไม่มีการแชร์หน้าจอ รอครูเริ่มได้เลย"}
          </p>
        )}

        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          aria-label={full ? "ออกจากเต็มจอ" : "ขยายเต็มจอ"}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          {full ? (
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <RoomControls canPresent={canPresent} />
    </div>
  );
}

/**
 * The control bar: your microphone, whether you can hear the room, and — for
 * a teacher — the stage.
 *
 * Mute is per-person and always available. A class where a student cannot
 * answer is not a class, and the token grants everyone a microphone; only the
 * stage is the teacher's.
 */
function RoomControls({ canPresent }: { canPresent: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const [micPending, setMicPending] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const micOn = localParticipant.isMicrophoneEnabled;

  const toggleMic = useCallback(async () => {
    setMicPending(true);
    setMicDenied(false);
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
    } catch {
      // Almost always a refused permission prompt rather than a fault.
      setMicDenied(true);
    } finally {
      setMicPending(false);
    }
  }, [localParticipant, micOn]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StateToggle
        on={micOn}
        disabled={micPending}
        onClick={() => void toggleMic()}
        onLabel="ไมค์เปิด"
        offLabel="ไมค์ปิด"
        actionLabel={micOn ? "ปิดไมค์" : "เปิดไมค์"}
        icon={
          micOn ? (
            <Mic className="h-4 w-4" aria-hidden="true" />
          ) : (
            <MicOff className="h-4 w-4" aria-hidden="true" />
          )
        }
      />

      <StateToggle
        on={!deafened}
        onClick={() => setDeafened((v) => !v)}
        onLabel="เสียงเปิด"
        offLabel="เสียงปิด"
        actionLabel={deafened ? "เปิดเสียงห้อง" : "ปิดเสียงห้อง"}
        icon={
          deafened ? (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          )
        }
      />

      {canPresent ? <ShareControl /> : null}

      {micDenied ? (
        <p className="w-full text-sm text-ink-mute">
          เบราว์เซอร์ไม่อนุญาตให้ใช้ไมโครโฟน — ตรวจสิทธิ์ของเว็บไซต์นี้
        </p>
      ) : null}

      {/* Muting playback is local: nothing is unsubscribed, so unmuting is
          instant rather than a reconnect. */}
      <RoomAudioRenderer muted={deafened} />
    </div>
  );
}

/**
 * The teacher's share toggle.
 *
 * Rendered only for someone whose token permits publishing, but the token is
 * the actual gate — this button's absence is a courtesy, not a control.
 */
function ShareControl() {
  const { localParticipant } = useLocalParticipant();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sharing = localParticipant.isScreenShareEnabled;

  const toggle = useCallback(async () => {
    setPending(true);
    setFailed(false);
    try {
      await localParticipant.setScreenShareEnabled(!sharing, { audio: true });
    } catch {
      // Includes the ordinary case of someone dismissing the browser's own
      // picker, which is not worth an alarming message.
      setFailed(true);
    } finally {
      setPending(false);
    }
  }, [localParticipant, sharing]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={sharing}
        className={
          "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 " +
          (sharing
            ? "border-green-500/25 bg-green-50 text-green-700 hover:bg-green-500/10"
            : "border-hairline-strong bg-surface text-ink hover:bg-black/[0.04]")
        }
      >
        {sharing ? (
          <MonitorX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <MonitorUp className="h-4 w-4" aria-hidden="true" />
        )}
        {pending ? "กำลังดำเนินการ…" : sharing ? "กำลังแชร์จอ" : "แชร์หน้าจอ"}
      </button>

      {failed ? (
        <p className="text-sm text-ink-mute">
          ไม่ได้เริ่มแชร์ — อาจกดยกเลิกไป หรือเบราว์เซอร์ไม่อนุญาต
        </p>
      ) : null}
    </div>
  );
}
