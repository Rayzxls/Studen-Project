import type { ReactNode } from "react";

import { UserAvatar } from "@/components/profile/user-avatar";

/**
 * An avatar that grows a green ring while its owner is talking.
 *
 * The ring answers a question a mute button cannot: the microphone says it is
 * on, but is any sound actually leaving this machine. A teacher watching the
 * roster reads it for the room; a person watching their own face reads it for
 * themselves.
 *
 * `ring-offset` in the surface colour keeps the ring legible against the card
 * in every theme rather than merging into the avatar's own edge.
 */
export function SpeakingAvatar({
  userId,
  profileImageId,
  size,
  speaking,
  badge,
}: {
  userId: string;
  profileImageId: string | null;
  size: number;
  speaking: boolean;
  badge?: ReactNode;
}) {
  return (
    <span className="relative shrink-0">
      <UserAvatar
        userId={userId}
        hasImage={profileImageId !== null}
        version={profileImageId}
        size={size}
        alt=""
        className={
          speaking
            ? "ring-2 ring-green-500 ring-offset-2 ring-offset-surface"
            : undefined
        }
      />
      {badge}
    </span>
  );
}
