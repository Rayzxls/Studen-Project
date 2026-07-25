import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createAccountRecoveryService,
  type AccountRecoveryDatabasePort,
  type AccountRecoveryTransactionPort,
} from "./account-recovery-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient
): AccountRecoveryTransactionPort {
  return {
    findAccount: async (userId) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          accountStatus: true,
          deletionScheduledFor: true,
        },
      });
      if (!user) return null;

      return {
        userId: user.id,
        role: user.role,
        email: user.email,
        accountStatus: user.accountStatus,
        deletionScheduledFor: user.deletionScheduledFor,
      };
    },
    clearDeletionPending: async (input) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          accountStatus: "ACTIVE",
          deletionRequestedAt: null,
          deletionScheduledFor: null,
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

export function createPrismaAccountRecoveryService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const database: AccountRecoveryDatabasePort = {
    transaction: async (work) =>
      client.$transaction((tx) => work(createTransactionPort(tx)), TX_OPTS),
  };

  return createAccountRecoveryService(database, {
    mutationsEnabled: identityFoundationMutationsEnabled(env),
  });
}
