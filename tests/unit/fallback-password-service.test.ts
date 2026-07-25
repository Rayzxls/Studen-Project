import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/errors";
import {
  createFallbackPasswordService,
  type FallbackPasswordAccountRecord,
  type FallbackPasswordDatabasePort,
  type FallbackPasswordTransactionPort,
} from "@/lib/identity/fallback-password-service";
import {
  DISABLED_COMPATIBILITY_PASSWORD_HASH,
  REAUTHENTICATION_WINDOW_MS,
} from "@/lib/identity/foundation";

const now = new Date("2026-07-24T09:00:00.000Z");
const freshReauth = new Date(now.getTime() - 60_000);

function googleOnlyAccount(
  overrides: Partial<FallbackPasswordAccountRecord> = {}
): FallbackPasswordAccountRecord {
  return {
    userId: "user-1",
    role: "STUDENT",
    email: "student@example.com",
    passwordHash: DISABLED_COMPATIBILITY_PASSWORD_HASH,
    accountStatus: "ACTIVE",
    isActive: true,
    deletedAt: null,
    studentAnonymized: false,
    ...overrides,
  };
}

function validInput() {
  return {
    actor: { userId: "user-1", reauthenticatedAt: freshReauth },
    newPassword: "correct-horse-battery",
    occurredAt: now,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

function createHarness(
  account: FallbackPasswordAccountRecord | null = googleOnlyAccount()
) {
  const tx: FallbackPasswordTransactionPort = {
    findAccount: vi.fn(async () => account),
    setPasswordHash: vi.fn(async () => undefined),
    createAuditLogs: vi.fn(async () => undefined),
  };
  const database: FallbackPasswordDatabasePort = {
    transaction: vi.fn(async (work) => work(tx)),
  };
  const passwordHasher = vi.fn(async () => "hashed-value");

  return { database, passwordHasher, tx };
}

function createService(
  harness: ReturnType<typeof createHarness>,
  mutationsEnabled = true
) {
  return createFallbackPasswordService(harness.database, {
    mutationsEnabled,
    passwordHasher: harness.passwordHasher,
  });
}

function expectHttpCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).code).toBe(code);
}

describe("Optional fallback password setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed before hashing or opening a transaction", async () => {
    const harness = createHarness();

    await expect(
      createService(harness, false).setOwnFallbackPassword(validInput())
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
    expect(harness.passwordHasher).not.toHaveBeenCalled();
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires a recent re-authentication before hashing", async () => {
    const stale = new Date(now.getTime() - REAUTHENTICATION_WINDOW_MS - 1);

    for (const reauthenticatedAt of [null, stale]) {
      const harness = createHarness();
      await expect(
        createService(harness).setOwnFallbackPassword({
          ...validInput(),
          actor: { userId: "user-1", reauthenticatedAt },
        })
      ).rejects.toMatchObject({ code: "reauthentication_required" });
      expect(harness.passwordHasher).not.toHaveBeenCalled();
    }
  });

  it("rejects a short or common password before hashing", async () => {
    for (const newPassword of ["short7", "password123"]) {
      const harness = createHarness();
      try {
        await createService(harness).setOwnFallbackPassword({
          ...validInput(),
          newPassword,
        });
        throw new Error("expected password validation to fail");
      } catch (error) {
        expectHttpCode(error, "validation_error");
      }
      expect(harness.passwordHasher).not.toHaveBeenCalled();
      expect(harness.database.transaction).not.toHaveBeenCalled();
    }
  });

  it("sets a first fallback password on a Google-only account", async () => {
    const harness = createHarness();

    const result =
      await createService(harness).setOwnFallbackPassword(validInput());

    expect(result).toEqual({
      userId: "user-1",
      replacedExistingPassword: false,
    });
    expect(harness.tx.setPasswordHash).toHaveBeenCalledWith({
      userId: "user-1",
      passwordHash: "hashed-value",
    });
    expect(harness.tx.createAuditLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "PASSWORD_CHANGED_SELF",
        actorId: "user-1",
      }),
    ]);
  });

  it("reports replacing an existing fallback password", async () => {
    const harness = createHarness(
      googleOnlyAccount({ passwordHash: "$2b$12$some.other.real.hash" })
    );

    const result =
      await createService(harness).setOwnFallbackPassword(validInput());

    expect(result.replacedExistingPassword).toBe(true);
  });

  it("never records the password, its hash, or its length in the audit row", async () => {
    const harness = createHarness();

    await createService(harness).setOwnFallbackPassword(validInput());

    const [rows] = vi.mocked(harness.tx.createAuditLogs).mock.calls[0] ?? [];
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("correct-horse-battery");
    expect(serialized).not.toContain("hashed-value");
    expect(serialized).not.toContain(String("correct-horse-battery".length));
  });

  it("refuses an unavailable account and writes nothing", async () => {
    const harness = createHarness(
      googleOnlyAccount({ accountStatus: "SUSPENDED" })
    );

    await expect(
      createService(harness).setOwnFallbackPassword(validInput())
    ).rejects.toMatchObject({ code: "account_not_available" });
    expect(harness.tx.setPasswordHash).not.toHaveBeenCalled();
    expect(harness.tx.createAuditLogs).not.toHaveBeenCalled();
  });
});
