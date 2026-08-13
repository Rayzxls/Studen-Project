import "server-only";

import {
  AccessToken,
  RoomServiceClient,
  ServerError,
  TrackSource,
} from "livekit-server-sdk";

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
  /** Whether this participant may share a screen on the stage. */
  canPresent: boolean;
}

/**
 * A token that lets one person into one room, with exactly the rights they
 * should have there.
 *
 * Speaking and presenting are different rights and are granted differently.
 * **Everyone may use a microphone** — a class where students cannot answer is
 * not a class, and muting is theirs to control the way it is in any call.
 * **Every active room member may share a screen.** This is enforced in the
 * token rather than by the interface, so the visible control and the media
 * server cannot drift apart. Camera publishing stays out of the grant because
 * this stage is intentionally a screen-share surface, not a camera grid.
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
          TrackSource.SCREEN_SHARE,
          TrackSource.SCREEN_SHARE_AUDIO,
        ]
      : [TrackSource.MICROPHONE],
    canPublishData: true,
  });

  return token.toJwt();
}

/**
 * Disconnect one participant from the stage without ending the room.
 *
 * LiveKit documents removal as re-joinable. Revoking the token used for the
 * removed connection prevents that exact credential from racing straight back
 * in, while a deliberate Join press mints a fresh token normally.
 */
export async function removeStageParticipant(params: {
  sessionId: string;
  userId: string;
  config?: LiveKitConfig | null;
  now?: Date;
}): Promise<void> {
  const config =
    params.config === undefined ? readLiveKitConfig() : params.config;
  if (!config) return;

  const client = new RoomServiceClient(
    config.url,
    config.apiKey,
    config.apiSecret
  );
  try {
    await client.removeParticipant(
      roomNameForSession(params.sessionId),
      params.userId,
      {
        revokeTokenTs: BigInt(
          Math.floor((params.now ?? new Date()).getTime() / 1_000)
        ),
      }
    );
  } catch (error) {
    // Presence can outlive a dropped media connection for one polling window.
    // Removing someone who has already disconnected is therefore success.
    if (error instanceof ServerError && error.status === 404) return;
    throw error;
  }
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
