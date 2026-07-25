import { beforeEach, describe, expect, it, vi } from "vitest";

import { REAUTHENTICATION_WINDOW_MS } from "@/lib/identity/foundation";
import {
  createProviderLinkingService,
  type ProviderLinkingAccountRecord,
  type ProviderLinkingDatabasePort,
  type ProviderLinkingTransactionPort,
} from "@/lib/identity/provider-linking-service";

const now = new Date("2026-07-24T08:00:00.000Z");
const freshReauth = new Date(now.getTime() - 60_000);

function activeAccount(
  overrides: Partial<ProviderLinkingAccountRecord> = {}
): ProviderLinkingAccountRecord {
  return {
    userId: "user-1",
    role: "TEACHER",
    email: "teacher@example.com",
    accountStatus: "ACTIVE",
    isActive: true,
    deletedAt: null,
    studentAnonymized: null,
    ...overrides,
  };
}

function validInput() {
  return {
    actor: { userId: "user-1", reauthenticatedAt: freshReauth },
    google: {
      providerAccountId: "google-subject-1",
      email: " Teacher@Example.COM ",
      emailVerified: true,
    },
    occurredAt: now,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

function createHarness(
  options: {
    account?: ProviderLinkingAccountRecord | null;
    existingIdentityUserId?: string | null;
    existingGoogleCount?: number;
  } = {}
) {
  const account =
    options.account === undefined ? activeAccount() : options.account;
  const existingIdentityUserId = options.existingIdentityUserId ?? null;
  const existingGoogleCount = options.existingGoogleCount ?? 0;

  const tx: ProviderLinkingTransactionPort = {
    findAccount: vi.fn(async () => account),
    findGoogleIdentity: vi.fn(async () =>
      existingIdentityUserId ? { userId: existingIdentityUserId } : null
    ),
    countGoogleIdentitiesForUser: vi.fn(async () => existingGoogleCount),
    linkGoogleIdentity: vi.fn(async () => ({ identityId: "identity-1" })),
    createAuditLogs: vi.fn(async () => undefined),
  };
  const database: ProviderLinkingDatabasePort = {
    transaction: vi.fn(async (work) => work(tx)),
  };

  return { database, tx };
}

function createService(
  harness: ReturnType<typeof createHarness>,
  mutationsEnabled = true
) {
  return createProviderLinkingService(harness.database, { mutationsEnabled });
}

describe("Google provider linking from an authenticated Profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed before opening a transaction", async () => {
    const harness = createHarness();

    await expect(
      createService(harness, false).linkGoogleFromAuthenticatedProfile(
        validInput()
      )
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires a verified Google email", async () => {
    const harness = createHarness();

    await expect(
      createService(harness).linkGoogleFromAuthenticatedProfile({
        ...validInput(),
        google: { ...validInput().google, emailVerified: false },
      })
    ).rejects.toMatchObject({ code: "google_email_not_verified" });
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires a recent re-authentication", async () => {
    const stale = new Date(now.getTime() - REAUTHENTICATION_WINDOW_MS - 1);

    for (const reauthenticatedAt of [null, stale]) {
      const harness = createHarness();
      await expect(
        createService(harness).linkGoogleFromAuthenticatedProfile({
          ...validInput(),
          actor: { userId: "user-1", reauthenticatedAt },
        })
      ).rejects.toMatchObject({ code: "reauthentication_required" });
      expect(harness.database.transaction).not.toHaveBeenCalled();
    }
  });

  it("links the provider and records a Critical audit row", async () => {
    const harness = createHarness();

    const result =
      await createService(harness).linkGoogleFromAuthenticatedProfile(
        validInput()
      );

    expect(result).toEqual({
      identityId: "identity-1",
      userId: "user-1",
      provider: "GOOGLE",
      providerEmail: "teacher@example.com",
    });
    expect(harness.tx.linkGoogleIdentity).toHaveBeenCalledWith({
      userId: "user-1",
      providerAccountId: "google-subject-1",
      providerEmail: "teacher@example.com",
      linkedAt: now,
    });
    expect(harness.tx.createAuditLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "AUTH_PROVIDER_LINKED",
        actorId: "user-1",
        actorRole: "TEACHER",
      }),
    ]);
  });

  it("refuses a Google address that differs from the account email", async () => {
    const harness = createHarness();

    await expect(
      createService(harness).linkGoogleFromAuthenticatedProfile({
        ...validInput(),
        google: { ...validInput().google, email: "other@example.com" },
      })
    ).rejects.toMatchObject({ code: "google_email_does_not_match_account" });
    expect(harness.tx.linkGoogleIdentity).not.toHaveBeenCalled();
  });

  it("refuses an unavailable account", async () => {
    const harness = createHarness({
      account: activeAccount({ accountStatus: "SUSPENDED" }),
    });

    await expect(
      createService(harness).linkGoogleFromAuthenticatedProfile(validInput())
    ).rejects.toMatchObject({ code: "account_not_available" });
    expect(harness.tx.linkGoogleIdentity).not.toHaveBeenCalled();
  });

  it("refuses a Google subject already linked elsewhere or here", async () => {
    const otherHarness = createHarness({
      existingIdentityUserId: "another-user",
    });
    await expect(
      createService(otherHarness).linkGoogleFromAuthenticatedProfile(
        validInput()
      )
    ).rejects.toMatchObject({ code: "google_identity_already_linked" });

    const sameHarness = createHarness({ existingIdentityUserId: "user-1" });
    await expect(
      createService(sameHarness).linkGoogleFromAuthenticatedProfile(
        validInput()
      )
    ).rejects.toMatchObject({
      code: "google_identity_already_linked_to_this_account",
    });
  });

  it("keeps one Google identity per User", async () => {
    const harness = createHarness({ existingGoogleCount: 1 });

    await expect(
      createService(harness).linkGoogleFromAuthenticatedProfile(validInput())
    ).rejects.toMatchObject({ code: "account_already_has_google_identity" });
    expect(harness.tx.linkGoogleIdentity).not.toHaveBeenCalled();
  });
});
