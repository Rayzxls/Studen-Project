"use client";

import { DoorOpen, Video } from "lucide-react";

import { PresenceRail } from "@/components/meeting/presence-rail";
import { Stage } from "@/components/meeting/stage";
import { useLiveRoom } from "@/components/meeting/use-live-room";
import { UserAvatar } from "@/components/profile/user-avatar";

/**
 * The online room, as a room rather than a card (ADR-0053).
 *
 * The shape the owner drew: a stage across the middle, who is here down the
 * right, and your own controls at the bottom left. Every part of it is real
 * except the stage, which stays a placeholder until there is a media server to
 * fill it — the layout exists so that filling it changes one region and
 * nothing else.
 *
 * Right rail rather than left for both the roster and, later, chat: Zoom, Meet
 * and Teams all put the side panel on the right, and Discord keeps its member
 * list there too. What lives on the left in every one of them is navigation,
 * and a room entered from inside a single course has nothing to navigate.
 */
export function RoomWorkspace({
  courseId,
  isTeacher,
  stageEnabled,
  self,
}: {
  courseId: string;
  isTeacher: boolean;
  /** Whether a media server is configured. Says nothing about credentials. */
  stageEnabled: boolean;
  self: {
    userId: string;
    name: string;
    profileImageId: string | null;
  };
}) {
  const { room, busy, error, blockedUrl, open, join } = useLiveRoom(courseId);

  if (!room) {
    return (
      <div className="card grid min-h-64 place-items-center p-8 text-sm text-ink-mute">
        กำลังตรวจสอบห้องเรียน…
      </div>
    );
  }

  if (!room.isOpen) {
    return (
      <ClosedRoom
        isTeacher={isTeacher}
        canStart={room.hasMeetingLink || stageEnabled}
        busy={busy}
        error={error}
        blockedUrl={blockedUrl}
        onOpen={open}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Stage sessionId={room.sessionId} enabled={stageEnabled} />
        <SelfPanel
          self={self}
          inRoom={room.participants.some((p) => p.userId === self.userId)}
          busy={busy}
          onEnter={join}
        />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {blockedUrl ? (
          <p className="text-sm text-ink-soft">
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

      <aside className="card p-4 lg:sticky lg:top-24 lg:h-fit">
        <PresenceRail participants={room.participants} />
      </aside>
    </div>
  );
}

/**
 * Your own strip: who you are, and the controls that act on you.
 *
 * Bottom-left because that is where Discord puts it, and because the thing it
 * really carries is device control rather than identity — the name is there so
 * you know which account is about to walk into a room full of children.
 */
function SelfPanel({
  self,
  inRoom,
  busy,
  onEnter,
}: {
  self: { userId: string; name: string; profileImageId: string | null };
  inRoom: boolean;
  busy: boolean;
  onEnter: () => void;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <UserAvatar
        userId={self.userId}
        hasImage={self.profileImageId !== null}
        version={self.profileImageId}
        size={36}
        alt=""
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{self.name}</p>
        <p className="text-xs text-ink-mute">
          {inRoom ? "อยู่ในห้องแล้ว" : "ยังไม่ได้เข้าห้อง"}
        </p>
      </div>

      <button
        type="button"
        onClick={onEnter}
        disabled={busy}
        className="btn-primary ml-auto min-h-11"
      >
        <Video className="h-4 w-4" aria-hidden="true" />
        {busy ? "กำลังเข้าห้อง…" : inRoom ? "กลับเข้าห้อง" : "เข้าห้องเรียน"}
      </button>
    </div>
  );
}

function ClosedRoom({
  isTeacher,
  canStart,
  busy,
  error,
  blockedUrl,
  onOpen,
}: {
  isTeacher: boolean;
  /** A stage of our own is enough; without one a meeting link is required. */
  canStart: boolean;
  busy: boolean;
  error: string | null;
  blockedUrl: string | null;
  onOpen: () => void;
}) {
  if (!isTeacher) {
    return (
      <div className="card grid min-h-64 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Video className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-base font-medium text-ink">
            ยังไม่มีห้องเปิดอยู่ตอนนี้
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-mute">
            เมื่อครูเปิดห้อง ปุ่มเข้าห้องจะขึ้นที่นี่ และคุณจะได้รับแจ้งเตือน
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card grid min-h-64 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <DoorOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-base font-medium text-ink">
          {canStart ? "พร้อมเปิดห้องเรียน" : "ยังตั้งลิงก์ห้องประชุมไม่ครบ"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-mute">
          {canStart
            ? "กดครั้งเดียว — ห้องเปิด นักเรียนได้รับแจ้งเตือน และคุณเข้าห้องทันที"
            : "ตั้งลิงก์ด้านล่างก่อน ตั้งครั้งเดียวใช้ได้ทั้งเทอม"}
        </p>

        {canStart ? (
          <button
            type="button"
            onClick={onOpen}
            disabled={busy}
            className="btn-primary mt-5 min-h-11"
          >
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
            {busy ? "กำลังเปิดห้อง…" : "เปิดห้องเรียนออนไลน์"}
          </button>
        ) : null}

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
    </div>
  );
}
