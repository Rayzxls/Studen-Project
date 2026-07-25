import type { Role } from "@prisma/client";
import { z } from "zod";

import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import {
  DISABLED_COMPATIBILITY_PASSWORD_HASH,
  normalizeVerifiedEmail,
  parseAcceptedConsentVersions,
  parseRealName,
} from "./foundation";

const ProviderAccountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));

export type StudentOnboardingUserRecord = {
  userId: string;
  role: Role;
};

export interface StudentOnboardingTransactionPort {
  findUserByEmail(email: string): Promise<StudentOnboardingUserRecord | null>;
  findGoogleIdentity(
    providerAccountId: string
  ): Promise<{ userId: string } | null>;
  createStudentAccount(input: {
    email: string;
    emailVerifiedAt: Date;
    firstName: string;
    lastName: string;
    providerAccountId: string;
    providerEmail: string;
    compatibilityPasswordHash: string;
    createdAt: Date;
  }): Promise<{ userId: string }>;
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
      action: "STUDENT_SELF_REGISTERED" | "CONSENT_GRANTED";
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

export interface StudentOnboardingDatabasePort {
  transaction<T>(
    work: (tx: StudentOnboardingTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type StudentOnboardingServiceOptions = {
  mutationsEnabled: boolean;
  requiredConsent: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  };
  compatibilityPasswordHashFactory?: () => Promise<string>;
};

export type StudentOnboardingResult = {
  userId: string;
  role: "STUDENT";
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

/**
 * ADR-0041: an email match never auto-links an existing account. A Student who
 * already owns the address must link Google from an authenticated Profile
 * instead, and a different Role fails closed rather than being converted.
 */
function assertEmailAvailable(
  existingUser: StudentOnboardingUserRecord | null
): void {
  if (!existingUser) return;
  if (existingUser.role === "STUDENT") {
    throw new Conflict("student_onboarding_account_exists");
  }
  throw new Conflict("student_onboarding_role_collision");
}

export function createStudentOnboardingService(
  database: StudentOnboardingDatabasePort,
  options: StudentOnboardingServiceOptions
) {
  const compatibilityPasswordHashFactory =
    options.compatibilityPasswordHashFactory ??
    defaultCompatibilityPasswordHashFactory;

  return {
    async register(input: {
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
    }): Promise<StudentOnboardingResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      if (!input.google.emailVerified) {
        throw new Forbidden("google_email_not_verified");
      }

      const providerAccountId = ProviderAccountIdSchema.parse(
        input.google.providerAccountId
      );
      const providerEmail = normalizeVerifiedEmail(input.google.email);
      // Google display name may be a nickname, so the Student states the real
      // name explicitly and Google only proves email ownership.
      const realName = parseRealName({
        firstName: input.firstName,
        lastName: input.lastName,
      });
      const consent = parseAcceptedConsentVersions({
        accepted: input.consent,
        required: options.requiredConsent,
      });
      const compatibilityPasswordHash =
        await compatibilityPasswordHashFactory();

      return database.transaction(async (tx) => {
        const [existingUser, existingIdentity] = await Promise.all([
          tx.findUserByEmail(providerEmail),
          tx.findGoogleIdentity(providerAccountId),
        ]);
        assertEmailAvailable(existingUser);
        if (existingIdentity) {
          throw new Conflict("google_identity_already_linked");
        }

        const account = await tx.createStudentAccount({
          email: providerEmail,
          emailVerifiedAt: input.occurredAt,
          firstName: realName.firstName,
          lastName: realName.lastName,
          providerAccountId,
          providerEmail,
          compatibilityPasswordHash,
          createdAt: input.occurredAt,
        });

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
            actorRole: "STUDENT",
            action: "STUDENT_SELF_REGISTERED",
            targetType: "User",
            targetId: account.userId,
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
            actorRole: "STUDENT" as const,
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
          role: "STUDENT" as const,
          email: providerEmail,
          firstName: realName.firstName,
          lastName: realName.lastName,
        };
      });
    },
  };
}
