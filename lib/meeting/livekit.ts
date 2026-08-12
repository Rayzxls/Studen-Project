import "server-only";

import { AccessToken } from "livekit-server-sdk";

/**
 * The stage's media server (ADR-0053).
 *
 * Optional by design. With no credentials configured the stage stays a
 * placeholder and everything else about the room — opening, the roster, the
 * notification, joining whatever meeting link the course has — works exactly
 * as before. That is what makes this safe to ship before anyone has decided
 * to pay for bandwidth.
 *
 * `server-only` because this file reads the API secret. It must never be
 * reachable from a client bundle, and the secret must never appear in a log,
 * an audit entry, or an API response.
 */

/** Matches the shape lib/quiz/feature-flags.ts uses, so tests can pass a literal. */
export type LiveKitEnv = Readonly<Record<string, string | undefined>>;

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

/** How long a join token stays usable. Long enough for a lesson, not a term. */
const TOKEN_TTL = "3h";

export function readLiveKitConfig(
  env: LiveKitEnv = process.env
): LiveKitConfig | null {
  const url = env.LIVEKIT_URL?.trim();
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

/** Whether the stage can carry media at all. Safe to expose; says nothing secret. */
export function stageEnabled(env: LiveKitEnv = process.env): boolean {
  return readLiveKitConfig(env) !== null;
}

export interface StageGrant {
  /** One LiveKit room per Session, so a room dies with the period. */
  sessionId: string;
  userId: string;
  participantName: string;
  /** Only a teacher may put anything on the stage without being handed it. */
  canPublish: boolean;
}

/**
 * A token that lets one person into one room, with exactly the rights they
 * should have there.
 *
 * Students are subscribe-only. Presenting is something a teacher hands over
 * (ADR-0053), and the enforcement lives here rather than in the interface: a
 * student who edits the page still cannot publish, because the token does not
 * permit it.
 */
export async function mintStageToken(
  grant: StageGrant,
  config: LiveKitConfig
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: grant.userId,
    name: grant.participantName,
    ttl: TOKEN_TTL,
  });

  token.addGrant({
    room: roomNameForSession(grant.sessionId),
    roomJoin: true,
    canSubscribe: true,
    canPublish: grant.canPublish,
    canPublishData: true,
  });

  return token.toJwt();
}

/**
 * The LiveKit room name for a period.
 *
 * Derived rather than stored: a Session id is already unique and already the
 * thing the room's lifecycle hangs off, so there is nothing to keep in sync.
 */
export function roomNameForSession(sessionId: string): string {
  return `session-${sessionId}`;
}
