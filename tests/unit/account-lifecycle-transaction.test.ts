import { describe, expect, it, vi } from "vitest";
import {
  createTransactionalAccountLifecycleRepository,
  type AccountLifecycleDatabasePort,
  type AccountLifecycleTransactionPort,
  type AccountLifecycleUserRecord,
} from "@/lib/account/transactional-repository";
import { suspendOrReactivateAccount } from "@/lib/account/lifecycle-service";

function createHarness(options?: {
  actor?: AccountLifecycleUserRecord;
  target?: AccountLifecycleUserRecord;
  previewStatus?: "ACTIVE" | "SUSPENDED";
  activeAdminCount?: number;
}) {
  let insideTransaction = false;
  const actor = options?.actor ?? {
    userId: "admin-1",
    role: "ADMIN",
    status: "ACTIVE",
    activeOwnedCourseCount: 0,
  };
  const target = options?.target ?? {
    userId: "student-1",
    role: "STUDENT",
    status: "ACTIVE",
    activeOwnedCourseCount: 0,
  };
  const assertInside = () => {
    if (!insideTransaction) throw new Error("write_outside_transaction");
  };

  const tx: AccountLifecycleTransactionPort = {
    findUser: vi.fn(async (userId) => {
      assertInside();
      if (userId === actor.userId) return actor;
      if (userId === target.userId) return target;
      return null;
    }),
    countActiveAdmins: vi.fn(async () => {
      assertInside();
      return options?.activeAdminCount ?? 2;
    }),
    updateUser: vi.fn(async () => assertInside()),
    revokeActiveSessions: vi.fn(async () => assertInside()),
    createLifecycleEvent: vi.fn(async () => assertInside()),
    createAuditLog: vi.fn(async () => assertInside()),
  };

  const database: AccountLifecycleDatabasePort = {
    loadContext: vi.fn(async () => ({
      target: {
        ...target,
        status: options?.previewStatus ?? target.status,
      },
      activeAdminCount: options?.activeAdminCount ?? 2,
      hasOpenWorkOrDispute: false,
    })),
    transaction: vi.fn(async (work) => {
      insideTransaction = true;
      try {
        return await work(tx);
      } finally {
        insideTransaction = false;
      }
    }),
  };

  return { database, tx };
}

const command = {
  actor: { userId: "admin-1", role: "ADMIN" as const },
  targetUserId: "student-1",
  to: "SUSPENDED" as const,
  internalReason: "Temporary access restriction for review",
  userMessage: "Your account is temporarily unavailable.",
};

describe("transactional account lifecycle repository", () => {
  it("persists status, session revocation, lifecycle history, and audit atomically", async () => {
    const { database, tx } = createHarness();
    const occurredAt = new Date("2026-07-15T03:00:00.000Z");
    const repository = createTransactionalAccountLifecycleRepository(database);

    await suspendOrReactivateAccount(command, {
      repository,
      mutationsEnabled: true,
      now: () => occurredAt,
    });

    expect(database.transaction).toHaveBeenCalledOnce();
    expect(tx.updateUser).toHaveBeenCalledWith({
      userId: "student-1",
      accountStatus: "SUSPENDED",
      isActive: false,
    });
    expect(tx.revokeActiveSessions).toHaveBeenCalledWith({
      userId: "student-1",
      revokedAt: occurredAt,
    });
    expect(tx.createLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: "ACTIVE",
        toStatus: "SUSPENDED",
        reason: command.internalReason,
        userMessage: command.userMessage,
      })
    );
    expect(tx.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ACCOUNT_SUSPENDED",
        before: { accountStatus: "ACTIVE", isActive: true },
        after: { accountStatus: "SUSPENDED", isActive: false },
      })
    );
  });

  it("re-checks the actor role inside the transaction", async () => {
    const { database, tx } = createHarness({
      actor: {
        userId: "admin-1",
        role: "TEACHER",
        status: "ACTIVE",
        activeOwnedCourseCount: 0,
      },
    });
    const repository = createTransactionalAccountLifecycleRepository(database);

    await expect(
      suspendOrReactivateAccount(command, {
        repository,
        mutationsEnabled: true,
      })
    ).rejects.toMatchObject({ code: "admin_lifecycle_operator_required" });

    expect(tx.updateUser).not.toHaveBeenCalled();
    expect(tx.createAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a stale preview when target state changes before commit", async () => {
    const { database, tx } = createHarness({
      target: {
        userId: "student-1",
        role: "STUDENT",
        status: "SUSPENDED",
        activeOwnedCourseCount: 0,
      },
      previewStatus: "ACTIVE",
    });
    const repository = createTransactionalAccountLifecycleRepository(database);

    await expect(
      suspendOrReactivateAccount(command, {
        repository,
        mutationsEnabled: true,
      })
    ).rejects.toMatchObject({ code: "account_lifecycle_state_changed" });

    expect(tx.updateUser).not.toHaveBeenCalled();
    expect(tx.createLifecycleEvent).not.toHaveBeenCalled();
  });

  it("re-checks last-active-Admin protection inside the transaction", async () => {
    const { database, tx } = createHarness({
      target: {
        userId: "admin-2",
        role: "ADMIN",
        status: "ACTIVE",
        activeOwnedCourseCount: 0,
      },
      activeAdminCount: 1,
    });
    const repository = createTransactionalAccountLifecycleRepository(database);

    await expect(
      suspendOrReactivateAccount(
        { ...command, targetUserId: "admin-2" },
        { repository, mutationsEnabled: true }
      )
    ).rejects.toMatchObject({ code: "last_active_admin_protected" });

    expect(tx.updateUser).not.toHaveBeenCalled();
    expect(tx.revokeActiveSessions).not.toHaveBeenCalled();
  });

  it("writes the matching reactivation state and audit event", async () => {
    const { database, tx } = createHarness({
      target: {
        userId: "student-1",
        role: "STUDENT",
        status: "SUSPENDED",
        activeOwnedCourseCount: 0,
      },
    });
    const repository = createTransactionalAccountLifecycleRepository(database);

    await suspendOrReactivateAccount(
      { ...command, to: "ACTIVE" },
      { repository, mutationsEnabled: true }
    );

    expect(tx.updateUser).toHaveBeenCalledWith({
      userId: "student-1",
      accountStatus: "ACTIVE",
      isActive: true,
    });
    expect(tx.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACCOUNT_REACTIVATED" })
    );
  });
});
