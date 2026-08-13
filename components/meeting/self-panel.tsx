"use client";

import type { ReactNode } from "react";
import { LogOut, Video } from "lucide-react";

import { SpeakingAvatar } from "@/components/meeting/speaking-avatar";

/**
 * Your own strip: who you are, and the controls that act on you.
 *
 * Bottom-left because that is where Discord puts it, and because what it
 * really carries is device control — the name is on it so you can see which
 * account is about to walk into a room full of children.
 *
 * `controls` is a slot rather than something this component builds, because
 * microphone and screen share only exist inside the stage's connection. When
 * there is no stage the panel is still here, just without them.
 */
export function SelfPanel({
  self,
  inRoom,
  speaking,
  busy,
  onEnter,
  onLeave,
  showEnter,
  showLeave,
  controls,
}: {
  self: { userId: string; name: string; profileImageId: string | null };
  inRoom: boolean;
  speaking: boolean;
  busy?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  /** A button offering to put you where you already are makes a reader doubt. */
  showEnter: boolean;
  /** The way out. Only meaningful while you are in. */
  showLeave?: boolean;
  controls?: ReactNode;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
      <SpeakingAvatar
        userId={self.userId}
        profileImageId={self.profileImageId}
        size={36}
        speaking={speaking}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{self.name}</p>
        <p className="text-xs text-ink-mute">
          {speaking
            ? "กำลังพูด"
            : inRoom
              ? "อยู่ในห้องแล้ว"
              : "ยังไม่ได้เข้าห้อง"}
        </p>
      </div>

      {controls ? <div className="ml-auto">{controls}</div> : null}

      {showEnter && onEnter ? (
        <button
          type="button"
          onClick={onEnter}
          disabled={busy}
          className={
            "btn-primary min-h-11 " + (controls || showLeave ? "" : "ml-auto")
          }
        >
          <Video className="h-4 w-4" aria-hidden="true" />
          {busy
            ? "กำลังเข้าห้อง…"
            : inRoom
              ? "กลับเข้าห้อง"
              : "เข้าร่วมห้องเรียน"}
        </button>
      ) : null}

      {/* Quiet rather than primary: leaving is always available but it is never
          the thing someone came here to do, and a red button beside a lesson
          reads as an emergency. */}
      {showLeave && onLeave ? (
        <button
          type="button"
          onClick={onLeave}
          disabled={busy}
          className={
            "inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-red-500/10 hover:text-red-700 disabled:opacity-60 " +
            (controls || showEnter ? "" : "ml-auto")
          }
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          ออกจากห้อง
        </button>
      ) : null}
    </div>
  );
}
