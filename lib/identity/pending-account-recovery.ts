import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * A short-lived, signed handoff between the sign-in resolver and the recovery
 * page. When a Deletion Pending account signs in with Google inside its
 * recovery window, the sign-in callback mints this instead of a session and
 * redirects to `/recover`, carrying the verified account so the page can offer a
 * one-click "recover" without trusting anything the browser supplies.
 */
export const PENDING_RECOVERY_TTL_MS = 15 * 60 * 1000;
export const PENDING_RECOVERY_COOKIE = "beagle_pending_account_recovery";
const AUDIENCE = "beagle:account-recovery";

export type PendingAccountRecovery = {
  userId: string;
  email: string;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createPendingAccountRecoveryToken(input: {
  pending: PendingAccountRecovery;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + PENDING_RECOVERY_TTL_MS);

  return new SignJWT({ email: input.pending.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.pending.userId)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(input.secret));
}

export async function readPendingAccountRecoveryToken(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<PendingAccountRecovery> {
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
    throw new NotFound("pending_account_recovery_invalid");
  }

  const userId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  const email =
    typeof claims.email === "string" && claims.email.length > 0
      ? claims.email
      : null;

  if (!userId || !email) {
    throw new NotFound("pending_account_recovery_invalid");
  }

  return { userId, email };
}
