import { MicOff, Moon, VolumeX } from "lucide-react";

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
}: {
  participants: readonly RoomParticipant[];
  /** Audio state from the stage. All empty when there is no media server. */
  media?: RoomMediaState;
}) {
  return (
    <div>
      <p className="text-xs text-ink-mute">
        {participants.length > 0
          ? `ในห้อง ${participants.length} คน`
          : "ยังไม่มีใครเข้าห้อง"}
      </p>

      <ul className="mt-3 space-y-2.5">
        {participants.map((person) => (
          <li key={person.userId} className="flex items-center gap-2.5">
            <PresenceAvatar
              person={person}
              speaking={media.speaking.includes(person.userId)}
            />
            <span
              className={
                "min-w-0 truncate text-sm " +
                (person.state === "ACTIVE" ? "text-ink" : "text-ink-mute")
              }
            >
              {fullName(person)}
              {person.isTeacher ? (
                <span className="ml-1.5 text-xs text-ink-mute">ครู</span>
              ) : null}
            </span>

            <AudioFlags
              name={fullName(person)}
              micOff={media.micOff.includes(person.userId)}
              deafened={media.deafened.includes(person.userId)}
            />
          </li>
        ))}
      </ul>
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
