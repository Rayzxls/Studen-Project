// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { ACCOUNT_DELETION_RECOVERY_WINDOW_MS } from "@/lib/identity/account-deletion-service";
import { createPrismaAccountDeletionService } from "@/lib/identity/account-deletion-prisma";
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

async function registerDisposableStudent(email: string): Promise<string> {
  const result = await createPrismaStudentOnboardingService(db, env).register({
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
  return result.userId;
}

describe("self-service account deletion", () => {
  let studentUserId = "";
  let studentEmail = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const prefix = `identity_delete_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    studentEmail = `${prefix}@example.com`;
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

  it("moves an available account to Deletion Pending, schedules recovery, and audits it", async () => {
    studentUserId = await registerDisposableStudent(studentEmail);
    const occurredAt = new Date();

    const result = await createPrismaAccountDeletionService(
      db,
      env
    ).requestOwnDeletion({
      actor: { userId: studentUserId, reauthenticatedAt: occurredAt },
      occurredAt,
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: {
        accountStatus: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
        sessionVersion: true,
      },
    });

    expect(user.accountStatus).toBe("DELETION_PENDING");
    // Deletion revokes every existing session by bumping the version.
    expect(user.sessionVersion).toBe(1);
    expect(user.deletionRequestedAt).toEqual(occurredAt);
    expect(user.deletionScheduledFor?.getTime()).toBe(
      occurredAt.getTime() + ACCOUNT_DELETION_RECOVERY_WINDOW_MS
    );
    expect(result.deletionScheduledFor).toEqual(user.deletionScheduledFor);

    const audit = await db.auditLog.findMany({
      where: { actorId: studentUserId, action: "ACCOUNT_DELETION_REQUESTED" },
      select: { action: true },
    });
    expect(audit).toHaveLength(1);
  });

  it("refuses a second deletion once the account is already pending", async () => {
    studentUserId = await registerDisposableStudent(studentEmail);
    const svc = createPrismaAccountDeletionService(db, env);

    await svc.requestOwnDeletion({
      actor: { userId: studentUserId, reauthenticatedAt: new Date() },
      occurredAt: new Date(),
    });

    await expect(
      svc.requestOwnDeletion({
        actor: { userId: studentUserId, reauthenticatedAt: new Date() },
        occurredAt: new Date(),
      })
    ).rejects.toMatchObject({ code: "account_not_available" });
  });
});
