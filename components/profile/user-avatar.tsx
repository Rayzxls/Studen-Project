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
 */
export function UserAvatar({
  userId,
  hasImage,
  size = 32,
  className,
  alt = "",
}: {
  userId: string;
  hasImage: boolean;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const src = hasImage
    ? `/api/profile-image/${userId}`
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
