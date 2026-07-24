import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGoogleSignInService,
  type GoogleSignInAccountRecord,
  type GoogleSignInDatabasePort,
  type GoogleSignInTransactionPort,
} from "@/lib/identity/google-signin-service";

const now = new Date("2026-07-24T07:00:00.000Z");
const requiredConsent = {
  termsOfUseVersion: "terms-2026-07",
  privacyNoticeVersion: "privacy-2026-07",
};

function activeAccount(
  overrides: Partial<GoogleSignInAccountRecord> = {}
): GoogleSignInAccountRecord {
  return {
    userId: "user-1",
    role: "STUDENT",
    email: "student@example.com",
    firstName: "สมชาย",
    lastName: "ใจดี",
    sessionVersion: 0,
    accountStatus: "ACTIVE",
    isActive: true,
    deletedAt: null,
    studentAnonymized: false,
    consentAcceptances: [
      { document: "TERMS_OF_USE", version: "terms-2026-07" },
      { document: "PRIVACY_NOTICE", version: "privacy-2026-07" },
    ],
    ...overrides,
  };
}

function validInput() {
  return {
    google: {
      providerAccountId: "google-subject-1",
      email: " Student@Example.COM ",
      emailVerified: true,
    },
    occurredAt: now,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

function createHarness(
  options: {
    account?: GoogleSignInAccountRecord | null;
    linked?: boolean;
  } = {}
) {
  const account =
    options.account === undefined ? activeAccount() : options.account;
  const linked = options.linked ?? true;

  const tx: GoogleSignInTransactionPort = {
    findGoogleIdentity: vi.fn(async (providerAccountId) =>
      linked
        ? {
            identityId: "identity-1",
            userId: "user-1",
            providerEmail: providerAccountId ? "student@example.com" : null,
          }
        : null
    ),
    findAccount: vi.fn(async () => account),
    recordIdentityUse: vi.fn(async () => undefined),
    createAuditLogs: vi.fn(async () => undefined),
  };
  const database: GoogleSignInDatabasePort = {
    transaction: vi.fn(async (work) => work(tx)),
  };

  return { database, tx };
}

function createService(
  harness: ReturnType<typeof createHarness>,
  mutationsEnabled = true
) {
  return createGoogleSignInService(harness.database, {
    mutationsEnabled,
    requiredConsent,
  });
}

describe("Google sign-in resolution service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed before opening a transaction", async () => {
    const harness = createHarness();

    await expect(
      createService(harness, false).resolve(validInput())
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires a verified Google email", async () => {
    const harness = createHarness();

    await expect(
      createService(harness).resolve({
        ...validInput(),
        google: { ...validInput().google, emailVerified: false },
      })
    ).rejects.toMatchObject({ code: "google_email_not_verified" });
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("resolves a linked account and records the sign-in", async () => {
    const harness = createHarness();

    const result = await createService(harness).resolve(validInput());

    expect(result).toEqual({
      userId: "user-1",
      role: "STUDENT",
      email: "student@example.com",
      firstName: "สมชาย",
      lastName: "ใจดี",
      sessionVersion: 0,
      requiresConsentRefresh: false,
    });
    expect(harness.tx.recordIdentityUse).toHaveBeenCalledWith({
      identityId: "identity-1",
      providerEmail: "student@example.com",
      lastUsedAt: now,
    });
    expect(harness.tx.createAuditLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "LOGIN_SUCCESS",
        actorId: "user-1",
        actorRole: "STUDENT",
      }),
    ]);
  });

  it("reports an unknown Google subject instead of creating an account", async () => {
    const harness = createHarness({ linked: false });

    await expect(
      createService(harness).resolve(validInput())
    ).rejects.toMatchObject({ code: "google_identity_not_linked" });
    expect(harness.tx.recordIdentityUse).not.toHaveBeenCalled();
    expect(harness.tx.createAuditLogs).not.toHaveBeenCalled();
  });

  it("refuses a suspended, terminated, or anonymized account", async () => {
    const cases: ReadonlyArray<Partial<GoogleSignInAccountRecord>> = [
      { accountStatus: "SUSPENDED" },
      { accountStatus: "DELETION_PENDING" },
      { accountStatus: "TERMINATED" },
      { accountStatus: "ANONYMIZED" },
      { accountStatus: null, isActive: false },
      { accountStatus: null, deletedAt: new Date("2026-07-01T00:00:00.000Z") },
    ];

    for (const override of cases) {
      const harness = createHarness({ account: activeAccount(override) });
      await expect(
        createService(harness).resolve(validInput())
      ).rejects.toMatchObject({ code: "account_not_available" });
      expect(harness.tx.recordIdentityUse).not.toHaveBeenCalled();
      expect(harness.tx.createAuditLogs).not.toHaveBeenCalled();
    }
  });

  it("signs in but flags stale consent rather than locking the User out", async () => {
    const harness = createHarness({
      account: activeAccount({
        consentAcceptances: [
          { document: "TERMS_OF_USE", version: "terms-2026-01" },
          { document: "PRIVACY_NOTICE", version: "privacy-2026-07" },
        ],
      }),
    });

    const result = await createService(harness).resolve(validInput());

    expect(result.requiresConsentRefresh).toBe(true);
    expect(harness.tx.createAuditLogs).toHaveBeenCalled();
  });

  it("records a changed Google address without overwriting the account email", async () => {
    const harness = createHarness();

    const result = await createService(harness).resolve({
      ...validInput(),
      google: { ...validInput().google, email: "new-google@example.com" },
    });

    expect(result.email).toBe("student@example.com");
    expect(harness.tx.recordIdentityUse).toHaveBeenCalledWith(
      expect.objectContaining({ providerEmail: "new-google@example.com" })
    );
  });
});
