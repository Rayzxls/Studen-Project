/**
 * UserAvatar — Phase 13. One avatar affordance for the whole app.
 *
 * `hasImage` tells the component whether the user has a custom avatar
 * (callers select `profileImageId` and pass its truthiness) — custom
 * avatars stream through /api/profile-image/[userId] (auth-gated, signed
 * URL under the hood), everyone else gets the shared default beagle.
 *
 * Plain <img>, not next/image: the API URL is cookie-gated, and the Next
 * image optimizer fetches server-side without the session cookie, which
 * would 401 every custom avatar.
 *
 * `version` is a cache-buster — the serving URL is stable per user, so the
 * browser would otherwise keep showing the old avatar (cached up to the
 * route's max-age) after a change. Callers pass the current
 * `profileImageId`; a new attachment id => new URL => the new image loads
 * immediately, while unchanged avatars stay cacheable.
 */
export function UserAvatar({
  userId,
  hasImage,
  version,
  size = 32,
  className,
  alt = "",
}: {
  userId: string;
  hasImage: boolean;
  version?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const src = hasImage
    ? `/api/profile-image/${userId}` +
      (version ? `?v=${encodeURIComponent(version)}` : "")
    : "/images/default-avatar.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth-gated API src; optimizer can't carry the session cookie
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={
        "shrink-0 rounded-full bg-blue-50 object-cover ring-1 ring-black/[0.06]" +
        (className ? " " + className : "")
      }
      style={{ width: size, height: size }}
    />
  );
}
