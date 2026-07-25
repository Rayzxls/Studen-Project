import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import { NotFound } from "@/lib/errors";

/**
 * A single-use, signed email-change confirmation carried in a link sent to the
 * NEW address (ADR-0042). Clicking it proves control of that address; the token
 * proves the change was requested by the re-authenticated owner. It needs no
 * database row: it embeds a fingerprint of the account's CURRENT email and is
 * accepted only while that still matches, so the first confirmed change makes
 * every outstanding link stale.
 */
export const EMAIL_CHANGE_TTL_MS = 15 * 60 * 1000;
const AUDIENCE = "beagle:email-change";

/** A hash of the normalized email — never used to reveal the address itself. */
export function emailFingerprint(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export type PendingEmailChange = {
  userId: string;
  newEmail: string;
  fingerprint: string;
};

function secretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new NotFound("identity_foundation_not_found");
  }
  return new TextEncoder().encode(trimmed);
}

export async function createEmailChangeToken(input: {
  userId: string;
  currentEmail: string | null;
  newEmail: string;
  secret: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + EMAIL_CHANGE_TTL_MS);

  return new SignJWT({
    email: input.newEmail,
    fp: emailFingerprint(input.currentEmail ?? ""),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(input.secret));
}

/**
 * Returns the pending change only for a token this server signed, that has not
 * expired, and that carries every claim. Any tampering, wrong audience, or
 * expiry throws, so the confirm page treats a rejected token as "request the
 * change again". The fingerprint is checked against the live email by the
 * caller.
 */
export async function readEmailChangeToken(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<PendingEmailChange> {
  const key = secretKey(input.secret);

  let claims: { sub?: unknown; email?: unknown; fp?: unknown };
  try {
    const verified = await jwtVerify(input.token, key, {
      audience: AUDIENCE,
      clockTolerance: 0,
      currentDate: input.now,
    });
    claims = verified.payload;
  } catch {
    throw new NotFound("email_change_invalid");
  }

  const userId =
    typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  const newEmail =
    typeof claims.email === "string" && claims.email.length > 0
      ? claims.email
      : null;
  const fingerprint =
    typeof claims.fp === "string" && claims.fp.length > 0 ? claims.fp : null;

  if (!userId || !newEmail || !fingerprint) {
    throw new NotFound("email_change_invalid");
  }

  return { userId, newEmail, fingerprint };
}
