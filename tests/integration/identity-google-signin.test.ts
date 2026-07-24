// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
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

describe("Prisma Google sign-in resolution", () => {
  let studentUserId = "";
  let studentEmail = "";
  let providerAccountId = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const prefix = `identity_signin_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    studentEmail = `${prefix}@example.com`;
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

  async function registerStudent() {
    const result = await createPrismaStudentOnboardingService(db, env).register(
      {
        google: { providerAccountId, email: studentEmail, emailVerified: true },
        firstName: "สมชาย",
        lastName: "ใจดี",
        consent,
        occurredAt: new Date("2026-07-24T06:00:00.000Z"),
      }
    );
    studentUserId = result.userId;
    return result;
  }

  it("returns the same User on a later Google sign-in and stamps last use", async () => {
    const registered = await registerStudent();
    const signInAt = new Date("2026-07-24T07:00:00.000Z");

    const result = await createPrismaGoogleSignInService(db, env).resolve({
      google: {
        providerAccountId,
        email: studentEmail.toUpperCase(),
        emailVerified: true,
      },
      occurredAt: signInAt,
      ipAddress: "127.0.0.1",
      userAgent: "identity-integration-test",
    });

    expect(result).toEqual({
      userId: registered.userId,
      role: "STUDENT",
      email: studentEmail,
      firstName: "สมชาย",
      lastName: "ใจดี",
      sessionVersion: 0,
      requiresConsentRefresh: false,
    });

    const identity = await db.authIdentity.findFirstOrThrow({
      where: { userId: studentUserId, provider: "GOOGLE" },
      select: { lastUsedAt: true, providerEmail: true },
    });
    expect(identity).toEqual({
      lastUsedAt: signInAt,
      providerEmail: studentEmail,
    });

    const actions = await db.auditLog.findMany({
      where: { actorId: studentUserId, action: "LOGIN_SUCCESS" },
      select: { action: true },
    });
    expect(actions).toHaveLength(1);
  });

  it("refuses an unknown Google subject without creating an account", async () => {
    const unknownProviderAccountId = `google-${randomBytes(8).toString("hex")}`;

    await expect(
      createPrismaGoogleSignInService(db, env).resolve({
        google: {
          providerAccountId: unknownProviderAccountId,
          email: studentEmail,
          emailVerified: true,
        },
        occurredAt: new Date("2026-07-24T07:00:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "google_identity_not_linked" });

    // Scoped to this fixture so a concurrently running suite cannot affect it.
    expect(
      await db.authIdentity.count({
        where: { providerAccountId: unknownProviderAccountId },
      })
    ).toBe(0);
    expect(await db.user.count({ where: { email: studentEmail } })).toBe(0);
  });

  it("refuses a suspended account and writes no sign-in audit", async () => {
    await registerStudent();
    await db.user.update({
      where: { id: studentUserId },
      data: { accountStatus: "SUSPENDED", isActive: false },
    });

    await expect(
      createPrismaGoogleSignInService(db, env).resolve({
        google: { providerAccountId, email: studentEmail, emailVerified: true },
        occurredAt: new Date("2026-07-24T07:00:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "account_not_available" });

    const actions = await db.auditLog.findMany({
      where: { actorId: studentUserId, action: "LOGIN_SUCCESS" },
      select: { action: true },
    });
    expect(actions).toHaveLength(0);
  });
});
