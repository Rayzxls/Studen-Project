import type { Role } from "@prisma/client";
import { z } from "zod";

import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import { Forbidden, NotFound } from "@/lib/errors";
import {
  hasRequiredConsent,
  normalizeVerifiedEmail,
  type ConsentDocument,
} from "./foundation";

const ProviderAccountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));

export type GoogleSignInAccountRecord = {
  userId: string;
  role: Role;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  sessionVersion: number;
  accountStatus: AccountStatus | null;
  isActive: boolean;
  deletedAt: Date | null;
  studentAnonymized: boolean | null;
  consentAcceptances: ReadonlyArray<{
    document: ConsentDocument;
    version: string;
  }>;
};

export interface GoogleSignInTransactionPort {
  findGoogleIdentity(providerAccountId: string): Promise<{
    identityId: string;
    userId: string;
    providerEmail: string | null;
  } | null>;
  findAccount(userId: string): Promise<GoogleSignInAccountRecord | null>;
  recordIdentityUse(input: {
    identityId: string;
    providerEmail: string;
    lastUsedAt: Date;
  }): Promise<void>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "LOGIN_SUCCESS";
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

export interface GoogleSignInDatabasePort {
  transaction<T>(
    work: (tx: GoogleSignInTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type GoogleSignInServiceOptions = {
  mutationsEnabled: boolean;
  requiredConsent: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  };
};

export type GoogleSignInResult = {
  userId: string;
  role: Role;
  email: string;
  firstName: string | null;
  lastName: string | null;
  sessionVersion: number;
  /**
   * The account is authenticated but must accept the current Terms or Privacy
   * version before continuing. Stale consent never silently blocks sign-in,
   * because that would lock a real User out of their own academic record.
   */
  requiresConsentRefresh: boolean;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

export function createGoogleSignInService(
  database: GoogleSignInDatabasePort,
  options: GoogleSignInServiceOptions
) {
  return {
    /**
     * Resolves a trusted Google assertion to the already-linked User. It never
     * creates an account and never links a new provider: an unknown Google
     * subject is reported so the caller can route to the onboarding path that
     * matches the Role gate in ADR-0041.
     */
    async resolve(input: {
      google: {
        providerAccountId: string;
        email: string;
        emailVerified: boolean;
      };
      occurredAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<GoogleSignInResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      if (!input.google.emailVerified) {
        throw new Forbidden("google_email_not_verified");
      }

      const providerAccountId = ProviderAccountIdSchema.parse(
        input.google.providerAccountId
      );
      const providerEmail = normalizeVerifiedEmail(input.google.email);

      return database.transaction(async (tx) => {
        const identity = await tx.findGoogleIdentity(providerAccountId);
        if (!identity) {
          throw new NotFound("google_identity_not_linked");
        }

        const account = await tx.findAccount(identity.userId);
        if (!account) {
          throw new NotFound("google_identity_not_linked");
        }

        if (
          !isAccountAvailableForAuthentication({
            accountStatus: account.accountStatus,
            isActive: account.isActive,
            deletedAt: account.deletedAt,
            studentAnonymized: account.studentAnonymized,
          })
        ) {
          throw new Forbidden("account_not_available");
        }

        // The Google subject is the stable link. A changed Google address is
        // recorded for traceability but never overwrites the verified account
        // email, which changes only through its own verification flow.
        if (!account.email) {
          throw new Forbidden("account_not_available");
        }

        await tx.recordIdentityUse({
          identityId: identity.identityId,
          providerEmail,
          lastUsedAt: input.occurredAt,
        });

        await tx.createAuditLogs([
          {
            actorId: account.userId,
            actorRole: account.role,
            action: "LOGIN_SUCCESS",
            targetType: "User",
            targetId: account.userId,
            targetLabel: account.email,
            after: { provider: "GOOGLE" },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ]);

        return {
          userId: account.userId,
          role: account.role,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
          sessionVersion: account.sessionVersion,
          requiresConsentRefresh: !hasRequiredConsent(
            account.consentAcceptances,
            options.requiredConsent
          ),
        };
      });
    },
  };
}
