import type { Role } from "@prisma/client";
import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import {
  decideAccountTransition,
  type AccountStatus,
} from "./lifecycle-policy";
import type {
  AccountLifecycleCommit,
  AccountLifecycleContext,
  AccountLifecycleRepository,
} from "./lifecycle-service";

export type AccountLifecycleUserRecord = {
  userId: string;
  role: Role;
  status: AccountStatus;
  activeOwnedCourseCount: number;
};

export type AccountLifecycleAuditAction =
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED";

export interface AccountLifecycleTransactionPort {
  findUser(userId: string): Promise<AccountLifecycleUserRecord | null>;
  countActiveAdmins(): Promise<number>;
  updateUser(input: {
    userId: string;
    accountStatus: "ACTIVE" | "SUSPENDED";
    isActive: boolean;
  }): Promise<void>;
  revokeActiveSessions(input: {
    userId: string;
    revokedAt: Date;
  }): Promise<void>;
  createLifecycleEvent(input: {
    targetUserId: string;
    actorUserId: string;
    fromStatus: AccountStatus;
    toStatus: AccountStatus;
    reason: string;
    userMessage: string;
    createdAt: Date;
  }): Promise<void>;
  createAuditLog(input: {
    actorId: string;
    actorRole: "ADMIN";
    action: AccountLifecycleAuditAction;
    targetType: "User";
    targetId: string;
    before: { accountStatus: AccountStatus; isActive: boolean };
    after: { accountStatus: AccountStatus; isActive: boolean };
    reason: string;
    timestamp: Date;
  }): Promise<void>;
}

export interface AccountLifecycleDatabasePort {
  loadContext(targetUserId: string): Promise<AccountLifecycleContext | null>;
  transaction<T>(
    work: (tx: AccountLifecycleTransactionPort) => Promise<T>
  ): Promise<T>;
}

function throwCommitPolicyError(code: string): never {
  if (
    code === "admin_lifecycle_operator_required" ||
    code === "account_lifecycle_self_action_forbidden"
  ) {
    throw new Forbidden(code);
  }

  throw new Conflict(code);
}

async function commitTransition(
  database: AccountLifecycleDatabasePort,
  input: AccountLifecycleCommit
): Promise<void> {
  await database.transaction(async (tx) => {
    const [actor, target, activeAdminCount] = await Promise.all([
      tx.findUser(input.actor.userId),
      tx.findUser(input.target.userId),
      tx.countActiveAdmins(),
    ]);

    if (!actor) throw new NotFound("account_lifecycle_actor_not_found");
    if (!target) throw new NotFound("account_not_found");

    if (target.status !== input.transition.from) {
      throw new Conflict("account_lifecycle_state_changed");
    }

    const decision = decideAccountTransition({
      actor: { userId: actor.userId, role: actor.role },
      target,
      to: input.transition.to,
      activeAdminCount,
      temporaryPasswordPrepared: false,
      hasOpenWorkOrDispute: false,
    });

    if (!decision.allowed) {
      throwCommitPolicyError(decision.code);
    }

    if (
      decision.from !== input.transition.from ||
      decision.to !== input.transition.to
    ) {
      throw new Conflict("account_lifecycle_decision_changed");
    }

    if (decision.to !== "ACTIVE" && decision.to !== "SUSPENDED") {
      throw new Conflict("account_lifecycle_transition_scope_invalid");
    }

    const isActive = decision.to === "ACTIVE";
    const action: AccountLifecycleAuditAction = isActive
      ? "ACCOUNT_REACTIVATED"
      : "ACCOUNT_SUSPENDED";

    await tx.updateUser({
      userId: target.userId,
      accountStatus: decision.to,
      isActive,
    });

    if (decision.effects.revokeSessions) {
      await tx.revokeActiveSessions({
        userId: target.userId,
        revokedAt: input.occurredAt,
      });
    }

    await tx.createLifecycleEvent({
      targetUserId: target.userId,
      actorUserId: actor.userId,
      fromStatus: decision.from,
      toStatus: decision.to,
      reason: input.internalReason,
      userMessage: input.userMessage,
      createdAt: input.occurredAt,
    });

    await tx.createAuditLog({
      actorId: actor.userId,
      actorRole: "ADMIN",
      action,
      targetType: "User",
      targetId: target.userId,
      before: {
        accountStatus: decision.from,
        isActive: decision.from === "ACTIVE",
      },
      after: {
        accountStatus: decision.to,
        isActive,
      },
      reason: input.internalReason,
      timestamp: input.occurredAt,
    });
  });
}

export function createTransactionalAccountLifecycleRepository(
  database: AccountLifecycleDatabasePort
): AccountLifecycleRepository {
  return {
    loadContext: (targetUserId) => database.loadContext(targetUserId),
    commitTransition: (input) => commitTransition(database, input),
  };
}
