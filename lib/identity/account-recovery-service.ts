import type { Role } from "@prisma/client";

import { Conflict, NotFound } from "@/lib/errors";
import type { AccountStatus } from "@/lib/account/status";
import { isRecoverableDeletionPending } from "./account-deletion-service";

export type AccountRecoveryRecord = {
  userId: string;
  role: Role;
  email: string | null;
  accountStatus: AccountStatus | null;
  deletionScheduledFor: Date | null;
};

export interface AccountRecoveryTransactionPort {
  findAccount(userId: string): Promise<AccountRecoveryRecord | null>;
  clearDeletionPending(input: { userId: string }): Promise<void>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "ACCOUNT_DELETION_CANCELLED";
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

export interface AccountRecoveryDatabasePort {
  transaction<T>(
    work: (tx: AccountRecoveryTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type AccountRecoveryServiceOptions = {
  mutationsEnabled: boolean;
};

export type AccountRecoveryResult = {
  userId: string;
  role: Role;
  email: string;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

export function createAccountRecoveryService(
  database: AccountRecoveryDatabasePort,
  options: AccountRecoveryServiceOptions
) {
  return {
    /**
     * Cancels a pending self-deletion and returns the account to Active, for a
     * caller who just proved ownership through Google in the recovery flow. It
     * only ever moves a still-recoverable Deletion Pending account back; a
     * lapsed window or any other state fails closed so the standard availability
     * predicate keeps the account blocked.
     */
    async recoverOwnAccount(input: {
      userId: string;
      occurredAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<AccountRecoveryResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      return database.transaction(async (tx) => {
        const account = await tx.findAccount(input.userId);
        if (!account) {
          throw new NotFound("account_not_found");
        }

        if (
          account.accountStatus !== "DELETION_PENDING" ||
          !isRecoverableDeletionPending(
            account.deletionScheduledFor,
            input.occurredAt
          )
        ) {
          throw new Conflict("account_not_recoverable");
        }
        if (!account.email) {
          throw new Conflict("account_not_recoverable");
        }

        await tx.clearDeletionPending({ userId: account.userId });

        await tx.createAuditLogs([
          {
            actorId: account.userId,
            actorRole: account.role,
            action: "ACCOUNT_DELETION_CANCELLED",
            targetType: "User",
            targetId: account.userId,
            targetLabel: account.email,
            after: { accountStatus: "ACTIVE" },
            timestamp: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ]);

        return {
          userId: account.userId,
          role: account.role,
          email: account.email,
        };
      });
    },
  };
}
