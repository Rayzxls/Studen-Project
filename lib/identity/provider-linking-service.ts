import type { Role } from "@prisma/client";
import { z } from "zod";

import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import {
  hasRecentReauthentication,
  normalizeVerifiedEmail,
} from "./foundation";

const ProviderAccountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));

export type ProviderLinkingAccountRecord = {
  userId: string;
  role: Role;
  email: string | null;
  accountStatus: AccountStatus | null;
  isActive: boolean;
  deletedAt: Date | null;
  studentAnonymized: boolean | null;
};

export interface ProviderLinkingTransactionPort {
  findAccount(userId: string): Promise<ProviderLinkingAccountRecord | null>;
  findGoogleIdentity(
    providerAccountId: string
  ): Promise<{ userId: string } | null>;
  countGoogleIdentitiesForUser(userId: string): Promise<number>;
  linkGoogleIdentity(input: {
    userId: string;
    providerAccountId: string;
    providerEmail: string;
    linkedAt: Date;
  }): Promise<{ identityId: string }>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "AUTH_PROVIDER_LINKED";
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

export interface ProviderLinkingDatabasePort {
  transaction<T>(
    work: (tx: ProviderLinkingTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type ProviderLinkingServiceOptions = {
  mutationsEnabled: boolean;
};

export type ProviderLinkingResult = {
  identityId: string;
  userId: string;
  provider: "GOOGLE";
  providerEmail: string;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

export function createProviderLinkingService(
  database: ProviderLinkingDatabasePort,
  options: ProviderLinkingServiceOptions
) {
  return {
    /**
     * Attaches Google to an account the caller is already authenticated as.
     * ADR-0041 forbids linking by email match alone, so the caller must prove
     * ownership; this path takes the authenticated Profile and additionally
     * requires a recent re-authentication because attaching a provider changes
     * who can sign in as this User.
     *
     * Linking by fallback password is a separate path and cannot exist until
     * optional fallback-password setup exists in Profile.
     */
    async linkGoogleFromAuthenticatedProfile(input: {
      actor: {
        userId: string;
        reauthenticatedAt: Date | null;
      };
      google: {
        providerAccountId: string;
        email: string;
        emailVerified: boolean;
      };
      occurredAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<ProviderLinkingResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      if (!input.google.emailVerified) {
        throw new Forbidden("google_email_not_verified");
      }

      if (
        !hasRecentReauthentication({
          reauthenticatedAt: input.actor.reauthenticatedAt,
          now: input.occurredAt,
        })
      ) {
        throw new Forbidden("reauthentication_required");
      }

      const providerAccountId = ProviderAccountIdSchema.parse(
        input.google.providerAccountId
      );
      const providerEmail = normalizeVerifiedEmail(input.google.email);

      return database.transaction(async (tx) => {
        const account = await tx.findAccount(input.actor.userId);
        if (!account) {
          throw new NotFound("account_not_found");
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

        // One account keeps one verified email. A Google address that differs
        // must go through the email-change verification flow first, otherwise
        // the account would carry two competing authoritative addresses.
        if (!account.email || account.email !== providerEmail) {
          throw new Forbidden("google_email_does_not_match_account");
        }

        const existingIdentity = await tx.findGoogleIdentity(providerAccountId);
        if (existingIdentity) {
          throw new Conflict(
            existingIdentity.userId === account.userId
              ? "google_identity_already_linked_to_this_account"
              : "google_identity_already_linked"
          );
        }

        // One User keeps one Google identity in this release, so a second
        // subject cannot quietly become an additional way in.
        if ((await tx.countGoogleIdentitiesForUser(account.userId)) > 0) {
          throw new Conflict("account_already_has_google_identity");
        }

        const linked = await tx.linkGoogleIdentity({
          userId: account.userId,
          providerAccountId,
          providerEmail,
          linkedAt: input.occurredAt,
        });

        await tx.createAuditLogs([
          {
            actorId: account.userId,
            actorRole: account.role,
            action: "AUTH_PROVIDER_LINKED",
            targetType: "AuthIdentity",
            targetId: linked.identityId,
            targetLabel: providerEmail,
            after: { provider: "GOOGLE", userId: account.userId },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ]);

        return {
          identityId: linked.identityId,
          userId: account.userId,
          provider: "GOOGLE" as const,
          providerEmail,
        };
      });
    },
  };
}
