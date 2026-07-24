import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * A very short-lived, signed handoff between completing onboarding and
 * establishing the session. The Student account and its Google identity already
 * exist when this is minted, so the token only needs to carry the new user id to
 * the credentials provider that turns it into a real Auth.js session. It exists
 * so a brand-new Google user is signed in immediately after onboarding instead
 * of being bounced back to the login page for a second Google click.
 *
 * Security: only this server can sign it (AUTH_SECRET), it is scoped by a
 * dedicated audience so it can never be replayed against another flow, and its
 * lifetime is measured in a couple of minutes because it is consumed on the same
 * request that mints it. The credentials provider still re-checks that the
 * account is available before trusting the id.
 */
export const ONBOARDING_SESSION_HANDOFF_TTL_MS = 2 * 60 * 1000;
const AUDIENCE = "beagle:google-onboarding-session";

export type OnboardingSessionHandoff = {
  userId: string;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createOnboardingSessionHandoff(input: {
  userId: string;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + ONBOARDING_SESSION_HANDOFF_TTL_MS
  );

  return (
    new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      // The freshly-created account id is the subject of the handoff.
      .setSubject(input.userId)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secretKey(input.secret))
  );
}

/**
 * Returns the carried user id only for a token this server signed, that has not
 * expired, and that carries the dedicated audience. Any tampering, a wrong
 * audience, or expiry throws, so the caller treats a rejected token as "session
 * could not be established" and falls back to the login page.
 */
export async function readOnboardingSessionHandoff(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<OnboardingSessionHandoff> {
  const key = secretKey(input.secret);

  let claims: { sub?: unknown };
  try {
    const verified = await jwtVerify(input.token, key, {
      audience: AUDIENCE,
      clockTolerance: 0,
      currentDate: input.now,
    });
    claims = verified.payload;
  } catch {
    throw new NotFound("onboarding_session_handoff_invalid");
  }

  const userId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;

  if (!userId) {
    throw new NotFound("onboarding_session_handoff_invalid");
  }

  return { userId };
}
