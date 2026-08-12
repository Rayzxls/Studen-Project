import "server-only";

import { AccessToken, TrackSource } from "livekit-server-sdk";

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
  /** Only a teacher may put something on the stage without being handed it. */
  canPresent: boolean;
}

/**
 * A token that lets one person into one room, with exactly the rights they
 * should have there.
 *
 * Speaking and presenting are different rights and are granted differently.
 * **Everyone may use a microphone** — a class where students cannot answer is
 * not a class, and muting is theirs to control the way it is in any call.
 * **Only a teacher may put something on the stage.** ADR-0053 makes presenting
 * something the teacher hands over, and the enforcement is here rather than in
 * the interface: a student who edits the page still cannot share a screen,
 * because the token does not permit that source.
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
    canPublish: true,
    canPublishSources: grant.canPresent
      ? [
          TrackSource.MICROPHONE,
          TrackSource.CAMERA,
          TrackSource.SCREEN_SHARE,
          TrackSource.SCREEN_SHARE_AUDIO,
        ]
      : [TrackSource.MICROPHONE],
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
