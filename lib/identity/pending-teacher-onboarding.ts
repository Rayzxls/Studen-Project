import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * The raw invite token a teacher opened at `/invite/<token>`. The start action
 * stores it in this cookie before handing off to Google so the verified sign-in
 * that comes back can be tied to the invite it was meant for. Read once, in the
 * sign-in callback, then cleared.
 */
export const PENDING_TEACHER_INVITE_COOKIE = "beagle_pending_teacher_invite";

/**
 * A short-lived, signed handoff between the OAuth phase and the teacher
 * onboarding page — the teacher counterpart of `pending-google-onboarding`. The
 * Google assertion is already verified when this is minted, so the token carries
 * the verified subject and email plus the raw invite token the acceptance needs.
 * It is stateless: nothing is written until the teacher completes onboarding, so
 * an abandoned flow leaves no rows behind.
 */
export const PENDING_TEACHER_ONBOARDING_TTL_MS = 15 * 60 * 1000;
export const PENDING_TEACHER_ONBOARDING_COOKIE =
  "beagle_pending_teacher_onboarding";
const AUDIENCE = "beagle:teacher-onboarding";

export type PendingTeacherOnboarding = {
  providerAccountId: string;
  email: string;
  rawInviteToken: string;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createPendingTeacherOnboardingToken(input: {
  pending: PendingTeacherOnboarding;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + PENDING_TEACHER_ONBOARDING_TTL_MS
  );

  return (
    new SignJWT({
      email: input.pending.email,
      invite: input.pending.rawInviteToken,
    })
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
 * Returns the pending teacher identity only for a token this server signed, that
 * has not expired, and that carries every claim. Any tampering, a wrong
 * audience, or expiry throws, so the onboarding page can treat a rejected token
 * as "start the invite again" rather than trusting partial data.
 */
export async function readPendingTeacherOnboardingToken(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<PendingTeacherOnboarding> {
  // Resolve the key first: a missing secret is a server misconfiguration, not
  // an invalid token, and must not be masked by the catch below.
  const key = secretKey(input.secret);

  let claims: { sub?: unknown; email?: unknown; invite?: unknown };
  try {
    const verified = await jwtVerify(input.token, key, {
      audience: AUDIENCE,
      clockTolerance: 0,
      currentDate: input.now,
    });
    claims = verified.payload;
  } catch {
    throw new NotFound("pending_teacher_onboarding_invalid");
  }

  const providerAccountId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  const email =
    typeof claims.email === "string" && claims.email.length > 0
      ? claims.email
      : null;
  const rawInviteToken =
    typeof claims.invite === "string" && claims.invite.length > 0
      ? claims.invite
      : null;

  if (!providerAccountId || !email || !rawInviteToken) {
    throw new NotFound("pending_teacher_onboarding_invalid");
  }

  return { providerAccountId, email, rawInviteToken };
}
