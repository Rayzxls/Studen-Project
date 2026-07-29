import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { resolveEmailSender, type EmailSender } from "@/lib/email";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createPasswordRecoveryService,
  type PasswordRecoveryDatabasePort,
  type RecoverableUser,
} from "./password-recovery-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  passwordHash: true,
  isActive: true,
  deletedAt: true,
  accountStatus: true,
} as const;

function toRecoverable(user: {
  id: string;
  email: string | null;
  role: RecoverableUser["role"];
  passwordHash: string;
  isActive: boolean;
  deletedAt: Date | null;
  accountStatus: RecoverableUser["accountStatus"];
}): RecoverableUser {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
    accountStatus: user.accountStatus,
  };
}

function createDatabasePort(
  client: PrismaClient
): PasswordRecoveryDatabasePort {
  return {
    findByEmail: async (email) => {
      const user = await client.user.findUnique({
        where: { email },
        select: USER_SELECT,
      });
      return user ? toRecoverable(user) : null;
    },
    findById: async (userId) => {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: USER_SELECT,
      });
      return user ? toRecoverable(user) : null;
    },
    writeRequestAudit: async (input) => {
      await client.auditLog.create({
        data: {
          timestamp: input.occurredAt,
          actorId: input.userId,
          actorRole: input.role,
          action: "PASSWORD_RESET_REQUESTED",
          targetType: "User",
          targetId: input.userId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    },
    applyReset: async (input) => {
      await client.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            passwordHash: input.passwordHash,
            // Revoke every other session: a recovered password ends sessions an
            // attacker may hold.
            sessionVersion: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            timestamp: input.occurredAt,
            actorId: input.userId,
            actorRole: input.role,
            action: "PASSWORD_RESET_COMPLETED",
            targetType: "User",
            targetId: input.userId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          } satisfies Prisma.AuditLogUncheckedCreateInput,
        });
      }, TX_OPTS);
    },
  };
}

export function createPrismaPasswordRecoveryService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env,
  // Tests inject a captured sender to read the emitted link; production leaves
  // it undefined and uses the environment's resolved (fail-closed) sender.
  overrides?: { emailSender?: EmailSender }
) {
  const base = (env.AUTH_URL ?? env.NEXTAUTH_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  return createPasswordRecoveryService(createDatabasePort(client), {
    emailSender: overrides?.emailSender ?? resolveEmailSender(env),
    secret: env.AUTH_SECRET ?? "",
    mutationsEnabled: identityFoundationMutationsEnabled(env),
    hashPassword,
    resetUrl: (token) =>
      `${base}/reset-password/confirm?token=${encodeURIComponent(token)}`,
  });
}
