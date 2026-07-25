// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createCapturedEmailSender } from "@/lib/email";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "@/lib/identity/foundation";
import { createPrismaPasswordRecoveryService } from "@/lib/identity/password-recovery-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const env = {
  ...process.env,
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
  AUTH_URL: "http://localhost:3100",
};

const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "brand-new-password-789";

function tokenFrom(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

describe("password recovery through an emailed link", () => {
  let userId = "";
  let email = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const suffix = `${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    email = `pwreset_${suffix}@example.com`;
    userId = "";
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({
      where: userId ? { actorId: userId } : { targetId: email },
    });
    await db.user.deleteMany({ where: { email } });
  });

  it("emails a link, resets the password, revokes sessions, and is single-use", async () => {
    const user = await db.user.create({
      data: {
        role: "STUDENT",
        identifier: email,
        email,
        passwordHash: await hashPassword(OLD_PASSWORD),
        accountStatus: "ACTIVE",
        sessionVersion: 4,
      },
      select: { id: true },
    });
    userId = user.id;

    const captured = createCapturedEmailSender();
    const service = createPrismaPasswordRecoveryService(db, env, {
      emailSender: captured,
    });

    // Request: one email to the account, a REQUESTED audit, and a token link.
    await service.request({ email });
    expect(captured.outbox).toHaveLength(1);
    expect(captured.outbox[0]?.to).toBe(email);
    const requested = await db.auditLog.findMany({
      where: { actorId: userId, action: "PASSWORD_RESET_REQUESTED" },
    });
    expect(requested).toHaveLength(1);

    const token = tokenFrom(
      (captured.outbox[0]!.template as { recoveryUrl: string }).recoveryUrl
    );
    expect(token.length).toBeGreaterThan(0);

    // Complete: the new password verifies, the old one no longer does, the
    // session version is bumped (other sessions revoked), and it is audited.
    const result = await service.complete({ token, newPassword: NEW_PASSWORD });
    expect(result.userId).toBe(userId);

    const after = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, sessionVersion: true },
    });
    expect(await verifyPassword(NEW_PASSWORD, after.passwordHash)).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD, after.passwordHash)).toBe(false);
    expect(after.sessionVersion).toBe(5);
    const completed = await db.auditLog.findMany({
      where: { actorId: userId, action: "PASSWORD_RESET_COMPLETED" },
    });
    expect(completed).toHaveLength(1);

    // Single-use: the same link fails now that the hash has changed.
    await expect(
      service.complete({ token, newPassword: "yet-another-pass-000" })
    ).rejects.toMatchObject({ code: "password_reset_already_used" });
  });

  it("sends nothing for a Google-only account with no fallback password", async () => {
    const user = await db.user.create({
      data: {
        role: "STUDENT",
        identifier: email,
        email,
        passwordHash: DISABLED_COMPATIBILITY_PASSWORD_HASH,
        accountStatus: "ACTIVE",
      },
      select: { id: true },
    });
    userId = user.id;

    const captured = createCapturedEmailSender();
    const service = createPrismaPasswordRecoveryService(db, env, {
      emailSender: captured,
    });

    await service.request({ email });
    expect(captured.outbox).toHaveLength(0);
    const requested = await db.auditLog.findMany({
      where: { actorId: userId, action: "PASSWORD_RESET_REQUESTED" },
    });
    expect(requested).toHaveLength(0);
  });
});
