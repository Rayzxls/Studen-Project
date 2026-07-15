import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";
import type {
  AccountLifecycleDatabasePort,
  AccountLifecycleTransactionPort,
  AccountLifecycleUserRecord,
} from "./transactional-repository";
import { createTransactionalAccountLifecycleRepository } from "./transactional-repository";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 15_000,
  isolationLevel: "Serializable" as const,
};

type UserReader = Pick<Prisma.TransactionClient, "user">;

async function findUserRecord(
  client: UserReader,
  userId: string
): Promise<AccountLifecycleUserRecord | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      accountStatus: true,
      teacher: {
        select: {
          _count: {
            select: { courses: { where: { archivedAt: null } } },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    userId: user.id,
    role: user.role,
    status: user.accountStatus,
    activeOwnedCourseCount: user.teacher?._count.courses ?? 0,
  };
}

function createTransactionPort(
  tx: Prisma.TransactionClient
): AccountLifecycleTransactionPort {
  return {
    findUser: (userId) => findUserRecord(tx, userId),
    countActiveAdmins: () =>
      tx.user.count({
        where: {
          role: "ADMIN",
          accountStatus: "ACTIVE",
          deletedAt: null,
        },
      }),
    updateUser: async ({ userId, accountStatus, isActive }) => {
      await tx.user.update({
        where: { id: userId },
        data: { accountStatus, isActive },
      });
    },
    revokeActiveSessions: async ({ userId, revokedAt }) => {
      await tx.userSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: revokedAt },
        },
        data: { revokedAt },
      });
    },
    createLifecycleEvent: async (input) => {
      await tx.accountLifecycleEvent.create({ data: input });
    },
    createAuditLog: async (input) => {
      await tx.auditLog.create({
        data: {
          timestamp: input.timestamp,
          actorId: input.actorId,
          actorRole: input.actorRole,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          before: input.before,
          after: input.after,
          reason: input.reason,
        },
      });
    },
  };
}

export function createPrismaAccountLifecycleRepository(
  client: PrismaClient = db
) {
  const database: AccountLifecycleDatabasePort = {
    loadContext: async (targetUserId) => {
      const [target, activeAdminCount] = await Promise.all([
        findUserRecord(client, targetUserId),
        client.user.count({
          where: {
            role: "ADMIN",
            accountStatus: "ACTIVE",
            deletedAt: null,
          },
        }),
      ]);

      if (!target) return null;

      return {
        target,
        activeAdminCount,
        hasOpenWorkOrDispute: false,
      };
    },
    transaction: (work) =>
      client.$transaction((tx) => work(createTransactionPort(tx)), TX_OPTS),
  };

  return createTransactionalAccountLifecycleRepository(database);
}
