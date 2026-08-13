"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { DisconnectReason, RoomEvent, Track } from "livekit-client";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  MonitorX,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import { StateToggle } from "@/components/meeting/state-toggle";
import type { RoomMediaState } from "@/components/meeting/room-media";
import { RoomChat } from "@/components/meeting/room-chat";
import { SelfPanel } from "@/components/meeting/self-panel";
import { SharingBar } from "@/components/meeting/sharing-bar";
import { playSound } from "@/components/meeting/room-sounds";
import { useRoomSounds } from "@/components/meeting/use-room-sounds";
import { useStageFullscreen } from "@/components/meeting/use-stage-fullscreen";
import {
  useScreenShare,
  type ScreenShare,
} from "@/components/meeting/use-screen-share";
import type { ComponentProps } from "react";

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
  onMediaChange,
  onConnected,
  onRemoved,
  selfPanel,
  chatContainer,
}: {
  sessionId: string;
  onUnavailable: () => void;
  /**
   * What the roster needs, by our own user id — the token sets LiveKit's
   * identity to it, so no mapping is needed. Reported upward because the
   * roster and the self panel live outside this context.
   */
  onMediaChange?: (state: RoomMediaState) => void;
  /** Fired once the stage is live — connecting is how you enter the room. */
  onConnected?: () => void;
  /** Fired when the teacher removes this participant through LiveKit. */
  onRemoved?: () => void;
  selfPanel: ComponentProps<typeof SelfPanel>;
  /** Where the chat panel should appear — a node in the right rail. */
  chatContainer?: HTMLElement | null;
}) {
  const [auth, setAuth] = useState<{
    token: string;
    url: string;
    canPresent: boolean;
  } | null>(null);

  /**
   * The callback is a way to report a failure, not an input to the request.
   *
   * Holding it in a ref is what keeps the session the effect's only real
   * dependency. With it in the dependency array, an inline arrow from the
   * caller re-ran the whole effect on every render — and the room re-renders
   * every three seconds, because the state poll always sets a fresh object.
   * Production was minting a LiveKit access token per participant per three
   * seconds, each one a signed credential good for three hours, and handing
   * `LiveKitRoom` a new `token` prop at the same cadence.
   */
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/meeting/session/${sessionId}/stage-token`,
          { method: "POST" }
        );
        if (!res.ok) {
          if (!cancelled) onUnavailableRef.current();
          return;
        }
        const data = (await res.json()) as {
          token: string;
          url: string;
          canPresent: boolean;
        };
        if (!cancelled) setAuth(data);
      } catch {
        if (!cancelled) onUnavailableRef.current();
      }
    };

    const id = window.setTimeout(() => void load(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [sessionId]);

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
      onConnected={onConnected}
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) onRemoved?.();
      }}
      onError={onUnavailable}
      className="contents"
    >
      <StageSurface
        canPresent={auth.canPresent}
        onMediaChange={onMediaChange}
        selfPanel={selfPanel}
      />
      {/* Rendered here for the connection, drawn in the rail through a portal
          (ADR-0055). */}
      <RoomChat container={chatContainer ?? null} />
    </LiveKitRoom>
  );
}

function StageSurface({
  canPresent,
  onMediaChange,
  selfPanel,
}: {
  canPresent: boolean;
  onMediaChange?: (state: RoomMediaState) => void;
  selfPanel: ComponentProps<typeof SelfPanel>;
}) {
  const screenShares = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const shown = screenShares[0];
  const [deafened, setDeafened] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { active, native, toggle } = useStageFullscreen(surfaceRef);
  // Owned here rather than in the button, because the standing bar acts on the
  // same share and two copies of this state would disagree the moment either
  // one was pressed.
  const share = useScreenShare();
  // Arrivals, departures and the screen going up — heard by everyone in the
  // room, each browser making its own noise from the same event.
  useRoomSounds({ deafened });

  // The controls belong to whichever panel is on screen, so build them once
  // rather than letting the two branches drift apart.
  const controls = (
    <RoomControls
      canPresent={canPresent}
      deafened={deafened}
      setDeafened={setDeafened}
      share={share}
    />
  );

  const surface = (
    <div
      ref={surfaceRef}
      className={
        active
          ? // Native fullscreen is already sized and placed by the browser; the
            // fallback has to cover the viewport itself, in dvh so a phone's
            // collapsing address bar cannot crop the bottom off.
            "flex flex-col bg-black " +
            (native
              ? "h-full w-full"
              : "fixed inset-0 z-50 h-[100dvh] w-screen")
          : "flex flex-col gap-3"
      }
    >
      <div
        className={
          "relative grid place-items-center overflow-hidden " +
          (active
            ? // Edge to edge: no card, no radius, no padding. A shared 16:9
              // screen then lands on a 16:9 display at its full size, which is
              // the whole point of asking for the screen.
              "min-h-0 flex-1 bg-black"
            : "card min-h-[58vh] p-0 lg:min-h-[62vh]")
        }
      >
        {shown ? (
          <VideoTrack
            trackRef={shown}
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <p
            className={
              "p-8 text-center text-sm leading-6 " +
              (active ? "text-white/70" : "text-ink-mute")
            }
          >
            {canPresent
              ? "ยังไม่มีการแชร์หน้าจอ — กดปุ่มด้านล่างเพื่อเริ่มแชร์"
              : "บัญชีนี้ไม่ได้รับสิทธิ์แชร์หน้าจอ"}
          </p>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-label={active ? "ออกจากเต็มจอ" : "ขยายเต็มจอ"}
          className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          {active ? (
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Fullscreen means the share gets the screen, so the strip floats over
            it rather than taking a slice of the height for itself. */}
        {active ? (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-3 pt-12">
            <div className="mx-auto w-full max-w-4xl">
              <SelfPanel {...selfPanel} controls={controls} />
            </div>
          </div>
        ) : null}
      </div>

      {/* The controls live in the self panel: they act on you, and that is
          where your own face already is. */}
      {active ? null : <SelfPanel {...selfPanel} controls={controls} />}

      {/* Follows the presenter around the page while a share is running, because
          the room tab is not where a lesson is spent and stopping should never
          need hunting for. Fullscreen already carries the same controls over
          the video, so it does not need a second copy. */}
      {canPresent ? <SharingBar share={share} hidden={active} /> : null}

      {onMediaChange ? (
        <MediaReporter deafened={deafened} onChange={onMediaChange} />
      ) : null}
    </div>
  );

  // Only the fallback moves in the DOM, and only to escape the containing block
  // that `<main class="animate-fade-in">` creates — see use-stage-fullscreen.
  // The move re-attaches the video element once; the track itself lives on the
  // Room, not the DOM, so the media does not drop.
  return active && !native ? createPortal(surface, document.body) : surface;
}

/**
 * The control bar: your microphone, whether you can hear the room, and — for
 * any room member — the shared stage.
 *
 * Mute is per-person and always available. A class where a student cannot
 * answer is not a class, and the token grants everyone a microphone; only the
 * stage is available to every active room member without an approval step.
 */
function RoomControls({
  canPresent,
  deafened,
  setDeafened,
  share,
}: {
  canPresent: boolean;
  deafened: boolean;
  setDeafened: (next: (v: boolean) => boolean) => void;
  /** Owned above, because the standing bar acts on the same share. */
  share: ScreenShare;
}) {
  const { localParticipant } = useLocalParticipant();
  const [micPending, setMicPending] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const micOn = localParticipant.isMicrophoneEnabled;

  const toggleMic = useCallback(async () => {
    setMicPending(true);
    setMicDenied(false);
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
      // Yours alone, and only once it actually happened: a chirp for a
      // microphone that stayed off would be a lie about the thing that decides
      // whether a class can hear you.
      playSound(micOn ? "mic-off" : "mic-on");
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
        onClick={() => {
          // Plays even while deafening. Room sounds go quiet when your ears
          // are shut, but the button that shut them still has to answer, or
          // pressing it is indistinguishable from pressing nothing.
          playSound(deafened ? "ears-on" : "ears-off");
          setDeafened((v) => !v);
        }}
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

      {canPresent ? <ShareControl share={share} /> : null}

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
 * Carries what the roster needs out of the LiveKit context, and publishes the
 * one piece of it that only this browser knows.
 *
 * Speaking and a muted microphone are LiveKit's own facts — every participant
 * learns them without anyone announcing anything. **Deafening is not.** Muting
 * playback happens entirely inside one browser, so unless it is published as a
 * participant attribute the rest of the class has no way to know somebody
 * cannot hear them. That is the whole reason this component writes as well as
 * reads.
 *
 * Renders nothing. Each set is compared as a joined string before reporting,
 * or the ordinary case of one person still talking would re-render the room
 * several times a second.
 */
function MediaReporter({
  deafened,
  onChange,
}: {
  deafened: boolean;
  onChange: (state: RoomMediaState) => void;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [, bump] = useState(0);

  useEffect(() => {
    // Best-effort: failing to announce it only costs the icon, never the call.
    void localParticipant
      .setAttributes({ deafened: deafened ? "1" : "" })
      .catch(() => {});
  }, [localParticipant, deafened]);

  // useParticipants does not re-render on an attribute change, so a remote
  // person going deaf would otherwise never reach the roster. Nudge on the
  // event that carries it.
  useEffect(() => {
    const onChanged = () => bump((n) => n + 1);
    room.on(RoomEvent.ParticipantAttributesChanged, onChanged);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onChanged);
    };
  }, [room]);

  const speaking = participants
    .filter((p) => p.isSpeaking)
    .map((p) => p.identity)
    .sort()
    .join(",");
  const micOff = participants
    .filter((p) => !p.isMicrophoneEnabled)
    .map((p) => p.identity)
    .sort()
    .join(",");
  // Our own state is read straight from React rather than from the attribute
  // we just published. A round trip through the server to learn something this
  // browser already knows would make the icon lag its own button, or miss it
  // entirely if the publish failed.
  const deaf = participants
    .filter((p) =>
      p.identity === localParticipant.identity
        ? deafened
        : p.attributes?.deafened === "1"
    )
    .map((p) => p.identity)
    .sort()
    .join(",");

  useEffect(() => {
    const split = (value: string) => (value.length > 0 ? value.split(",") : []);
    onChange({
      speaking: split(speaking),
      micOff: split(micOff),
      deafened: split(deaf),
    });
  }, [speaking, micOff, deaf, onChange]);

  return null;
}

/**
 * This participant's share toggle.
 *
 * Rendered only for someone whose token permits publishing, but the token is
 * the actual gate — this button's absence is a courtesy, not a control.
 */
function ShareControl({ share }: { share: ScreenShare }) {
  const { sharing, pending, failed, toggle, switchSource } = share;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={sharing}
        className={
          "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 " +
          (sharing
            ? // Red and a verb, because while a share is running this is the
              // stop button — the one the browser also offers from its own bar,
              // which cannot be removed but can at least be ignored.
              "border-red-500/25 bg-red-50 text-red-700 hover:bg-red-500/10"
            : "border-hairline-strong bg-surface text-ink hover:bg-black/[0.04]")
        }
      >
        {sharing ? (
          <MonitorX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <MonitorUp className="h-4 w-4" aria-hidden="true" />
        )}
        {/* The device toggles beside this one show their state; this one shows
            its verb. It is an action with a consequence, not a mode to read at
            a glance, and "กำลังแชร์จอ" left the only way to stop looking like a
            label. */}
        {pending
          ? "กำลังดำเนินการ…"
          : sharing
            ? "หยุดแชร์หน้าจอ"
            : "แชร์หน้าจอ"}
      </button>

      {/* Changing what you share should not mean stopping and starting again:
          the picker opens over the running share, and dismissing it leaves the
          class looking at exactly what they were looking at. */}
      {sharing ? (
        <button
          type="button"
          onClick={switchSource}
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          เปลี่ยนหน้าจอ
        </button>
      ) : null}

      {failed ? (
        <p className="text-sm text-ink-mute">
          {/* Still sharing means the attempt was a swap that did not happen, and
              saying "ไม่ได้เริ่มแชร์" to someone who is plainly still sharing
              reads as a fault rather than a cancelled dialog. */}
          {sharing
            ? "ไม่ได้เปลี่ยนหน้าจอ — ยังแชร์อันเดิมอยู่"
            : "ไม่ได้เริ่มแชร์ — อาจกดยกเลิกไป หรือเบราว์เซอร์ไม่อนุญาต"}
        </p>
      ) : null}
    </div>
  );
}
