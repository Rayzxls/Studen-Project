import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * Carries the intent to LINK Google to the account the user is already signed in
 * as, across the Google OAuth round-trip. The Profile "link Google" action mints
 * this (proving who the caller is and when they last re-authenticated) and sets
 * it just before handing off to Google; the sign-in callback consumes it to
 * attach the returned Google identity to that account instead of starting a new
 * sign-in or onboarding. It is signed, so the browser cannot forge who is being
 * linked, and the re-authentication window is re-checked when the link is
 * applied.
 */
export const PENDING_PROVIDER_LINK_COOKIE = "beagle_pending_provider_link";
export const PENDING_PROVIDER_LINK_TTL_MS = 15 * 60 * 1000;
const AUDIENCE = "beagle:provider-link";

export type PendingProviderLink = {
  userId: string;
  /** Unix seconds of the caller's sign-in; the re-authentication basis. */
  signInAt: number | null;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createPendingProviderLinkToken(input: {
  pending: PendingProviderLink;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + PENDING_PROVIDER_LINK_TTL_MS);

  return new SignJWT({ sat: input.pending.signInAt })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.pending.userId)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(input.secret));
}

export async function readPendingProviderLinkToken(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<PendingProviderLink> {
  const key = secretKey(input.secret);

  let claims: { sub?: unknown; sat?: unknown };
  try {
    const verified = await jwtVerify(input.token, key, {
      audience: AUDIENCE,
      clockTolerance: 0,
      currentDate: input.now,
    });
    claims = verified.payload;
  } catch {
    throw new NotFound("pending_provider_link_invalid");
  }

  const userId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  if (!userId) {
    throw new NotFound("pending_provider_link_invalid");
  }
  const signInAt = typeof claims.sat === "number" ? claims.sat : null;

  return { userId, signInAt };
}
