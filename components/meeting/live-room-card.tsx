"use client";

import { useActionState } from "react";
import { DoorOpen, Video } from "lucide-react";

import { PresenceRail } from "@/components/meeting/presence-rail";
import { useLiveRoom } from "@/components/meeting/use-live-room";
import type { RoomActionState } from "@/app/teacher/courses/[id]/meeting/actions";

/** The shape both teacher controls share. Absent for a student. */
export type RoomAction = (
  prev: RoomActionState,
  formData: FormData
) => Promise<RoomActionState>;

const NO_STATE: RoomActionState = {};

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
  const { room, busy, error, blockedUrl, open, join } = useLiveRoom(courseId);

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
            onClick={open}
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
          {blockedUrl ? (
            <p className="mt-3 text-sm text-ink-soft">
              เบราว์เซอร์บล็อกการเปิดแท็บใหม่ —{" "}
              <a
                href={blockedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline underline-offset-2"
              >
                เปิดห้อง Meet
              </a>
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
              onClick={join}
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
                sessionId={room.sessionId}
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
          {blockedUrl ? (
            <p className="mt-3 text-sm text-ink-soft">
              เบราว์เซอร์บล็อกการเปิดแท็บใหม่ —{" "}
              <a
                href={blockedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline underline-offset-2"
              >
                เปิดห้อง Meet
              </a>
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
