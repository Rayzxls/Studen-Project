import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/errors";
import { hashIdentityToken } from "@/lib/identity/foundation";
import {
  createTeacherOnboardingService,
  type TeacherOnboardingDatabasePort,
  type TeacherOnboardingInviteRecord,
  type TeacherOnboardingTransactionPort,
  type TeacherOnboardingUserRecord,
} from "@/lib/identity/teacher-onboarding-service";

const now = new Date("2026-07-24T05:00:00.000Z");
const rawToken = "teacher-invite-token-".padEnd(43, "x");
const requiredConsent = {
  termsOfUseVersion: "terms-2026-07",
  privacyNoticeVersion: "privacy-2026-07",
};

function pendingInvite(
  input: Partial<TeacherOnboardingInviteRecord> = {}
): TeacherOnboardingInviteRecord {
  return {
    inviteId: "invite-1",
    email: "teacher@example.com",
    status: "PENDING",
    expiresAt: new Date("2026-07-31T05:00:00.000Z"),
    acceptedByUserId: null,
    ...input,
  };
}

function validInput() {
  return {
    rawInviteToken: rawToken,
    google: {
      providerAccountId: "google-subject-1",
      email: " Teacher@Example.COM ",
      emailVerified: true,
    },
    firstName: "  Ada ",
    lastName: " Lovelace ",
    consent: requiredConsent,
    occurredAt: now,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

function createHarness() {
  const invite = pendingInvite();
  const usersByEmail = new Map<string, TeacherOnboardingUserRecord>();
  const identities = new Map<string, { userId: string }>();
  let acceptSucceeds = true;

  const tx: TeacherOnboardingTransactionPort = {
    findInviteByTokenHash: vi.fn(async (tokenHash) =>
      tokenHash === hashIdentityToken(rawToken) ? invite : null
    ),
    findUserByEmail: vi.fn(async (email) => usersByEmail.get(email) ?? null),
    findGoogleIdentity: vi.fn(
      async (providerAccountId) => identities.get(providerAccountId) ?? null
    ),
    createTeacherAccount: vi.fn(async () => ({ userId: "teacher-user-1" })),
    acceptInvite: vi.fn(async () => acceptSucceeds),
    createConsentAcceptances: vi.fn(async () => undefined),
    createAuditLogs: vi.fn(async () => undefined),
  };
  const database: TeacherOnboardingDatabasePort = {
    transaction: vi.fn(async (work) => work(tx)),
  };
  const compatibilityPasswordHashFactory = vi.fn(
    async () => "unreachable-compatibility-hash"
  );

  return {
    database,
    identities,
    invite,
    compatibilityPasswordHashFactory,
    setAcceptSucceeds(value: boolean) {
      acceptSucceeds = value;
    },
    tx,
    usersByEmail,
  };
}

function createService(
  harness: ReturnType<typeof createHarness>,
  mutationsEnabled = true
) {
  return createTeacherOnboardingService(harness.database, {
    mutationsEnabled,
    requiredConsent,
    compatibilityPasswordHashFactory: harness.compatibilityPasswordHashFactory,
  });
}

function expectHttpCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).code).toBe(code);
}

describe("Teacher Google onboarding transaction service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed before hashing or opening a transaction", async () => {
    const harness = createHarness();
    const service = createService(harness, false);

    await expect(service.accept(validInput())).rejects.toMatchObject({
      code: "identity_foundation_not_found",
    });
    expect(harness.compatibilityPasswordHashFactory).not.toHaveBeenCalled();
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires a verified Google email before any database work", async () => {
    const harness = createHarness();
    const service = createService(harness);

    await expect(
      service.accept({
        ...validInput(),
        google: { ...validInput().google, emailVerified: false },
      })
    ).rejects.toMatchObject({ code: "google_email_not_verified" });
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires exact current Terms and Privacy versions", async () => {
    const harness = createHarness();
    const service = createService(harness);

    try {
      await service.accept({
        ...validInput(),
        consent: {
          ...requiredConsent,
          privacyNoticeVersion: "privacy-old",
        },
      });
      throw new Error("expected consent validation to fail");
    } catch (error) {
      expectHttpCode(error, "validation_error");
    }
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("atomically creates the Teacher identity, accepts the Invite, and records consent", async () => {
    const harness = createHarness();
    const service = createService(harness);

    const result = await service.accept(validInput());

    expect(result).toEqual({
      userId: "teacher-user-1",
      role: "TEACHER",
      email: "teacher@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(harness.tx.findInviteByTokenHash).toHaveBeenCalledWith(
      hashIdentityToken(rawToken)
    );
    expect(harness.tx.findInviteByTokenHash).not.toHaveBeenCalledWith(rawToken);
    expect(harness.tx.createTeacherAccount).toHaveBeenCalledWith({
      email: "teacher@example.com",
      emailVerifiedAt: now,
      firstName: "Ada",
      lastName: "Lovelace",
      providerAccountId: "google-subject-1",
      providerEmail: "teacher@example.com",
      compatibilityPasswordHash: "unreachable-compatibility-hash",
      createdAt: now,
    });
    expect(harness.tx.acceptInvite).toHaveBeenCalledWith({
      inviteId: "invite-1",
      acceptedByUserId: "teacher-user-1",
      acceptedAt: now,
    });
    expect(harness.tx.createConsentAcceptances).toHaveBeenCalledWith({
      userId: "teacher-user-1",
      acceptedAt: now,
      ...requiredConsent,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(harness.tx.createAuditLogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ action: "TEACHER_INVITE_ACCEPTED" }),
        expect.objectContaining({
          action: "CONSENT_GRANTED",
          targetLabel: "TERMS_OF_USE",
        }),
        expect.objectContaining({
          action: "CONSENT_GRANTED",
          targetLabel: "PRIVACY_NOTICE",
        }),
      ])
    );
  });

  it("rejects an expired Invite", async () => {
    const harness = createHarness();
    harness.invite.expiresAt = now;
    const service = createService(harness);

    await expect(service.accept(validInput())).rejects.toMatchObject({
      code: "teacher_invite_expired",
    });
    expect(harness.tx.createTeacherAccount).not.toHaveBeenCalled();
  });

  it("requires the verified Google email to match the Invite", async () => {
    const harness = createHarness();
    const service = createService(harness);

    await expect(
      service.accept({
        ...validInput(),
        google: {
          ...validInput().google,
          email: "different@example.com",
        },
      })
    ).rejects.toMatchObject({ code: "teacher_invite_email_mismatch" });
    expect(harness.tx.createTeacherAccount).not.toHaveBeenCalled();
  });

  it("fails closed for an existing User or linked Google identity", async () => {
    const userHarness = createHarness();
    userHarness.usersByEmail.set("teacher@example.com", {
      userId: "student-1",
      role: "STUDENT",
    });
    await expect(
      createService(userHarness).accept(validInput())
    ).rejects.toMatchObject({ code: "teacher_onboarding_role_collision" });

    const identityHarness = createHarness();
    identityHarness.identities.set("google-subject-1", {
      userId: "other-user",
    });
    await expect(
      createService(identityHarness).accept(validInput())
    ).rejects.toMatchObject({ code: "google_identity_already_linked" });
  });

  it("fails the operation if the Invite loses the acceptance race", async () => {
    const harness = createHarness();
    harness.setAcceptSucceeds(false);
    const service = createService(harness);

    await expect(service.accept(validInput())).rejects.toMatchObject({
      code: "teacher_invite_not_pending",
    });
    expect(harness.tx.createConsentAcceptances).not.toHaveBeenCalled();
    expect(harness.tx.createAuditLogs).not.toHaveBeenCalled();
  });
});
