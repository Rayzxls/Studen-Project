import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createGoogleSignInService,
  type GoogleSignInDatabasePort,
  type GoogleSignInTransactionPort,
} from "./google-signin-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient
): GoogleSignInTransactionPort {
  return {
    findGoogleIdentity: async (providerAccountId) => {
      const identity = await tx.authIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "GOOGLE",
            providerAccountId,
          },
        },
        select: { id: true, userId: true, providerEmail: true },
      });
      return identity
        ? {
            identityId: identity.id,
            userId: identity.userId,
            providerEmail: identity.providerEmail,
          }
        : null;
    },
    findAccount: async (userId) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          firstName: true,
          lastName: true,
          sessionVersion: true,
          accountStatus: true,
          isActive: true,
          deletedAt: true,
          student: { select: { anonymized: true } },
          consentAcceptances: { select: { document: true, version: true } },
        },
      });
      if (!user) return null;

      return {
        userId: user.id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        sessionVersion: user.sessionVersion,
        accountStatus: user.accountStatus,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        studentAnonymized: user.student?.anonymized ?? null,
        consentAcceptances: user.consentAcceptances,
      };
    },
    recordIdentityUse: async (input) => {
      await tx.authIdentity.update({
        where: { id: input.identityId },
        data: {
          lastUsedAt: input.lastUsedAt,
          providerEmail: input.providerEmail,
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

export function createPrismaGoogleSignInService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const termsOfUseVersion = env.IDENTITY_TERMS_VERSION?.trim() ?? "";
  const privacyNoticeVersion = env.IDENTITY_PRIVACY_VERSION?.trim() ?? "";
  const configurationReady =
    termsOfUseVersion.length > 0 && privacyNoticeVersion.length > 0;

  const database: GoogleSignInDatabasePort = {
    transaction: async (work) =>
      client.$transaction((tx) => work(createTransactionPort(tx)), TX_OPTS),
  };

  return createGoogleSignInService(database, {
    mutationsEnabled:
      identityFoundationMutationsEnabled(env) && configurationReady,
    requiredConsent: {
      termsOfUseVersion,
      privacyNoticeVersion,
    },
  });
}
