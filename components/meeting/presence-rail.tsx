"use client";

import { useState } from "react";
import { MicOff, Moon, UserMinus, VolumeX } from "lucide-react";

import {
  NO_MEDIA_STATE,
  type RoomMediaState,
} from "@/components/meeting/room-media";
import { SpeakingAvatar } from "@/components/meeting/speaking-avatar";
import { presenceLabel, type PresenceState } from "@/lib/meeting/presence";
import type { RoomParticipant } from "@/lib/meeting/room";

type ShownState = Exclude<PresenceState, "LEFT">;

/**
 * Who is in the online room, and how present they are (ADR-0053).
 *
 * The badge sits on the avatar rather than beside it because the rail has no
 * horizontal room to spare, and because that is where every reader of Discord
 * already looks for it.
 *
 * Three things this must keep getting right:
 *
 * - The ring around the badge is the surface colour from a theme token, never
 *   a literal white. Hard-coding it puts a white halo on every avatar the
 *   moment someone switches to the dark theme.
 * - Idle is a hollow circle, not a black dot. A black dot on a dark surface is
 *   not a subtle badge, it is an invisible one.
 * - Every badge carries words as well as colour. Green and hollow differ only
 *   by hue, which a screen reader and a colour-blind reader cannot use.
 */
export function PresenceRail({
  participants,
  media = NO_MEDIA_STATE,
  canKick = false,
  selfUserId,
  kickingUserId = null,
  onKick,
}: {
  participants: readonly RoomParticipant[];
  /** Audio state from the stage. All empty when there is no media server. */
  media?: RoomMediaState;
  /** Owning teacher on a LiveKit-backed stage. */
  canKick?: boolean;
  selfUserId?: string;
  kickingUserId?: string | null;
  onKick?: (userId: string) => Promise<boolean>;
}) {
  const [confirmingUserId, setConfirmingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <div>
      <p className="text-xs text-ink-mute">
        {participants.length > 0
          ? `ในห้อง ${participants.length} คน`
          : "ยังไม่มีใครเข้าห้อง"}
      </p>

      <ul className="mt-3 space-y-2.5">
        {participants.map((person) => {
          const name = fullName(person);
          const kickable =
            canKick &&
            !person.isTeacher &&
            person.userId !== selfUserId &&
            Boolean(onKick);
          const confirming = confirmingUserId === person.userId;
          const pending = kickingUserId === person.userId;

          return (
            <li key={person.userId} className="rounded-xl">
              <div className="flex items-center gap-2.5">
                <PresenceAvatar
                  person={person}
                  speaking={media.speaking.includes(person.userId)}
                />
                <span
                  className={
                    "min-w-0 flex-1 truncate text-sm " +
                    (person.state === "ACTIVE" ? "text-ink" : "text-ink-mute")
                  }
                >
                  {name}
                  {person.isTeacher ? (
                    <span className="ml-1.5 text-xs text-ink-mute">ครู</span>
                  ) : null}
                </span>

                <AudioFlags
                  name={name}
                  micOff={media.micOff.includes(person.userId)}
                  deafened={media.deafened.includes(person.userId)}
                />

                {kickable ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      setConfirmingUserId(person.userId);
                    }}
                    disabled={Boolean(kickingUserId)}
                    aria-label={`นำ ${name} ออกจากห้อง`}
                    title={`นำ ${name} ออกจากห้อง`}
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {confirming ? (
                <div className="mt-2 rounded-xl border border-red-500/20 bg-red-50 p-3 text-sm">
                  <p className="font-medium text-red-800">
                    นำ {name} ออกจากห้องนี้?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-red-700">
                    ยังเป็นสมาชิกวิชา และสามารถกดเข้าร่วมใหม่ได้
                  </p>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingUserId(null)}
                      disabled={pending}
                      className="min-h-10 cursor-pointer rounded-full border border-hairline-strong bg-surface px-3 text-xs font-medium text-ink transition-colors duration-200 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!onKick) return;
                        const removed = await onKick(person.userId);
                        if (!removed) return;
                        setConfirmingUserId(null);
                        setFeedback(`นำ ${name} ออกจากห้องแล้ว`);
                      }}
                      disabled={pending}
                      className="min-h-10 cursor-pointer rounded-full border border-red-500/25 bg-red-600 px-3 text-xs font-medium text-white transition-colors duration-200 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pending ? "กำลังนำออก…" : "ยืนยันนำออก"}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {feedback ? (
        <p className="mt-3 text-xs text-ink-mute" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The two things worth knowing about someone's audio at a glance.
 *
 * Shown only when true: a row of icons that is nearly always lit is a row
 * nobody reads. Red, because both mean a channel is closed, and each carries
 * its own words for anyone who cannot use the colour.
 */
function AudioFlags({
  name,
  micOff,
  deafened,
}: {
  name: string;
  micOff: boolean;
  deafened: boolean;
}) {
  if (!micOff && !deafened) return null;

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-red-700">
      {micOff ? (
        <span title={`${name} — ปิดไมค์`}>
          <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{name} ปิดไมค์</span>
        </span>
      ) : null}
      {deafened ? (
        <span title={`${name} — ปิดเสียง ไม่ได้ยินห้อง`}>
          <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{name} ปิดเสียง ไม่ได้ยินห้อง</span>
        </span>
      ) : null}
    </span>
  );
}

function PresenceAvatar({
  person,
  speaking,
}: {
  person: RoomParticipant;
  speaking: boolean;
}) {
  const label =
    `${fullName(person)} — ${presenceLabel(person.state)}` +
    (speaking ? " · กำลังพูด" : "");

  return (
    <span className="relative shrink-0" title={label}>
      <SpeakingAvatar
        userId={person.userId}
        profileImageId={person.profileImageId}
        size={30}
        speaking={speaking}
        badge={<PresenceBadge state={person.state} />}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function PresenceBadge({ state }: { state: ShownState }) {
  if (state === "AWAY") {
    return (
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-surface"
      >
        <Moon className="h-2.5 w-2.5 text-orange-700" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={
        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface " +
        (state === "ACTIVE"
          ? "bg-green-500"
          : "border-2 border-hairline-strong bg-surface")
      }
    />
  );
}

function fullName(person: RoomParticipant): string {
  const name = [person.firstName, person.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return name.length > 0 ? name : "ไม่ทราบชื่อ";
}
