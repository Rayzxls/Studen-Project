import { Moon } from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
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
}: {
  participants: readonly RoomParticipant[];
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
            <PresenceAvatar person={person} />
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
          </li>
        ))}
      </ul>
    </div>
  );
}

function PresenceAvatar({ person }: { person: RoomParticipant }) {
  const label = `${fullName(person)} — ${presenceLabel(person.state)}`;

  return (
    <span className="relative shrink-0" title={label}>
      <UserAvatar
        userId={person.userId}
        hasImage={person.profileImageId !== null}
        version={person.profileImageId}
        size={30}
        alt=""
      />
      <PresenceBadge state={person.state} />
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
