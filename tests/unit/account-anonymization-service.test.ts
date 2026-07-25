import { describe, expect, it, vi } from "vitest";

import {
  anonymizedUserFields,
  createAccountAnonymizationService,
  type AccountAnonymizationDatabasePort,
  type AccountAnonymizationTransactionPort,
  type AnonymizationCandidate,
} from "@/lib/identity/account-anonymization-service";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "@/lib/identity/foundation";

const now = new Date("2026-08-25T00:00:00.000Z");
const pastWindow = new Date("2026-08-20T00:00:00.000Z"); // before now → expired
const futureWindow = new Date("2026-09-20T00:00:00.000Z"); // after now → still recoverable

describe("anonymizedUserFields", () => {
  it("nulls PII, resets the credential, and derives an opaque identifier", () => {
    expect(anonymizedUserFields("user-1")).toEqual({
      identifier: "anonymized:user-1",
      email: null,
      emailVerifiedAt: null,
      passwordHash: DISABLED_COMPATIBILITY_PASSWORD_HASH,
      firstName: null,
      lastName: null,
      displayName: null, // dependency-gate-allow(legacy-display-name): asserts the legacy column is nulled on anonymization
      profileImageId: null,
      isActive: false,
    });
  });
});

function harness(
  candidates: ReadonlyArray<{ userId: string; role: "STUDENT" }>,
  reload: Record<string, AnonymizationCandidate | null>
) {
  const applyAnonymization = vi.fn(async () => {});
  const createAuditLogs = vi.fn(async () => {});
  const tx: AccountAnonymizationTransactionPort = {
    reloadCandidate: vi.fn(async (userId) => reload[userId] ?? null),
    applyAnonymization,
    createAuditLogs,
  };
  const database: AccountAnonymizationDatabasePort = {
    listExpiredDeletionPending: vi.fn(async () => candidates),
    transaction: (work) => work(tx),
  };
  return {
    svc: createAccountAnonymizationService(database, {
      mutationsEnabled: true,
      batchLimit: 200,
    }),
    applyAnonymization,
    createAuditLogs,
  };
}

describe("account anonymization service", () => {
  it("fails closed when identity mutations are disabled", async () => {
    const database: AccountAnonymizationDatabasePort = {
      listExpiredDeletionPending: vi.fn(async () => []),
      transaction: (work) => work({} as AccountAnonymizationTransactionPort),
    };
    const svc = createAccountAnonymizationService(database, {
      mutationsEnabled: false,
      batchLimit: 200,
    });
    await expect(svc.anonymizeExpiredDeletions({ now })).rejects.toMatchObject({
      code: "identity_foundation_not_found",
    });
  });

  it("anonymizes an expired account but skips one recovered since listing", async () => {
    const { svc, applyAnonymization, createAuditLogs } = harness(
      [
        { userId: "expired", role: "STUDENT" },
        { userId: "recovered", role: "STUDENT" },
      ],
      {
        expired: {
          userId: "expired",
          role: "STUDENT",
          accountStatus: "DELETION_PENDING",
          deletionScheduledFor: pastWindow,
        },
        // Recovered between listing and the transaction: back to ACTIVE.
        recovered: {
          userId: "recovered",
          role: "STUDENT",
          accountStatus: "ACTIVE",
          deletionScheduledFor: null,
        },
      }
    );

    const result = await svc.anonymizeExpiredDeletions({ now });

    expect(result.anonymizedUserIds).toEqual(["expired"]);
    expect(result.skippedUserIds).toEqual(["recovered"]);
    expect(applyAnonymization).toHaveBeenCalledTimes(1);
    expect(applyAnonymization).toHaveBeenCalledWith({
      userId: "expired",
      anonymizedAt: now,
    });
    expect(createAuditLogs).toHaveBeenCalledTimes(1);
  });

  it("skips an account whose window has not actually lapsed", async () => {
    const { svc, applyAnonymization } = harness(
      [{ userId: "still-in-window", role: "STUDENT" }],
      {
        "still-in-window": {
          userId: "still-in-window",
          role: "STUDENT",
          accountStatus: "DELETION_PENDING",
          deletionScheduledFor: futureWindow,
        },
      }
    );

    const result = await svc.anonymizeExpiredDeletions({ now });

    expect(result.anonymizedUserIds).toEqual([]);
    expect(result.skippedUserIds).toEqual(["still-in-window"]);
    expect(applyAnonymization).not.toHaveBeenCalled();
  });
});
