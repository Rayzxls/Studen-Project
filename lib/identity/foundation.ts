import { createHash } from "node:crypto";

import { z } from "zod";

import { ValidationError } from "@/lib/errors";

export const TEACHER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_RECOVERY_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * ADR-0041 requires re-authentication for sensitive identity changes but does
 * not fix the window. Twenty minutes keeps a stolen idle session from
 * attaching a new sign-in provider while staying long enough to complete one
 * deliberate Profile action.
 */
export const REAUTHENTICATION_WINDOW_MS = 20 * 60 * 1000;
export const NAME_CONTINUITY_MS = 14 * 24 * 60 * 60 * 1000;

const VerifiedEmailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

const RealNamePartSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value))
  .transform((value) => value.replace(/\s+/gu, " "));

const RealNameSchema = z.object({
  firstName: RealNamePartSchema,
  lastName: RealNamePartSchema,
});

const ConsentVersionSchema = z.string().trim().min(1).max(100);

/**
 * Legacy `User.passwordHash` is non-null. The random source for this bcrypt
 * hash was discarded, so it cannot be used as a fallback credential. Sharing
 * one precomputed constant also avoids per-request bcrypt work before an
 * onboarding request has been validated.
 */
export const DISABLED_COMPATIBILITY_PASSWORD_HASH =
  "$2b$12$WdTDhMd30SXNvxTGCidMdeqzArfRCLJM/Kx7PqHXQf9qKvLxVtUbe";

export type RealName = z.infer<typeof RealNameSchema>;
export type ConsentDocument = "TERMS_OF_USE" | "PRIVACY_NOTICE";
export type PersistedTeacherInviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";
export type EffectiveTeacherInviteStatus =
  | PersistedTeacherInviteStatus
  | "EXPIRED";

export function normalizeVerifiedEmail(value: string): string {
  return VerifiedEmailSchema.parse(value);
}

export function hashIdentityToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function parseRealName(value: RealName): RealName {
  return RealNameSchema.parse(value);
}

export function teacherInviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + TEACHER_INVITE_TTL_MS);
}

export function effectiveTeacherInviteStatus(input: {
  status: PersistedTeacherInviteStatus;
  expiresAt: Date;
  now: Date;
}): EffectiveTeacherInviteStatus {
  if (input.status !== "PENDING") {
    return input.status;
  }

  return input.expiresAt.getTime() <= input.now.getTime()
    ? "EXPIRED"
    : "PENDING";
}

export function hasRequiredConsent(
  acceptances: ReadonlyArray<{
    document: ConsentDocument;
    version: string;
  }>,
  required: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  }
): boolean {
  const accepted = new Set(
    acceptances.map(
      (acceptance) => `${acceptance.document}:${acceptance.version}`
    )
  );

  return (
    accepted.has(`TERMS_OF_USE:${required.termsOfUseVersion}`) &&
    accepted.has(`PRIVACY_NOTICE:${required.privacyNoticeVersion}`)
  );
}

/**
 * Onboarding accepts consent only for the exact versions the deployment
 * currently requires, so a stale client cannot register an account against a
 * superseded Terms or Privacy document.
 */
export function parseAcceptedConsentVersions(input: {
  accepted: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  };
  required: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  };
}) {
  const accepted = {
    termsOfUseVersion: ConsentVersionSchema.parse(
      input.accepted.termsOfUseVersion
    ),
    privacyNoticeVersion: ConsentVersionSchema.parse(
      input.accepted.privacyNoticeVersion
    ),
  };
  const required = {
    termsOfUseVersion: ConsentVersionSchema.parse(
      input.required.termsOfUseVersion
    ),
    privacyNoticeVersion: ConsentVersionSchema.parse(
      input.required.privacyNoticeVersion
    ),
  };

  if (
    accepted.termsOfUseVersion !== required.termsOfUseVersion ||
    accepted.privacyNoticeVersion !== required.privacyNoticeVersion
  ) {
    throw new ValidationError({
      consent: "identity_consent_version_mismatch",
    });
  }

  return accepted;
}

export function defaultAvatarVariant(
  userId: string,
  variantCount = 12
): number {
  if (!Number.isInteger(variantCount) || variantCount < 1) {
    throw new RangeError("variantCount must be a positive integer");
  }

  const digest = createHash("sha256").update(userId).digest();
  return digest.readUInt32BE(0) % variantCount;
}

export function identitySessionDeadlines(input: {
  createdAt: Date;
  lastSeenAt: Date;
}) {
  return {
    absoluteExpiresAt: new Date(input.createdAt.getTime() + SESSION_MAX_AGE_MS),
    idleExpiresAt: new Date(
      input.lastSeenAt.getTime() + SESSION_IDLE_TIMEOUT_MS
    ),
  };
}

export function isIdentitySessionActive(input: {
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  now: Date;
}): boolean {
  if (input.revokedAt !== null) {
    return false;
  }

  const deadlines = identitySessionDeadlines(input);
  return (
    input.now.getTime() < deadlines.absoluteExpiresAt.getTime() &&
    input.now.getTime() < deadlines.idleExpiresAt.getTime()
  );
}

export function hasRecentReauthentication(input: {
  reauthenticatedAt: Date | null;
  now: Date;
}): boolean {
  if (!input.reauthenticatedAt) return false;
  const age = input.now.getTime() - input.reauthenticatedAt.getTime();
  return age >= 0 && age < REAUTHENTICATION_WINDOW_MS;
}

export function deletionScheduledFor(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_RECOVERY_MS);
}

export function nameContinuityUntil(changedAt: Date): Date {
  return new Date(changedAt.getTime() + NAME_CONTINUITY_MS);
}
