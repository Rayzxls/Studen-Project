import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { resolveEmailSender, type EmailSender } from "@/lib/email";
import { Conflict } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createEmailChangeService,
  type EmailChangeDatabasePort,
  type EmailChangeUser,
} from "./email-change-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

const USER_SELECT = {
  id: true,
  email: true,
  identifier: true,
  role: true,
  isActive: true,
  deletedAt: true,
  accountStatus: true,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function createDatabasePort(client: PrismaClient): EmailChangeDatabasePort {
  return {
    findById: async (userId) => {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: USER_SELECT,
      });
      if (!user) return null;
      return {
        userId: user.id,
        email: user.email,
        identifier: user.identifier,
        role: user.role,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        accountStatus: user.accountStatus,
      } satisfies EmailChangeUser;
    },
    writeRequestAudit: async (input) => {
      await client.auditLog.create({
        data: {
          timestamp: input.occurredAt,
          actorId: input.userId,
          actorRole: input.role,
          action: "EMAIL_CHANGE_REQUESTED",
          targetType: "User",
          targetId: input.userId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    },
    applyChange: async (input) => {
      try {
        await client.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: input.userId },
            data: {
              email: input.newEmail,
              emailVerifiedAt: input.occurredAt,
              ...(input.updateIdentifier ? { identifier: input.newEmail } : {}),
              // Revoke every other session: an identity change should not leave
              // sessions established under the old email alive elsewhere.
              sessionVersion: { increment: 1 },
            },
          });
          await tx.auditLog.create({
            data: {
              timestamp: input.occurredAt,
              actorId: input.userId,
              actorRole: input.role,
              action: "EMAIL_CHANGED",
              targetType: "User",
              targetId: input.userId,
              targetLabel: input.newEmail,
              ipAddress: input.ipAddress,
              userAgent: input.userAgent,
            } satisfies Prisma.AuditLogUncheckedCreateInput,
          });
        }, TX_OPTS);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new Conflict("email_taken");
        }
        throw error;
      }
    },
  };
}

export function createPrismaEmailChangeService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env,
  overrides?: { emailSender?: EmailSender }
) {
  const base = (env.AUTH_URL ?? env.NEXTAUTH_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  return createEmailChangeService(createDatabasePort(client), {
    emailSender: overrides?.emailSender ?? resolveEmailSender(env),
    secret: env.AUTH_SECRET ?? "",
    mutationsEnabled: identityFoundationMutationsEnabled(env),
    verifyUrl: (token) =>
      `${base}/verify-email?token=${encodeURIComponent(token)}`,
  });
}
