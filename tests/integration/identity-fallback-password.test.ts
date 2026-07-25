// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { createPrismaFallbackPasswordService } from "@/lib/identity/fallback-password-prisma";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "@/lib/identity/foundation";
import { createPrismaStudentOnboardingService } from "@/lib/identity/student-onboarding-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const env = {
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
  IDENTITY_TERMS_VERSION: "terms-2026-07",
  IDENTITY_PRIVACY_VERSION: "privacy-2026-07",
};

const occurredAt = new Date("2026-07-24T09:00:00.000Z");
const freshReauth = new Date(occurredAt.getTime() - 60_000);
const chosenPassword = "correct-horse-battery";

describe("Prisma optional fallback password setup", () => {
  let studentUserId = "";
  let studentEmail = "";

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    const prefix = `identity_fallback_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    studentEmail = `${prefix}@example.com`;

    const registered = await createPrismaStudentOnboardingService(
      db,
      env
    ).register({
      google: {
        providerAccountId: `google-${randomBytes(8).toString("hex")}`,
        email: studentEmail,
        emailVerified: true,
      },
      firstName: "สมชาย",
      lastName: "ใจดี",
      consent: {
        termsOfUseVersion: env.IDENTITY_TERMS_VERSION,
        privacyNoticeVersion: env.IDENTITY_PRIVACY_VERSION,
      },
      occurredAt: new Date("2026-07-24T08:00:00.000Z"),
    });
    studentUserId = registered.userId;
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({
      where: {
        OR: [{ actorId: studentUserId }, { targetLabel: studentEmail }],
      },
    });
    await db.user.deleteMany({ where: { id: studentUserId } });
  });

  it("turns the disabled compatibility hash into a real, verifiable credential", async () => {
    const before = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: { passwordHash: true },
    });
    expect(before.passwordHash).toBe(DISABLED_COMPATIBILITY_PASSWORD_HASH);
    expect(await verifyPassword(chosenPassword, before.passwordHash)).toBe(
      false
    );

    const result = await createPrismaFallbackPasswordService(
      db,
      env
    ).setOwnFallbackPassword({
      actor: { userId: studentUserId, reauthenticatedAt: freshReauth },
      newPassword: chosenPassword,
      occurredAt,
      ipAddress: "127.0.0.1",
      userAgent: "identity-integration-test",
    });

    expect(result).toEqual({
      userId: studentUserId,
      replacedExistingPassword: false,
    });

    const after = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: { passwordHash: true },
    });
    expect(after.passwordHash).not.toBe(DISABLED_COMPATIBILITY_PASSWORD_HASH);
    expect(await verifyPassword(chosenPassword, after.passwordHash)).toBe(true);
    expect(
      await verifyPassword("a-different-password", after.passwordHash)
    ).toBe(false);
  });

  it("records the change without storing the password anywhere in the audit row", async () => {
    await createPrismaFallbackPasswordService(db, env).setOwnFallbackPassword({
      actor: { userId: studentUserId, reauthenticatedAt: freshReauth },
      newPassword: chosenPassword,
      occurredAt,
    });

    const rows = await db.auditLog.findMany({
      where: { actorId: studentUserId, action: "PASSWORD_CHANGED_SELF" },
      select: { action: true, targetLabel: true, after: true },
    });
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(chosenPassword);
  });

  it("refuses a stale re-authentication and leaves the credential unchanged", async () => {
    await expect(
      createPrismaFallbackPasswordService(db, env).setOwnFallbackPassword({
        actor: {
          userId: studentUserId,
          reauthenticatedAt: new Date("2026-07-24T07:00:00.000Z"),
        },
        newPassword: chosenPassword,
        occurredAt,
      })
    ).rejects.toMatchObject({ code: "reauthentication_required" });

    const after = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: { passwordHash: true },
    });
    expect(after.passwordHash).toBe(DISABLED_COMPATIBILITY_PASSWORD_HASH);
  });
});
