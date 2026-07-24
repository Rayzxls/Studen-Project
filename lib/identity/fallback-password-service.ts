import type { Role } from "@prisma/client";
import { z } from "zod";

import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import { isCommonPassword } from "@/lib/auth/password";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  DISABLED_COMPATIBILITY_PASSWORD_HASH,
  hasRecentReauthentication,
} from "./foundation";

const FallbackPasswordSchema = z.string().min(8).max(200);

export type FallbackPasswordAccountRecord = {
  userId: string;
  role: Role;
  email: string | null;
  passwordHash: string;
  accountStatus: AccountStatus | null;
  isActive: boolean;
  deletedAt: Date | null;
  studentAnonymized: boolean | null;
};

export interface FallbackPasswordTransactionPort {
  findAccount(userId: string): Promise<FallbackPasswordAccountRecord | null>;
  setPasswordHash(input: {
    userId: string;
    passwordHash: string;
  }): Promise<void>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "PASSWORD_CHANGED_SELF";
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

export interface FallbackPasswordDatabasePort {
  transaction<T>(
    work: (tx: FallbackPasswordTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type FallbackPasswordServiceOptions = {
  mutationsEnabled: boolean;
  passwordHasher: (plain: string) => Promise<string>;
};

export type FallbackPasswordResult = {
  userId: string;
  replacedExistingPassword: boolean;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

/**
 * A Google-first account carries the disabled compatibility hash rather than a
 * usable credential, so its presence means "no fallback password yet".
 */
function hasUsableFallbackPassword(passwordHash: string): boolean {
  return passwordHash !== DISABLED_COMPATIBILITY_PASSWORD_HASH;
}

function parseFallbackPassword(value: string): string {
  const parsed = FallbackPasswordSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError({ password: "fallback_password_too_weak" });
  }
  if (isCommonPassword(parsed.data)) {
    throw new ValidationError({ password: "fallback_password_too_common" });
  }
  return parsed.data;
}

export function createFallbackPasswordService(
  database: FallbackPasswordDatabasePort,
  options: FallbackPasswordServiceOptions
) {
  return {
    /**
     * Sets or replaces the optional fallback password on the caller's own
     * account. ADR-0041 keeps this optional and never lets it block Google-first
     * onboarding, so this path only ever adds a second way in for the owner.
     *
     * Existing sessions are intentionally left alone: session issue and
     * revocation are a separate slice, and inventing a revocation rule here
     * would make session behaviour depend on two unrelated services.
     */
    async setOwnFallbackPassword(input: {
      actor: {
        userId: string;
        reauthenticatedAt: Date | null;
      };
      newPassword: string;
      occurredAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<FallbackPasswordResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      if (
        !hasRecentReauthentication({
          reauthenticatedAt: input.actor.reauthenticatedAt,
          now: input.occurredAt,
        })
      ) {
        throw new Forbidden("reauthentication_required");
      }

      const newPassword = parseFallbackPassword(input.newPassword);
      const passwordHash = await options.passwordHasher(newPassword);

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

        const replacedExistingPassword = hasUsableFallbackPassword(
          account.passwordHash
        );

        await tx.setPasswordHash({
          userId: account.userId,
          passwordHash,
        });

        await tx.createAuditLogs([
          {
            actorId: account.userId,
            actorRole: account.role,
            action: "PASSWORD_CHANGED_SELF",
            targetType: "User",
            targetId: account.userId,
            targetLabel: account.email ?? account.userId,
            // The password itself, its hash, and its length are never recorded.
            after: { fallbackPassword: "SET", replacedExistingPassword },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ]);

        return { userId: account.userId, replacedExistingPassword };
      });
    },
  };
}
