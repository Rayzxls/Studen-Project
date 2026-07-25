/**
 * Server-side session revocation (Release D). Every JWT carries the account's
 * `sessionVersion` from when it was issued; bumping the column in the database
 * invalidates every token minted before the bump. The comparison lives here so
 * it stays pure and can be unit-tested, while the enforcing DB read lives in
 * `requireAuth`.
 *
 * A token minted before this field existed carries no version; it is treated as
 * version 0 so it keeps working against an un-bumped account (default 0) and is
 * revoked the moment that account is bumped.
 */
export function isSessionRevoked(
  tokenVersion: number | undefined,
  currentVersion: number
): boolean {
  return (tokenVersion ?? 0) !== currentVersion;
}
