import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  ACCOUNT_DELETION_RECOVERY_WINDOW_MS,
  createAccountDeletionService,
  type AccountDeletionDatabasePort,
  type AccountDeletionTransactionPort,
} from "./account-deletion-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient
): AccountDeletionTransactionPort {
  return {
    findAccount: async (userId) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          accountStatus: true,
          isActive: true,
          deletedAt: true,
          student: { select: { anonymized: true } },
        },
      });
      if (!user) return null;

      return {
        userId: user.id,
        role: user.role,
        email: user.email,
        accountStatus: user.accountStatus,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        studentAnonymized: user.student?.anonymized ?? null,
      };
    },
    markDeletionPending: async (input) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          accountStatus: "DELETION_PENDING",
          deletionRequestedAt: input.deletionRequestedAt,
          deletionScheduledFor: input.deletionScheduledFor,
          // Revoke every existing session, not just this device's cookie: the
          // bump invalidates all tokens on their next protected request.
          sessionVersion: { increment: 1 },
        },
      });
    },
    createAuditLogs: async (inputs) => {
      for (const input of inputs) {
        await tx.auditLog.create({
          data: {
            timestamp: input.timestamp,
            actorId: input.actorId,
            actorRole: input.actorRole,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
            targetLabel: input.targetLabel,
            after: input.after as Prisma.InputJsonValue,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        });
      }
    },
  };
}

export function createPrismaAccountDeletionService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const database: AccountDeletionDatabasePort = {
    transaction: async (work) =>
      client.$transaction((tx) => work(createTransactionPort(tx)), TX_OPTS),
  };

  return createAccountDeletionService(database, {
    mutationsEnabled: identityFoundationMutationsEnabled(env),
    recoveryWindowMs: ACCOUNT_DELETION_RECOVERY_WINDOW_MS,
  });
}
