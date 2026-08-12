"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DoorOpen, Video } from "lucide-react";

import { PresenceRail } from "@/components/meeting/presence-rail";
import type { RoomActionState } from "@/app/teacher/courses/[id]/meeting/actions";
import type { RoomState } from "@/lib/meeting/room";

/** The shape both teacher controls share. Absent for a student. */
export type RoomAction = (
  prev: RoomActionState,
  formData: FormData
) => Promise<RoomActionState>;

const NO_STATE: RoomActionState = {};

/** Matches the cadence the room was designed around (ADR-0053). */
const POLL_MS = 3_000;

interface WireRoomState extends Omit<RoomState, "openedAt"> {
  openedAt: string | null;
}

/**
 * The live online room, as it appears on a course page (ADR-0053).
 *
 * Polls rather than holding a socket, because Vercel functions cannot hold one
 * and three seconds is indistinguishable from immediate to a person waiting
 * for a class to start.
 *
 * The heartbeat is separate from the poll and only runs once this person has
 * joined: a tab left open on a course page must not put someone in a room they
 * never entered.
 */
export function LiveRoomCard({
  courseId,
  isTeacher,
  canOpen = false,
  closeAction,
  showWhenClosed = false,
}: {
  courseId: string;
  isTeacher: boolean;
  /** Teacher-only, and only where starting a class belongs. */
  canOpen?: boolean;
  closeAction?: RoomAction;
  /**
   * On its own tab the card is the whole page, so a shut room has to say so.
   * Embedded on an overview it stays silent instead, because a card that only
   * ever says "nothing is happening" is a card people learn to skip.
   */
  showWhenClosed?: boolean;
}) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasJoined = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting/course/${courseId}/state`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const wire = (await res.json()) as WireRoomState;
      setRoom({
        ...wire,
        openedAt: wire.openedAt ? new Date(wire.openedAt) : null,
      });
    } catch {
      // A dropped poll is not worth telling anyone about; the next one is
      // three seconds away and the card simply shows its last known state.
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void poll();
    };
    // Deferred rather than called in the effect body: the first read still
    // lands within a frame, and the effect itself no longer sets state.
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [poll]);

  const sessionId = room?.sessionId ?? null;

  // Heartbeat. `document.hasFocus()` rather than `visibilityState` because the
  // hollow badge means "looking at something else", which includes another
  // window on top of this one, not only another tab.
  useEffect(() => {
    if (!sessionId) return;

    const beat = () => {
      if (!hasJoined.current) return;
      void fetch(`/api/meeting/session/${sessionId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focused: document.hasFocus() }),
        keepalive: true,
      }).catch(() => {
        // Same as the poll: silence is the right response to one lost beat.
      });
    };

    beat();
    const id = window.setInterval(beat, POLL_MS);
    // A hidden tab has its timer throttled to roughly once a minute, so send
    // one immediately on the switch. Without it the badge lags by up to a
    // minute at exactly the moment it should change.
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("focus", beat);
    window.addEventListener("blur", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("focus", beat);
      window.removeEventListener("blur", beat);
    };
  }, [sessionId]);

  /**
   * Walk into Meet.
   *
   * `endpoint` is the only difference between a student joining a room that is
   * already open and a teacher opening one — both end with the same tab going
   * to the same URL, which is the point: one press, then you are in the class.
   */
  async function enterRoom(endpoint: string, failure: string) {
    if (busy) return;
    setBusy(true);
    setError(null);

    // Opened synchronously on the click. A tab opened after the await is a
    // popup as far as the browser is concerned, and gets blocked.
    const tab = window.open("", "_blank", "noopener,noreferrer");

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        tab?.close();
        setError(failure);
        return;
      }
      const { meetingUrl } = (await res.json()) as { meetingUrl: string };
      hasJoined.current = true;
      if (tab) tab.location.href = meetingUrl;
      else window.location.href = meetingUrl;
      void poll();
    } catch {
      tab?.close();
      setError("ทำรายการไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  if (!room) return null;

  if (!room.isOpen) {
    if (isTeacher && canOpen) {
      // No link means opening can only fail. Say so instead of offering the
      // button and answering with an error after the press.
      if (!room.hasMeetingLink) {
        return (
          <section className="card p-5 sm:p-6">
            <Header subtitle="ตั้งลิงก์ห้องประชุมของวิชานี้ก่อน แล้วปุ่มเปิดห้องจะขึ้นที่นี่ · ตั้งครั้งเดียวใช้ได้ทั้งเทอม" />
          </section>
        );
      }

      return (
        <section className="card p-5 sm:p-6">
          <Header subtitle="กดครั้งเดียว — ห้องเปิด นักเรียนได้รับแจ้งเตือน และคุณเข้า Meet ทันที" />
          <button
            type="button"
            onClick={() =>
              void enterRoom(
                `/api/meeting/course/${courseId}/open`,
                "เปิดห้องไม่สำเร็จ กรุณาลองใหม่"
              )
            }
            disabled={busy}
            className="btn-primary mt-4 min-h-11"
          >
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
            {busy ? "กำลังเปิดห้อง…" : "เปิดห้องเรียนออนไลน์"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      );
    }

    if (!showWhenClosed) return null;

    return (
      <section className="card p-5 sm:p-6">
        <Header subtitle="ยังไม่มีห้องเปิดอยู่ตอนนี้ เมื่อครูเปิดห้อง ปุ่มเข้าห้องจะขึ้นที่นี่และคุณจะได้รับแจ้งเตือน" />
      </section>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <Header subtitle="ครูเปิดห้องเรียนออนไลน์อยู่ตอนนี้" live />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void enterRoom(
                  `/api/meeting/session/${sessionId}/join`,
                  "เข้าห้องไม่ได้ ห้องอาจถูกปิดไปแล้ว"
                )
              }
              disabled={busy}
              className="btn-primary min-h-11"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              {busy ? "กำลังเข้าห้อง…" : "เข้าห้องเรียน"}
            </button>

            {isTeacher && closeAction ? (
              <RoomControl
                action={closeAction}
                courseId={courseId}
                sessionId={sessionId}
                className="btn-secondary min-h-11"
                label="ปิดห้อง"
                pendingLabel="กำลังปิด…"
              />
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="md:w-56 md:shrink-0 md:border-l md:border-hairline md:pl-5">
          <PresenceRail participants={room.participants} />
        </div>
      </div>
    </section>
  );
}

/**
 * A teacher control as a real form, so it still works before hydration and a
 * failed action can say why.
 */
function RoomControl({
  action,
  courseId,
  sessionId,
  className,
  label,
  pendingLabel,
  icon,
}: {
  action: RoomAction;
  courseId: string;
  sessionId: string | null;
  className: string;
  label: string;
  pendingLabel: string;
  icon?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, NO_STATE);
  const message = state.fieldErrors?.room ?? state.error ?? null;

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="courseId" value={courseId} />
      {sessionId ? (
        <input type="hidden" name="sessionId" value={sessionId} />
      ) : null}
      <button type="submit" disabled={pending} className={className}>
        {icon}
        {pending ? pendingLabel : label}
      </button>
      {message ? (
        <p className="mt-2 w-full text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function Header({ subtitle, live }: { subtitle: string; live?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
        <Video className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          ห้องเรียนออนไลน์
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-green-500"
              />
              เปิดอยู่
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-sm leading-6 text-ink-mute">{subtitle}</p>
      </div>
    </div>
  );
}
