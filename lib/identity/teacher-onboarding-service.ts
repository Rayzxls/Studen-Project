import type { Role } from "@prisma/client";
import { z } from "zod";

import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  effectiveTeacherInviteStatus,
  hashIdentityToken,
  normalizeVerifiedEmail,
  parseRealName,
  type PersistedTeacherInviteStatus,
} from "./foundation";

const RawInviteTokenSchema = z.string().trim().min(32).max(512);
const ProviderAccountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));
const ConsentVersionSchema = z.string().trim().min(1).max(100);

// Legacy User.passwordHash is non-null. The random source for this bcrypt hash
// was discarded, so it cannot be used as a fallback credential.
const DISABLED_COMPATIBILITY_PASSWORD_HASH =
  "$2b$12$WdTDhMd30SXNvxTGCidMdeqzArfRCLJM/Kx7PqHXQf9qKvLxVtUbe";

export type TeacherOnboardingInviteRecord = {
  inviteId: string;
  email: string;
  status: PersistedTeacherInviteStatus;
  expiresAt: Date;
  acceptedByUserId: string | null;
};

export type TeacherOnboardingUserRecord = {
  userId: string;
  role: Role;
};

export interface TeacherOnboardingTransactionPort {
  findInviteByTokenHash(
    tokenHash: string
  ): Promise<TeacherOnboardingInviteRecord | null>;
  findUserByEmail(email: string): Promise<TeacherOnboardingUserRecord | null>;
  findGoogleIdentity(
    providerAccountId: string
  ): Promise<{ userId: string } | null>;
  createTeacherAccount(input: {
    email: string;
    emailVerifiedAt: Date;
    firstName: string;
    lastName: string;
    providerAccountId: string;
    providerEmail: string;
    compatibilityPasswordHash: string;
    createdAt: Date;
  }): Promise<{ userId: string }>;
  acceptInvite(input: {
    inviteId: string;
    acceptedByUserId: string;
    acceptedAt: Date;
  }): Promise<boolean>;
  createConsentAcceptances(input: {
    userId: string;
    acceptedAt: Date;
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "TEACHER_INVITE_ACCEPTED" | "CONSENT_GRANTED";
      targetType: string;
      targetId: string;
      targetLabel: string;
      after: Record<string, unknown>;
      timestamp: Date;
      ipAddress?: string;
      userAgent?: string;
    }>
  ): Promise<void>;
}

