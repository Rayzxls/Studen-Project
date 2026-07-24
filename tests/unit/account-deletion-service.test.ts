import { describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_DELETION_RECOVERY_WINDOW_MS,
  createAccountDeletionService,
  type AccountDeletionAccountRecord,
  type AccountDeletionTransactionPort,
} from "@/lib/identity/account-deletion-service";

const now = new Date("2026-07-24T10:00:00.000Z");
const recentReauth = new Date("2026-07-24T09:55:00.000Z"); // 5 min ago
const staleReauth = new Date("2026-07-24T09:30:00.000Z"); // 30 min ago

const availableAccount: AccountDeletionAccountRecord = {
  userId: "user-1",
  role: "STUDENT",
  email: "student@example.com",
  accountStatus: "ACTIVE",
  isActive: true,
  deletedAt: null,
  studentAnonymized: false,
};

function makePort(account: AccountDeletionAccountRecord | null) {
  const markDeletionPending = vi.fn(async () => {});
  const createAuditLogs = vi.fn(async () => {});
  const port: AccountDeletionTransactionPort = {
    findAccount: vi.fn(async () => account),
    markDeletionPending,
    createAuditLogs,
  };
  const database = {
    transaction: <T>(
      work: (tx: AccountDeletionTransactionPort) => Promise<T>
    ) => work(port),
  };
  return { database, markDeletionPending, createAuditLogs };
}

function service(
  account: AccountDeletionAccountRecord | null,
  mutationsEnabled = true
) {
  const { database, markDeletionPending, createAuditLogs } = makePort(account);
  return {
    svc: createAccountDeletionService(database, {
      mutationsEnabled,
      recoveryWindowMs: ACCOUNT_DELETION_RECOVERY_WINDOW_MS,
    }),
    markDeletionPending,
    createAuditLogs,
  };
}

describe("account deletion service", () => {
  it("fails closed when identity mutations are disabled", async () => {
    const { svc } = service(availableAccount, false);
    await expect(
      svc.requestOwnDeletion({
        actor: { userId: "user-1", reauthenticatedAt: recentReauth },
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });

  it("requires a recent re-authentication", async () => {
    const { svc, markDeletionPending } = service(availableAccount);
    await expect(
      svc.requestOwnDeletion({
        actor: { userId: "user-1", reauthenticatedAt: staleReauth },
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "reauthentication_required" });
    expect(markDeletionPending).not.toHaveBeenCalled();
  });

  it("refuses an account that is not available (already pending, suspended, …)", async () => {
    const { svc } = service({
      ...availableAccount,
      accountStatus: "DELETION_PENDING",
    });
    await expect(
      svc.requestOwnDeletion({
        actor: { userId: "user-1", reauthenticatedAt: recentReauth },
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "account_not_available" });
  });

  it("schedules Deletion Pending a full recovery window out and audits it", async () => {
    const { svc, markDeletionPending, createAuditLogs } =
      service(availableAccount);

    const result = await svc.requestOwnDeletion({
      actor: { userId: "user-1", reauthenticatedAt: recentReauth },
      occurredAt: now,
      ipAddress: "127.0.0.1",
      userAgent: "unit",
    });

    const expectedScheduled = new Date(
      now.getTime() + ACCOUNT_DELETION_RECOVERY_WINDOW_MS
    );
    expect(result).toEqual({
      userId: "user-1",
      deletionScheduledFor: expectedScheduled,
    });
    expect(markDeletionPending).toHaveBeenCalledWith({
      userId: "user-1",
      deletionRequestedAt: now,
      deletionScheduledFor: expectedScheduled,
    });
    expect(createAuditLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "ACCOUNT_DELETION_REQUESTED",
        actorId: "user-1",
        targetType: "User",
      }),
    ]);
  });
});
