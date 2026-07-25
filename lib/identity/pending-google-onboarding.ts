import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * A short-lived, signed handoff between the OAuth phase and the onboarding
 * page. The Google assertion has already been verified when this is minted, so
 * the token only needs to carry the verified subject and email to the page that
 * collects the real name and consent. It is stateless: nothing is written to
 * the database until the person actually completes onboarding, so an abandoned
 * flow leaves no rows behind.
 */
export const PENDING_ONBOARDING_TTL_MS = 15 * 60 * 1000;
export const PENDING_ONBOARDING_COOKIE = "beagle_pending_google_onboarding";
const AUDIENCE = "beagle:google-onboarding";

export type PendingGoogleOnboarding = {
  providerAccountId: string;
  email: string;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createPendingGoogleOnboardingToken(input: {
  pending: PendingGoogleOnboarding;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + PENDING_ONBOARDING_TTL_MS);

  return (
    new SignJWT({ email: input.pending.email })
      .setProtectedHeader({ alg: "HS256" })
      // The Google subject is the stable identity, so it rides in `sub`.
      .setSubject(input.pending.providerAccountId)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secretKey(input.secret))
  );
}

/**
 * Returns the pending identity only for a token this server signed, that has
 * not expired, and that carries both claims. Any tampering, a wrong audience,
 * or expiry throws, so the onboarding page can treat a rejected token as "start
 * the Google flow again" rather than trusting partial data.
 */
export async function readPendingGoogleOnboardingToken(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<PendingGoogleOnboarding> {
  // Resolve the key first: a missing secret is a server misconfiguration, not
  // an invalid token, and must not be masked by the catch below.
  const key = secretKey(input.secret);

  let claims: { sub?: unknown; email?: unknown };
  try {
    const verified = await jwtVerify(input.token, key, {
      audience: AUDIENCE,
      clockTolerance: 0,
      currentDate: input.now,
    });
    claims = verified.payload;
  } catch {
    throw new NotFound("pending_google_onboarding_invalid");
  }

  const providerAccountId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  const email =
    typeof claims.email === "string" && claims.email.length > 0
      ? claims.email
      : null;

  if (!providerAccountId || !email) {
    throw new NotFound("pending_google_onboarding_invalid");
  }

  return { providerAccountId, email };
}
