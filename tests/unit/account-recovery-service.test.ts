import { describe, expect, it, vi } from "vitest";

import {
  createAccountRecoveryService,
  type AccountRecoveryRecord,
  type AccountRecoveryTransactionPort,
} from "@/lib/identity/account-recovery-service";

const now = new Date("2026-07-24T10:00:00.000Z");
const future = new Date("2026-08-20T00:00:00.000Z");
const past = new Date("2026-07-01T00:00:00.000Z");

const pendingAccount: AccountRecoveryRecord = {
  userId: "user-1",
  role: "STUDENT",
  email: "student@example.com",
  accountStatus: "DELETION_PENDING",
  deletionScheduledFor: future,
};

function harness(
  account: AccountRecoveryRecord | null,
  mutationsEnabled = true
) {
  const clearDeletionPending = vi.fn(async () => {});
  const createAuditLogs = vi.fn(async () => {});
  const port: AccountRecoveryTransactionPort = {
    findAccount: vi.fn(async () => account),
    clearDeletionPending,
    createAuditLogs,
  };
  const database = {
    transaction: <T>(
      work: (tx: AccountRecoveryTransactionPort) => Promise<T>
    ) => work(port),
  };
  return {
    svc: createAccountRecoveryService(database, { mutationsEnabled }),
    clearDeletionPending,
    createAuditLogs,
  };
}

describe("account recovery service", () => {
  it("fails closed when identity mutations are disabled", async () => {
    const { svc } = harness(pendingAccount, false);
    await expect(
      svc.recoverOwnAccount({ userId: "user-1", occurredAt: now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });

  it("refuses an account that is not Deletion Pending", async () => {
    const { svc, clearDeletionPending } = harness({
      ...pendingAccount,
      accountStatus: "ACTIVE",
    });
    await expect(
      svc.recoverOwnAccount({ userId: "user-1", occurredAt: now })
    ).rejects.toMatchObject({ code: "account_not_recoverable" });
    expect(clearDeletionPending).not.toHaveBeenCalled();
  });

  it("refuses once the recovery window has lapsed", async () => {
    const { svc } = harness({ ...pendingAccount, deletionScheduledFor: past });
    await expect(
      svc.recoverOwnAccount({ userId: "user-1", occurredAt: now })
    ).rejects.toMatchObject({ code: "account_not_recoverable" });
  });

  it("returns the account to Active and audits the cancellation", async () => {
    const { svc, clearDeletionPending, createAuditLogs } =
      harness(pendingAccount);

    const result = await svc.recoverOwnAccount({
      userId: "user-1",
      occurredAt: now,
      ipAddress: "127.0.0.1",
      userAgent: "unit",
    });

    expect(result).toEqual({
      userId: "user-1",
      role: "STUDENT",
      email: "student@example.com",
    });
    expect(clearDeletionPending).toHaveBeenCalledWith({ userId: "user-1" });
    expect(createAuditLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "ACCOUNT_DELETION_CANCELLED",
        actorId: "user-1",
        targetType: "User",
      }),
    ]);
  });
});
