/**
 * Session lifetime policy (Release D identity decision, locked 2026-07-24).
 *
 * Two independent windows govern a JWT session:
 *   - inactivity: a session dies after 7 continuous days without activity;
 *   - absolute cap: a session can never live past 30 days from sign-in, no
 *     matter how active the device has been.
 *
 * NextAuth's `maxAge` gives the sliding inactivity window on its own. The
 * absolute cap is enforced separately in the `jwt` callback against the
 * `signInAt` stamp, so this module stays pure and DB-free and holds in the edge
 * middleware as well as the Node runtime. Logout is immediate through the normal
 * `signOut` cookie clear and needs nothing here.
 */

const DAY_S = 24 * 60 * 60;

/** Sliding inactivity window: NextAuth `session.maxAge`. */
export const SESSION_INACTIVITY_MAX_AGE_S = 7 * DAY_S;

/** Hard ceiling from sign-in, enforced in the jwt callback. */
export const SESSION_ABSOLUTE_MAX_AGE_S = 30 * DAY_S;

/** How often NextAuth rotates the token while the user is active. */
export const SESSION_UPDATE_AGE_S = DAY_S;

/**
 * True once a session is older than the absolute cap and must end regardless of
 * recent activity. A token minted before this policy existed carries no
 * `signInAt`; it is never force-expired here and simply relies on the
 * inactivity window instead.
 */
export function isSessionPastAbsoluteCap(
  signInAt: number | undefined,
  nowSec: number
): boolean {
  if (typeof signInAt !== "number") return false;
  return nowSec - signInAt > SESSION_ABSOLUTE_MAX_AGE_S;
}
