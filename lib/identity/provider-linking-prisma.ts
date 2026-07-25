import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { Conflict } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createProviderLinkingService,
  type ProviderLinkingDatabasePort,
  type ProviderLinkingTransactionPort,
} from "./provider-linking-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient
): ProviderLinkingTransactionPort {
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
    findGoogleIdentity: async (providerAccountId) => {
      const identity = await tx.authIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "GOOGLE",
            providerAccountId,
          },
        },
        select: { userId: true },
      });
      return identity;
    },
    countGoogleIdentitiesForUser: async (userId) =>
      tx.authIdentity.count({ where: { userId, provider: "GOOGLE" } }),
    linkGoogleIdentity: async (input) => {
      const identity = await tx.authIdentity.create({
        data: {
          userId: input.userId,
          provider: "GOOGLE",
          providerAccountId: input.providerAccountId,
          providerEmail: input.providerEmail,
          linkedAt: input.linkedAt,
        },
        select: { id: true },
      });
      return { identityId: identity.id };
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function createPrismaProviderLinkingService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const database: ProviderLinkingDatabasePort = {
    transaction: async (work) => {
      try {
        return await client.$transaction(
          (tx) => work(createTransactionPort(tx)),
          TX_OPTS
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new Conflict("google_identity_already_linked");
        }
        throw error;
      }
    },
  };

  return createProviderLinkingService(database, {
    mutationsEnabled: identityFoundationMutationsEnabled(env),
  });
}
