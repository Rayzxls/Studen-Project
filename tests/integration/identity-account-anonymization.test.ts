// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { createPrismaAccountAnonymizationService } from "@/lib/identity/account-anonymization-prisma";
import { createPrismaAccountDeletionService } from "@/lib/identity/account-deletion-prisma";
import { createPrismaStudentOnboardingService } from "@/lib/identity/student-onboarding-prisma";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "@/lib/identity/foundation";
import { ANONYMIZED_STUDENT_NAME } from "@/lib/identity/account-anonymization-service";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const env = {
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
  IDENTITY_TERMS_VERSION: "terms-2026-07",
  IDENTITY_PRIVACY_VERSION: "privacy-2026-07",
};

const consent = {
  termsOfUseVersion: env.IDENTITY_TERMS_VERSION,
  privacyNoticeVersion: env.IDENTITY_PRIVACY_VERSION,
};

async function onboardAndRequestDeletion(email: string): Promise<string> {
  const registered = await createPrismaStudentOnboardingService(
    db,
    env
  ).register({
    google: {
      providerAccountId: `google-${randomBytes(8).toString("hex")}`,
      email,
      emailVerified: true,
    },
    firstName: "สมชาย",
    lastName: "ใจดี",
    consent,
    occurredAt: new Date("2026-07-24T06:05:00.000Z"),
  });
  await createPrismaAccountDeletionService(db, env).requestOwnDeletion({
    actor: { userId: registered.userId, reauthenticatedAt: new Date() },
    occurredAt: new Date(),
  });
  return registered.userId;
}

describe("post-window account anonymization", () => {
  let studentUserId = "";
  let studentEmail = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const suffix = `${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    studentEmail = `identity_anon_${suffix}@example.com`;
    studentUserId = "";
  });

  afterEach(async () => {
    // Email is nulled by anonymization, so clean up by the internal id too.
    if (studentUserId) {
      await db.auditLog.deleteMany({ where: { actorId: studentUserId } });
      await db.user.deleteMany({ where: { id: studentUserId } });
    }
    await db.user.deleteMany({ where: { email: studentEmail } });
  });

  it("erases PII, detaches the identity, and flags the student once the window lapses", async () => {
    studentUserId = await onboardAndRequestDeletion(studentEmail);

    // Force the recovery window into the past.
    await db.user.update({
      where: { id: studentUserId },
      data: { deletionScheduledFor: new Date("2026-07-01T00:00:00.000Z") },
    });

    const result = await createPrismaAccountAnonymizationService(
      db,
      env
    ).anonymizeExpiredDeletions({ now: new Date() });
    expect(result.anonymizedUserIds).toContain(studentUserId);

    const user = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: {
        accountStatus: true,
        email: true,
        identifier: true,
        firstName: true,
        lastName: true,
        displayName: true, // dependency-gate-allow(legacy-display-name): selects the legacy column to assert it is nulled on anonymization
        profileImageId: true,
        anonymizedAt: true,
        passwordHash: true,
        isActive: true,
      },
    });
    expect(user).toMatchObject({
      accountStatus: "ANONYMIZED",
      email: null,
      identifier: `anonymized:${studentUserId}`,
      firstName: null,
      lastName: null,
      displayName: null, // dependency-gate-allow(legacy-display-name): asserts the legacy column is nulled on anonymization
      profileImageId: null,
      passwordHash: DISABLED_COMPATIBILITY_PASSWORD_HASH,
      isActive: false,
    });
    expect(user.anonymizedAt).not.toBeNull();

    const student = await db.student.findUniqueOrThrow({
      where: { userId: studentUserId },
      select: { anonymized: true, firstName: true, lastName: true },
    });
    expect(student.anonymized).toBe(true);
    expect(student.firstName).toBe(ANONYMIZED_STUDENT_NAME.firstName);

    // The Google link is severed and one anonymization audit event is written.
    expect(
      await db.authIdentity.count({ where: { userId: studentUserId } })
    ).toBe(0);
    expect(
      await db.auditLog.count({
        where: { actorId: studentUserId, action: "ACCOUNT_ANONYMIZED" },
      })
    ).toBe(1);
  });

  it("never anonymizes an account still inside its recovery window", async () => {
    studentUserId = await onboardAndRequestDeletion(studentEmail);

    const result = await createPrismaAccountAnonymizationService(
      db,
      env
    ).anonymizeExpiredDeletions({ now: new Date() });

    expect(result.anonymizedUserIds).not.toContain(studentUserId);
    const user = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: { accountStatus: true, email: true },
    });
    expect(user.accountStatus).toBe("DELETION_PENDING");
    expect(user.email).toBe(studentEmail);
  });
});
