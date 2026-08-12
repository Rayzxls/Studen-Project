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
import { MonitorUp, MonitorX } from "lucide-react";

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
    canPublish: boolean;
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
          canPublish: boolean;
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
      <StageSurface canPublish={auth.canPublish} />
      {/* Audio from anyone who publishes it. Silent until someone does. */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function StageSurface({ canPublish }: { canPublish: boolean }) {
  const screenShares = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const shown = screenShares[0];

  return (
    <div className="space-y-3">
      <div className="card relative grid min-h-72 place-items-center overflow-hidden p-0">
        {shown ? (
          <VideoTrack
            trackRef={shown}
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <p className="p-8 text-center text-sm leading-6 text-ink-mute">
            {canPublish
              ? "ยังไม่มีการแชร์หน้าจอ — กดปุ่มด้านล่างเพื่อเริ่มแชร์"
              : "ยังไม่มีการแชร์หน้าจอ รอครูเริ่มได้เลย"}
          </p>
        )}
      </div>

      {canPublish ? <ShareControl /> : null}
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
        className={sharing ? "btn-secondary min-h-11" : "btn-primary min-h-11"}
      >
        {sharing ? (
          <MonitorX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <MonitorUp className="h-4 w-4" aria-hidden="true" />
        )}
        {pending
          ? "กำลังดำเนินการ…"
          : sharing
            ? "หยุดแชร์หน้าจอ"
            : "แชร์หน้าจอ"}
      </button>

      {failed ? (
        <p className="text-sm text-ink-mute">
          ไม่ได้เริ่มแชร์ — อาจกดยกเลิกไป หรือเบราว์เซอร์ไม่อนุญาต
        </p>
      ) : null}
    </div>
  );
}
