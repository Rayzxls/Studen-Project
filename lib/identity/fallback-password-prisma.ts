import type { Prisma, PrismaClient } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createFallbackPasswordService,
  type FallbackPasswordDatabasePort,
  type FallbackPasswordTransactionPort,
} from "./fallback-password-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient
): FallbackPasswordTransactionPort {
  return {
    findAccount: async (userId) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          passwordHash: true,
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
        passwordHash: user.passwordHash,
        accountStatus: user.accountStatus,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        studentAnonymized: user.student?.anonymized ?? null,
      };
    },
    setPasswordHash: async (input) => {
      await tx.user.update({
        where: { id: input.userId },
        data: { passwordHash: input.passwordHash },
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

export function createPrismaFallbackPasswordService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const database: FallbackPasswordDatabasePort = {
    transaction: async (work) =>
      client.$transaction((tx) => work(createTransactionPort(tx)), TX_OPTS),
  };

  return createFallbackPasswordService(database, {
    mutationsEnabled: identityFoundationMutationsEnabled(env),
    passwordHasher: hashPassword,
  });
}