export interface TeacherOnboardingDatabasePort {
  transaction<T>(
    work: (tx: TeacherOnboardingTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type TeacherOnboardingServiceOptions = {
  mutationsEnabled: boolean;
  requiredConsent: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  };
  compatibilityPasswordHashFactory?: () => Promise<string>;
};

export type TeacherOnboardingResult = {
  userId: string;
  role: "TEACHER";
  email: string;
  firstName: string;
  lastName: string;
};

async function defaultCompatibilityPasswordHashFactory(): Promise<string> {
  return DISABLED_COMPATIBILITY_PASSWORD_HASH;
}

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

function parseConsentVersions(input: {
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

function assertInviteCanBeAccepted(
  invite: TeacherOnboardingInviteRecord,
  now: Date
): void {
  const status = effectiveTeacherInviteStatus({
    status: invite.status,
    expiresAt: invite.expiresAt,
    now,
  });

  if (status === "EXPIRED") {
    throw new Conflict("teacher_invite_expired");
  }
  if (status !== "PENDING" || invite.acceptedByUserId !== null) {
    throw new Conflict("teacher_invite_not_pending");
  }
}

function assertEmailAvailable(
  existingUser: TeacherOnboardingUserRecord | null
): void {
  if (!existingUser) return;
  if (existingUser.role === "TEACHER") {
    throw new Conflict("teacher_onboarding_account_exists");
  }
  throw new Conflict("teacher_onboarding_role_collision");
}

export function createTeacherOnboardingService(
  database: TeacherOnboardingDatabasePort,
  options: TeacherOnboardingServiceOptions
) {
  const compatibilityPasswordHashFactory =
    options.compatibilityPasswordHashFactory ??
    defaultCompatibilityPasswordHashFactory;

  return {
    async accept(input: {
      rawInviteToken: string;
      google: {
        providerAccountId: string;
        email: string;
        emailVerified: boolean;
      };
      firstName: string;
      lastName: string;
      consent: {
        termsOfUseVersion: string;
        privacyNoticeVersion: string;
      };
      occurredAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<TeacherOnboardingResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      if (!input.google.emailVerified) {
        throw new Forbidden("google_email_not_verified");
      }

      const rawInviteToken = RawInviteTokenSchema.parse(input.rawInviteToken);
      const providerAccountId = ProviderAccountIdSchema.parse(
        input.google.providerAccountId
      );
      const providerEmail = normalizeVerifiedEmail(input.google.email);
      const realName = parseRealName({
        firstName: input.firstName,
        lastName: input.lastName,
      });
      const consent = parseConsentVersions({
        accepted: input.consent,
        required: options.requiredConsent,
      });
      const tokenHash = hashIdentityToken(rawInviteToken);
      const compatibilityPasswordHash =
        await compatibilityPasswordHashFactory();

      return database.transaction(async (tx) => {
        const invite = await tx.findInviteByTokenHash(tokenHash);
        if (!invite) {
          throw new NotFound("teacher_invite_invalid");
        }
        assertInviteCanBeAccepted(invite, input.occurredAt);

        const inviteEmail = normalizeVerifiedEmail(invite.email);
        if (providerEmail !== inviteEmail) {
          throw new Forbidden("teacher_invite_email_mismatch");
        }

        const [existingUser, existingIdentity] = await Promise.all([
          tx.findUserByEmail(providerEmail),
          tx.findGoogleIdentity(providerAccountId),
        ]);
        assertEmailAvailable(existingUser);
        if (existingIdentity) {
          throw new Conflict("google_identity_already_linked");
        }

        const account = await tx.createTeacherAccount({
          email: providerEmail,
          emailVerifiedAt: input.occurredAt,
          firstName: realName.firstName,
          lastName: realName.lastName,
          providerAccountId,
          providerEmail,
          compatibilityPasswordHash,
          createdAt: input.occurredAt,
        });

        const accepted = await tx.acceptInvite({
          inviteId: invite.inviteId,
          acceptedByUserId: account.userId,
          acceptedAt: input.occurredAt,
        });
        if (!accepted) {
          throw new Conflict("teacher_invite_not_pending");
        }

        await tx.createConsentAcceptances({
          userId: account.userId,
          acceptedAt: input.occurredAt,
          termsOfUseVersion: consent.termsOfUseVersion,
          privacyNoticeVersion: consent.privacyNoticeVersion,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });

        await tx.createAuditLogs([
          {
            actorId: account.userId,
            actorRole: "TEACHER",
            action: "TEACHER_INVITE_ACCEPTED",
            targetType: "TeacherInvite",
            targetId: invite.inviteId,
            targetLabel: providerEmail,
            after: {
              userId: account.userId,
              provider: "GOOGLE",
            },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
          ...(["TERMS_OF_USE", "PRIVACY_NOTICE"] as const).map((document) => ({
            actorId: account.userId,
            actorRole: "TEACHER" as const,
            action: "CONSENT_GRANTED" as const,
            targetType: "ConsentAcceptance",
            targetId: account.userId,
            targetLabel: document,
            after: {
              document,
              version:
                document === "TERMS_OF_USE"
                  ? consent.termsOfUseVersion
                  : consent.privacyNoticeVersion,
            },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          })),
        ]);

        return {
          userId: account.userId,
          role: "TEACHER" as const,
          email: providerEmail,
          firstName: realName.firstName,
          lastName: realName.lastName,
        };
      });
    },
  };
}
