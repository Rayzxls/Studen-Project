"use client";

import { useCallback, useState } from "react";
import { DoorOpen, Video } from "lucide-react";

import { PresenceRail } from "@/components/meeting/presence-rail";
import {
  NO_MEDIA_STATE,
  type RoomMediaState,
} from "@/components/meeting/room-media";
import { Stage } from "@/components/meeting/stage";
import { useLiveRoom } from "@/components/meeting/use-live-room";

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
  const {
    room,
    busy,
    error,
    blockedUrl,
    open,
    join,
    leave,
    markPresent,
    intent,
  } = useLiveRoom(courseId);
  const [media, setMedia] = useState<RoomMediaState>(NO_MEDIA_STATE);
  // The chat lives in the rail but needs the stage's connection, so the rail
  // lends it a node to draw into rather than moving into the stage.
  const [chatSlot, setChatSlot] = useState<HTMLDivElement | null>(null);
  // Stable so the reporter's effect fires on a real change, not every render.
  const onMediaChange = useCallback(
    (next: RoomMediaState) => setMedia(next),
    []
  );

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

  /**
   * Whether this person is in the room, and it is a decision rather than a
   * lookup.
   *
   * What this browser last asked for wins, because the poll is up to three
   * seconds behind: a response already in flight when Leave is pressed would
   * otherwise report them present and walk them straight back in. Only when
   * nothing has been asked does the server's answer stand — which is what lets
   * a reload drop someone back into the room they were already in, instead of
   * making them knock twice.
   *
   * Opening a room counts as asking: a teacher who just opened it is in it.
   */
  const presentOnServer = room.participants.some(
    (p) => p.userId === self.userId
  );
  const inRoom = intent === null ? presentOnServer : intent === "in";

  const selfPanel = {
    self,
    inRoom,
    speaking: media.speaking.includes(self.userId),
    busy,
    onEnter: join,
    onLeave: leave,
    /* With a stage there is nowhere to go back to — the room is on this page.
       Without one the button still earns its place: being counted in the room
       says nothing about whether the Meet tab is still open. */
    showEnter: !inRoom || !stageEnabled,
    /* Leaving is only meaningful while you are in. */
    showLeave: inRoom,
  };

  return (
    // The browser floats its sharing notice across the bottom centre of the
    // screen while a teacher is presenting, and no page can move it. Scrolled
    // to the end, that lands squarely on the device controls. The room keeps a
    // band clear at the bottom so the browser's bar has somewhere to sit that
    // is not on top of the buttons.
    <div className="grid gap-4 pb-20 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Stage
          sessionId={room.sessionId}
          /* Nobody is connected to anything until they ask to be. A page that
             puts a student into a live room simply because they opened the tab
             has taken a decision that is theirs — ADR-0053 has Join as a press,
             and a microphone that joins a class unbidden is the reason why. */
          enabled={stageEnabled && inRoom}
          onMediaChange={onMediaChange}
          /* Connecting to the stage is entering the room. Without this a person
             could hear and be heard while the roster still said they were
             absent. */
          onConnected={markPresent}
          selfPanel={selfPanel}
          chatContainer={chatSlot}
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
        <PresenceRail participants={room.participants} media={media} />
        <div ref={setChatSlot} />
      </aside>
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
