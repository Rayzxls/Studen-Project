import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { identityFoundationMutationsEnabled } from "./feature-flags";
import {
  createTeacherInviteService,
  type TeacherInviteDatabasePort,
  type TeacherInviteTransactionPort,
  type TeacherInviteUserRecord,
} from "./teacher-invite-service";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 15_000,
  isolationLevel: "Serializable" as const,
};

type UserReader = Pick<Prisma.TransactionClient, "user">;

async function findUser(
  client: UserReader,
  where: { id: string } | { email: string }
): Promise<TeacherInviteUserRecord | null> {
  const user = await client.user.findUnique({
    where,
    select: {
      id: true,
      role: true,
      accountStatus: true,
      deletedAt: true,
    },
  });

  return user
    ? {
        userId: user.id,
        role: user.role,
        accountStatus: user.accountStatus,
        deletedAt: user.deletedAt,
      }
    : null;
}

function createTransactionPort(
  tx: Prisma.TransactionClient
): TeacherInviteTransactionPort {
  return {
    findUser: (userId) => findUser(tx, { id: userId }),
    findUserByEmail: (email) => findUser(tx, { email }),
    listPendingInviteIds: async (email) => {
      const invites = await tx.teacherInvite.findMany({
        where: { email, status: "PENDING" },
        select: { id: true },
      });
      return invites.map((invite) => invite.id);
    },
    createInvite: async (input) => {
      const invite = await tx.teacherInvite.create({
        data: input,
        select: {
          id: true,
          email: true,
          status: true,
          expiresAt: true,
          acceptedByUserId: true,
        },
      });
      return {
        inviteId: invite.id,
        email: invite.email,
        status: invite.status,
        expiresAt: invite.expiresAt,
        acceptedByUserId: invite.acceptedByUserId,
      };
    },
    findInvite: async (inviteId) => {
      const invite = await tx.teacherInvite.findUnique({
        where: { id: inviteId },
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
    revokeInvites: async (input) => {
      await tx.teacherInvite.updateMany({
        where: {
          id: { in: input.inviteIds },
          status: "PENDING",
        },
        data: {
          status: "REVOKED",
          revokedAt: input.revokedAt,
          revokedByUserId: input.revokedByUserId,
          revokeReason: input.reason,
        },
      });
    },
    createAuditLog: async (input) => {
      await tx.auditLog.create({
        data: {
          timestamp: input.timestamp,
          actorId: input.actorId,
          actorRole: "ADMIN",
          action: input.action,
          targetType: "TeacherInvite",
          targetId: input.targetId,
          targetLabel: input.targetLabel,
          before: input.before as Prisma.InputJsonValue | undefined,
          after: input.after as Prisma.InputJsonValue | undefined,
          reason: input.reason,
        },
      });
    },
  };
}

export function createPrismaTeacherInviteService(
  client: PrismaClient = db,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const database: TeacherInviteDatabasePort = {
    transaction: (work) =>
      client.$transaction((tx) => work(createTransactionPort(tx)), TX_OPTS),
  };

  return createTeacherInviteService(database, {
    mutationsEnabled: identityFoundationMutationsEnabled(env),
  });
}
