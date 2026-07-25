import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * A single-use, signed password-reset handoff carried in an emailed link
 * (ADR-0042). It needs no database row: the token embeds a fingerprint of the
 * account's current password hash, and the reset is accepted only when that
 * fingerprint still matches. bcrypt re-salts on every set, so the first
 * successful reset changes the hash and every outstanding link fails the
 * check — the password change itself is what makes the link single-use.
 */
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const AUDIENCE = "beagle:password-reset";

/**
 * A hash of the current password hash — never the credential itself. Truncated
 * because a collision would only let a link survive one extra password change,
 * which the 15-minute expiry already bounds.
 */
export function passwordHashFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 32);
}

export type PendingPasswordReset = {
  userId: string;
  fingerprint: string;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createPasswordResetToken(input: {
  userId: string;
  passwordHash: string;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + PASSWORD_RESET_TTL_MS);

  return new SignJWT({ fp: passwordHashFingerprint(input.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(input.secret));
}

/**
 * Returns the pending reset only for a token this server signed, that has not
 * expired, and that carries both claims. Any tampering, wrong audience, or
 * expiry throws, so the reset page treats a rejected token as "request a new
 * link". The fingerprint is checked against the live hash by the caller.
 */
export async function readPasswordResetToken(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<PendingPasswordReset> {
  const key = secretKey(input.secret);

  let claims: { sub?: unknown; fp?: unknown };
  try {
    const verified = await jwtVerify(input.token, key, {
      audience: AUDIENCE,
      clockTolerance: 0,
      currentDate: input.now,
    });
    claims = verified.payload;
  } catch {
    throw new NotFound("password_reset_invalid");
  }

  const userId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  const fingerprint =
    typeof claims.fp === "string" && claims.fp.length > 0 ? claims.fp : null;

  if (!userId || !fingerprint) {
    throw new NotFound("password_reset_invalid");
  }

  return { userId, fingerprint };
}
