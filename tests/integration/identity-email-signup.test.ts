// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { registerEmailPasswordStudent } from "@/lib/identity/email-signup-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const consent = {
  termsOfUseVersion: "terms-2026-07",
  privacyNoticeVersion: "privacy-2026-07",
};
const PASSWORD = "signup-pass-1234";

describe("student email + password self-registration", () => {
  let email = "";
  let userId = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    email = `emailsignup_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}@example.com`;
    userId = "";
  });

  afterEach(async () => {
    if (userId) {
      await db.auditLog.deleteMany({ where: { actorId: userId } });
      await db.consentAcceptance.deleteMany({ where: { userId } });
    }
    await db.user.deleteMany({ where: { email } });
  });

  it("creates an unverified-email Student with consent and audit, and rejects a duplicate", async () => {
    const result = await registerEmailPasswordStudent({
      email,
      passwordHash: await hashPassword(PASSWORD),
      firstName: "สมชาย",
      lastName: "ทดสอบ",
      consent,
      occurredAt: new Date(),
    });
    userId = result.userId;

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        role: true,
        identifier: true,
        email: true,
        emailVerifiedAt: true,
        passwordHash: true,
        student: { select: { studentId: true } },
        authIdentities: { select: { provider: true } },
      },
    });
    expect(user.role).toBe("STUDENT");
    expect(user.identifier).toBe(email);
    expect(user.email).toBe(email);
    expect(user.emailVerifiedAt).toBeNull(); // self-registered, not verified
    expect(await verifyPassword(PASSWORD, user.passwordHash)).toBe(true);
    expect(user.student?.studentId).toMatch(/^identity-v2-unassigned:/);
    expect(user.authIdentities).toHaveLength(0); // no Google — E² can link later

    const consents = await db.consentAcceptance.count({ where: { userId } });
    expect(consents).toBe(2);
    const audits = await db.auditLog.count({
      where: { actorId: userId, action: "STUDENT_SELF_REGISTERED" },
    });
    expect(audits).toBe(1);

    // Same email a second time fails closed.
    await expect(
      registerEmailPasswordStudent({
        email,
        passwordHash: await hashPassword(PASSWORD),
        firstName: "อีก",
        lastName: "คน",
        consent,
        occurredAt: new Date(),
      })
    ).rejects.toMatchObject({ code: "email_taken" });
  });
});
