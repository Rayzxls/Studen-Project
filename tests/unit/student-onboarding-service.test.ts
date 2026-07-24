import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/errors";
import {
  createStudentOnboardingService,
  type StudentOnboardingDatabasePort,
  type StudentOnboardingTransactionPort,
  type StudentOnboardingUserRecord,
} from "@/lib/identity/student-onboarding-service";

const now = new Date("2026-07-24T05:00:00.000Z");
const requiredConsent = {
  termsOfUseVersion: "terms-2026-07",
  privacyNoticeVersion: "privacy-2026-07",
};

function validInput() {
  return {
    google: {
      providerAccountId: "google-subject-1",
      email: " Student@Example.COM ",
      emailVerified: true,
    },
    firstName: "  สมชาย ",
    lastName: " ใจดี ",
    consent: requiredConsent,
    occurredAt: now,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

function createHarness() {
  const usersByEmail = new Map<string, StudentOnboardingUserRecord>();
  const identities = new Map<string, { userId: string }>();

  const tx: StudentOnboardingTransactionPort = {
    findUserByEmail: vi.fn(async (email) => usersByEmail.get(email) ?? null),
    findGoogleIdentity: vi.fn(
      async (providerAccountId) => identities.get(providerAccountId) ?? null
    ),
    createStudentAccount: vi.fn(async () => ({ userId: "student-user-1" })),
    createConsentAcceptances: vi.fn(async () => undefined),
    createAuditLogs: vi.fn(async () => undefined),
  };
  const database: StudentOnboardingDatabasePort = {
    transaction: vi.fn(async (work) => work(tx)),
  };
  const compatibilityPasswordHashFactory = vi.fn(
    async () => "unreachable-compatibility-hash"
  );

  return {
    compatibilityPasswordHashFactory,
    database,
    identities,
    tx,
    usersByEmail,
  };
}

function createService(
  harness: ReturnType<typeof createHarness>,
  mutationsEnabled = true
) {
  return createStudentOnboardingService(harness.database, {
    mutationsEnabled,
    requiredConsent,
    compatibilityPasswordHashFactory: harness.compatibilityPasswordHashFactory,
  });
}

function expectHttpCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).code).toBe(code);
}

describe("Student Google onboarding transaction service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed before opening a transaction", async () => {
    const harness = createHarness();
    const service = createService(harness, false);

    await expect(service.register(validInput())).rejects.toMatchObject({
      code: "identity_foundation_not_found",
    });
    expect(harness.compatibilityPasswordHashFactory).not.toHaveBeenCalled();
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("requires a verified Google email before any database work", async () => {
    const harness = createHarness();
    const service = createService(harness);

    await expect(
      service.register({
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
      await service.register({
        ...validInput(),
        consent: { ...requiredConsent, termsOfUseVersion: "terms-old" },
      });
      throw new Error("expected consent validation to fail");
    } catch (error) {
      expectHttpCode(error, "validation_error");
    }
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("atomically creates the Student identity and records consent", async () => {
    const harness = createHarness();
    const service = createService(harness);

    const result = await service.register(validInput());

    expect(result).toEqual({
      userId: "student-user-1",
      role: "STUDENT",
      email: "student@example.com",
      firstName: "สมชาย",
      lastName: "ใจดี",
    });
    expect(harness.tx.createStudentAccount).toHaveBeenCalledWith({
      email: "student@example.com",
      emailVerifiedAt: now,
      firstName: "สมชาย",
      lastName: "ใจดี",
      providerAccountId: "google-subject-1",
      providerEmail: "student@example.com",
      compatibilityPasswordHash: "unreachable-compatibility-hash",
      createdAt: now,
    });
    expect(harness.tx.createConsentAcceptances).toHaveBeenCalledWith({
      userId: "student-user-1",
      acceptedAt: now,
      ...requiredConsent,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(harness.tx.createAuditLogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action: "STUDENT_SELF_REGISTERED",
          actorRole: "STUDENT",
        }),
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

  it("never auto-links an existing account that already owns the email", async () => {
    const studentHarness = createHarness();
    studentHarness.usersByEmail.set("student@example.com", {
      userId: "existing-student",
      role: "STUDENT",
    });
    await expect(
      createService(studentHarness).register(validInput())
    ).rejects.toMatchObject({ code: "student_onboarding_account_exists" });
    expect(studentHarness.tx.createStudentAccount).not.toHaveBeenCalled();

    const teacherHarness = createHarness();
    teacherHarness.usersByEmail.set("student@example.com", {
      userId: "existing-teacher",
      role: "TEACHER",
    });
    await expect(
      createService(teacherHarness).register(validInput())
    ).rejects.toMatchObject({ code: "student_onboarding_role_collision" });
    expect(teacherHarness.tx.createStudentAccount).not.toHaveBeenCalled();
  });

  it("fails closed when the Google identity is already linked", async () => {
    const harness = createHarness();
    harness.identities.set("google-subject-1", { userId: "other-user" });

    await expect(
      createService(harness).register(validInput())
    ).rejects.toMatchObject({ code: "google_identity_already_linked" });
    expect(harness.tx.createStudentAccount).not.toHaveBeenCalled();
    expect(harness.tx.createConsentAcceptances).not.toHaveBeenCalled();
    expect(harness.tx.createAuditLogs).not.toHaveBeenCalled();
  });

  it("rejects a blank real name instead of falling back to the Google profile", async () => {
    const harness = createHarness();
    const service = createService(harness);

    try {
      await service.register({ ...validInput(), firstName: "   " });
      throw new Error("expected real-name validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });
});
