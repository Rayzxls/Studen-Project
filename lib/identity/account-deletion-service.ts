import type { Role } from "@prisma/client";

import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import { Forbidden, NotFound } from "@/lib/errors";
import { hasRecentReauthentication } from "./foundation";

/** D1 (locked 2026-07-24): the owner may recover within 30 days. */
export const ACCOUNT_DELETION_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A Deletion Pending account is still recoverable until its scheduled date. The
 * sign-in resolver uses this to route the owner to recovery instead of refusing
 * outright; a missing schedule (legacy/none) is treated as not recoverable so
 * the account stays blocked rather than silently reopening.
 */
export function isRecoverableDeletionPending(
  deletionScheduledFor: Date | null,
  now: Date
): boolean {
  if (!deletionScheduledFor) return false;
  return now.getTime() < deletionScheduledFor.getTime();
}

export type AccountDeletionAccountRecord = {
  userId: string;
  role: Role;
  email: string | null;
  accountStatus: AccountStatus | null;
  isActive: boolean;
  deletedAt: Date | null;
  studentAnonymized: boolean | null;
};

export interface AccountDeletionTransactionPort {
  findAccount(userId: string): Promise<AccountDeletionAccountRecord | null>;
  markDeletionPending(input: {
    userId: string;
    deletionRequestedAt: Date;
    deletionScheduledFor: Date;
  }): Promise<void>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "ACCOUNT_DELETION_REQUESTED";
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

export interface AccountDeletionDatabasePort {
  transaction<T>(
    work: (tx: AccountDeletionTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type AccountDeletionServiceOptions = {
  mutationsEnabled: boolean;
  recoveryWindowMs: number;
};

export type AccountDeletionResult = {
  userId: string;
  deletionScheduledFor: Date;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

export function createAccountDeletionService(
  database: AccountDeletionDatabasePort,
  options: AccountDeletionServiceOptions
) {
  return {
    /**
     * Self-service deletion (D1): moves the caller's own account to Deletion
     * Pending and schedules anonymization after the recovery window. It never
     * erases anything here — Score, Submission, Attendance, and Audit history
     * stay intact, and the account only leaves the authenticating set through
     * the standard availability predicate. Ownership uses the same re-auth rule
     * as the other sensitive Profile mutations. Recovery and the post-window
     * anonymization are their own later slices.
     */
    async requestOwnDeletion(input: {
      actor: {
        userId: string;
        reauthenticatedAt: Date | null;
      };
      occurredAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<AccountDeletionResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      if (
        !hasRecentReauthentication({
          reauthenticatedAt: input.actor.reauthenticatedAt,
          now: input.occurredAt,
        })
      ) {
        throw new Forbidden("reauthentication_required");
      }

      const deletionScheduledFor = new Date(
        input.occurredAt.getTime() + options.recoveryWindowMs
      );

      return database.transaction(async (tx) => {
        const account = await tx.findAccount(input.actor.userId);
        if (!account) {
          throw new NotFound("account_not_found");
        }

        // Only an available account can be self-deleted: a suspended, already
        // pending, terminated, or anonymized account is out of the owner's
        // hands and must not be re-scheduled from here.
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

        await tx.markDeletionPending({
          userId: account.userId,
          deletionRequestedAt: input.occurredAt,
          deletionScheduledFor,
        });

        await tx.createAuditLogs([
          {
            actorId: account.userId,
            actorRole: account.role,
            action: "ACCOUNT_DELETION_REQUESTED",
            targetType: "User",
            targetId: account.userId,
            targetLabel: account.email ?? account.userId,
            after: {
              accountStatus: "DELETION_PENDING",
              deletionScheduledFor: deletionScheduledFor.toISOString(),
            },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ]);

        return { userId: account.userId, deletionScheduledFor };
      });
    },
  };
}
