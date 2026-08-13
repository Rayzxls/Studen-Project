import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import { chatEnabled } from "@/lib/chat/feature-flags";
import {
  ANONYMIZED_STUDENT_NAME,
  anonymizedUserFields,
  createAccountAnonymizationService,
  type AccountAnonymizationDatabasePort,
  type AccountAnonymizationTransactionPort,
} from "./account-anonymization-service";

/** A conservative default so a single manual run never sweeps unbounded rows. */
export const ANONYMIZATION_BATCH_LIMIT = 200;

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient,
  eraseChatContent: boolean
): AccountAnonymizationTransactionPort {
  return {
    reloadCandidate: async (userId) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          accountStatus: true,
          deletionScheduledFor: true,
        },
      });
      if (!user) return null;
      return {
        userId: user.id,
        role: user.role,
        accountStatus: user.accountStatus,
        deletionScheduledFor: user.deletionScheduledFor,
      };
    },
    applyAnonymization: async ({ userId, anonymizedAt }) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...anonymizedUserFields(userId),
          accountStatus: "ANONYMIZED",
          anonymizedAt,
        },
      });
      // Student rows require a name, so they take the placeholder rather than
      // null; the anonymized flag drives any display fallbacks.
      await tx.student.updateMany({
        where: { userId },
        data: {
          anonymized: true,
          firstName: ANONYMIZED_STUDENT_NAME.firstName,
          lastName: ANONYMIZED_STUDENT_NAME.lastName,
        },
      });
      // Detach every linked provider so the anonymized account is unreachable
      // and the Google address is free to start a fresh account later.
      await tx.authIdentity.deleteMany({ where: { userId } });
      if (eraseChatContent) {
        await tx.chatMessage.updateMany({
          where: { authorId: userId, deletedAt: null },
          data: {
            authorId: null,
            body: null,
            deletedAt: anonymizedAt,
            deletionReason: "ACCOUNT_ANONYMIZED",
          },
        });
      }
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
          },
        });
      }
    },
  };
}

export function createPrismaAccountAnonymizationService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const database: AccountAnonymizationDatabasePort = {
    listExpiredDeletionPending: async (now, limit) => {
      const rows = await client.user.findMany({
        where: {
          accountStatus: "DELETION_PENDING",
          deletionScheduledFor: { lt: now },
        },
        select: { id: true, role: true },
        orderBy: { deletionScheduledFor: "asc" },
        take: limit,
      });
      return rows.map((r) => ({ userId: r.id, role: r.role }));
    },
    transaction: async (work) =>
      client.$transaction(
        (tx) => work(createTransactionPort(tx, chatEnabled(env))),
        TX_OPTS
      ),
  };

  return createAccountAnonymizationService(database, {
    mutationsEnabled: identityFoundationMutationsEnabled(env),
    batchLimit: ANONYMIZATION_BATCH_LIMIT,
  });
}
