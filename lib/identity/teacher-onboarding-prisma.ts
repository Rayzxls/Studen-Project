import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { Conflict } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createTeacherOnboardingService,
  type TeacherOnboardingDatabasePort,
  type TeacherOnboardingTransactionPort,
} from "./teacher-onboarding-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

function createTransactionPort(
  tx: Prisma.TransactionClient
): TeacherOnboardingTransactionPort {
  return {
    findInviteByTokenHash: async (tokenHash) => {
      const invite = await tx.teacherInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          email: true,
          status: true,
          expiresAt: true,
          acceptedByUserId: true,
        },
      });
      return invite
        ? {
            inviteId: invite.id,
            email: invite.email,
            status: invite.status,
            expiresAt: invite.expiresAt,
            acceptedByUserId: invite.acceptedByUserId,
          }
        : null;
    },
    findUserByEmail: async (email) => {
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });
      return user ? { userId: user.id, role: user.role } : null;
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
    createTeacherAccount: async (input) => {
      const user = await tx.user.create({
        data: {
          identifier: input.email,
          passwordHash: input.compatibilityPasswordHash,
          role: "TEACHER",
          mustResetPwd: false, // dependency-gate-allow(temporary-password): legacy non-null schema bridge; no credential is issued
          email: input.email,
          emailVerifiedAt: input.emailVerifiedAt,
          firstName: input.firstName,
          lastName: input.lastName,
          createdAt: input.createdAt,
          teacher: {
            create: {
              email: input.email,
              firstName: input.firstName,
              lastName: input.lastName,
            },
          },
          authIdentities: {
            create: {
              provider: "GOOGLE",
              providerAccountId: input.providerAccountId,
              providerEmail: input.providerEmail,
              linkedAt: input.createdAt,
              lastUsedAt: input.createdAt,
            },
          },
        },
        select: { id: true },
      });
      return { userId: user.id };
    },
    acceptInvite: async (input) => {
      const updated = await tx.teacherInvite.updateMany({
        where: {
          id: input.inviteId,
          status: "PENDING",
          acceptedByUserId: null,
          expiresAt: { gt: input.acceptedAt },
        },
        data: {
          status: "ACCEPTED",
          acceptedAt: input.acceptedAt,
          acceptedByUserId: input.acceptedByUserId,
        },
      });
      return updated.count === 1;
    },
    createConsentAcceptances: async (input) => {
      await tx.consentAcceptance.createMany({
        data: [
          {
            userId: input.userId,
            document: "TERMS_OF_USE",
            version: input.termsOfUseVersion,
            acceptedAt: input.acceptedAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
          {
            userId: input.userId,
            document: "PRIVACY_NOTICE",
            version: input.privacyNoticeVersion,
            acceptedAt: input.acceptedAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ],
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function createPrismaTeacherOnboardingService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const termsOfUseVersion = env.IDENTITY_TERMS_VERSION?.trim() ?? "";
  const privacyNoticeVersion = env.IDENTITY_PRIVACY_VERSION?.trim() ?? "";
  const configurationReady =
    termsOfUseVersion.length > 0 && privacyNoticeVersion.length > 0;

  const database: TeacherOnboardingDatabasePort = {
    transaction: async (work) => {
      try {
        return await client.$transaction(
          (tx) => work(createTransactionPort(tx)),
          TX_OPTS
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new Conflict("teacher_onboarding_collision");
        }
        throw error;
      }
    },
  };

  return createTeacherOnboardingService(database, {
    mutationsEnabled:
      identityFoundationMutationsEnabled(env) && configurationReady,
    requiredConsent: {
      termsOfUseVersion,
      privacyNoticeVersion,
    },
  });
}
