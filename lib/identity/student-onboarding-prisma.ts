import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { Conflict } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createStudentOnboardingService,
  type StudentOnboardingDatabasePort,
  type StudentOnboardingTransactionPort,
} from "./student-onboarding-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

/**
 * ADR-0039 retires the human-entered enrolment identifier, but the legacy
 * `Student` row still carries a required unique column. Identity V2 accounts
 * therefore receive an opaque, obviously-synthetic placeholder: it is never
 * shown, never typed by a person, and never used for authentication or lookup.
 * The prefix keeps the remaining schema debt greppable until the column is
 * dropped by the approved destructive migration.
 */
function unassignedLegacyIdentifier(): string {
  return `identity-v2-unassigned:${randomUUID()}`;
}

function createTransactionPort(
  tx: Prisma.TransactionClient
): StudentOnboardingTransactionPort {
  return {
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
    createStudentAccount: async (input) => {
      const user = await tx.user.create({
        data: {
          identifier: input.email,
          passwordHash: input.compatibilityPasswordHash,
          role: "STUDENT",
          mustResetPwd: false, // dependency-gate-allow(temporary-password): legacy non-null schema bridge; no credential is issued
          email: input.email,
          emailVerifiedAt: input.emailVerifiedAt,
          firstName: input.firstName,
          lastName: input.lastName,
          createdAt: input.createdAt,
          student: {
            create: {
              studentId: unassignedLegacyIdentifier(), // dependency-gate-allow(student-id-symbol-review): legacy required unique column; synthetic placeholder is never displayed or used for lookup
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

export function createPrismaStudentOnboardingService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const termsOfUseVersion = env.IDENTITY_TERMS_VERSION?.trim() ?? "";
  const privacyNoticeVersion = env.IDENTITY_PRIVACY_VERSION?.trim() ?? "";
  const configurationReady =
    termsOfUseVersion.length > 0 && privacyNoticeVersion.length > 0;

  const database: StudentOnboardingDatabasePort = {
    transaction: async (work) => {
      try {
        return await client.$transaction(
          (tx) => work(createTransactionPort(tx)),
          TX_OPTS
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new Conflict("student_onboarding_collision");
        }
        throw error;
      }
    },
  };

  return createStudentOnboardingService(database, {
    mutationsEnabled:
      identityFoundationMutationsEnabled(env) && configurationReady,
    requiredConsent: {
      termsOfUseVersion,
      privacyNoticeVersion,
    },
  });
}
