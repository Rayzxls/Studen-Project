// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { createPrismaAccountDeletionService } from "@/lib/identity/account-deletion-prisma";
import { createPrismaAccountRecoveryService } from "@/lib/identity/account-recovery-prisma";
import { createPrismaGoogleSignInService } from "@/lib/identity/google-signin-prisma";
import { createPrismaStudentOnboardingService } from "@/lib/identity/student-onboarding-prisma";
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

describe("account recovery through Google sign-in", () => {
  let studentUserId = "";
  let studentEmail = "";
  let providerAccountId = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const suffix = `${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    studentEmail = `identity_recover_${suffix}@example.com`;
    providerAccountId = `google-${randomBytes(8).toString("hex")}`;
    studentUserId = "";
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({
      where: {
        OR: [
          ...(studentUserId ? [{ actorId: studentUserId }] : []),
          { targetLabel: studentEmail },
        ],
      },
    });
    await db.user.deleteMany({ where: { email: studentEmail } });
  });

  it("routes a pending account to recovery, then signs in normally once recovered", async () => {
    const registered = await createPrismaStudentOnboardingService(
      db,
      env
    ).register({
      google: { providerAccountId, email: studentEmail, emailVerified: true },
      firstName: "สมชาย",
      lastName: "ใจดี",
      consent,
      occurredAt: new Date("2026-07-24T06:05:00.000Z"),
    });
    studentUserId = registered.userId;

    await createPrismaAccountDeletionService(db, env).requestOwnDeletion({
      actor: { userId: studentUserId, reauthenticatedAt: new Date() },
      occurredAt: new Date(),
    });

    const google = {
      providerAccountId,
      email: studentEmail,
      emailVerified: true,
    };

    // While pending-and-in-window, the resolver refuses a session and asks for
    // recovery instead.
    const pending = await createPrismaGoogleSignInService(db, env).resolve({
      google,
      occurredAt: new Date(),
    });
    expect(pending.requiresRecovery).toBe(true);

    await createPrismaAccountRecoveryService(db, env).recoverOwnAccount({
      userId: studentUserId,
      occurredAt: new Date(),
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: {
        accountStatus: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
      },
    });
    expect(user.accountStatus).toBe("ACTIVE");
    expect(user.deletionRequestedAt).toBeNull();
    expect(user.deletionScheduledFor).toBeNull();

    // A normal sign-in now succeeds with no recovery flag.
    const signedIn = await createPrismaGoogleSignInService(db, env).resolve({
      google,
      occurredAt: new Date(),
    });
    expect(signedIn.requiresRecovery).toBe(false);
    expect(signedIn.userId).toBe(studentUserId);

    const audit = await db.auditLog.findMany({
      where: {
        actorId: studentUserId,
        action: "ACCOUNT_DELETION_CANCELLED",
      },
      select: { action: true },
    });
    expect(audit).toHaveLength(1);
  });
});
