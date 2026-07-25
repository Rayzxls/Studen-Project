// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
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

describe("Prisma Student Google onboarding", () => {
  let studentUserId = "";
  let studentEmail = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const prefix = `identity_student_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
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

  it("commits account, Google identity, consent, and audit atomically", async () => {
    const service = createPrismaStudentOnboardingService(db, env);
    const occurredAt = new Date("2026-07-24T06:05:00.000Z");

    const result = await service.register({
      google: {
        providerAccountId: `google-${randomBytes(8).toString("hex")}`,
        email: studentEmail.toUpperCase(),
        emailVerified: true,
      },
      firstName: "สมชาย",
      lastName: "ใจดี",
      consent,
      occurredAt,
      ipAddress: "127.0.0.1",
      userAgent: "identity-integration-test",
    });
    studentUserId = result.userId;

    const user = await db.user.findUniqueOrThrow({
      where: { id: studentUserId },
      select: {
        role: true,
        identifier: true,
        email: true,
        emailVerifiedAt: true,
        firstName: true,
        lastName: true,
        mustResetPwd: true, // dependency-gate-allow(temporary-password): assert Google-only account has no reset flow
        passwordHash: true,
        student: {
          select: { studentId: true, firstName: true, lastName: true }, // dependency-gate-allow(student-id-symbol-review): assert the legacy column holds a synthetic placeholder
        },
        authIdentities: {
          select: {
            provider: true,
            providerEmail: true,
            providerAccountId: true,
          },
        },
        consentAcceptances: {
          orderBy: { document: "asc" },
          select: { document: true, version: true },
        },
      },
    });

    expect(user).toEqual({
      role: "STUDENT",
      identifier: studentEmail,
      email: studentEmail,
      emailVerifiedAt: occurredAt,
      firstName: "สมชาย",
      lastName: "ใจดี",
      mustResetPwd: false, // dependency-gate-allow(temporary-password): assert Google-only account has no reset flow
      passwordHash: expect.stringMatching(/^\$2[aby]\$/),
      student: {
        studentId: expect.stringMatching(/^identity-v2-unassigned:/), // dependency-gate-allow(student-id-symbol-review): synthetic placeholder is never displayed
        firstName: "สมชาย",
        lastName: "ใจดี",
      },
      authIdentities: [
        {
          provider: "GOOGLE",
          providerEmail: studentEmail,
          providerAccountId: expect.stringMatching(/^google-/),
        },
      ],
      consentAcceptances: [
        { document: "TERMS_OF_USE", version: "terms-2026-07" },
        { document: "PRIVACY_NOTICE", version: "privacy-2026-07" },
      ],
    });

    const actions = await db.auditLog.findMany({
      where: { actorId: studentUserId },
      select: { action: true },
    });
    expect(actions.map((entry) => entry.action).sort()).toEqual([
      "CONSENT_GRANTED",
      "CONSENT_GRANTED",
      "STUDENT_SELF_REGISTERED",
    ]);
  });

  it("never auto-links a second Google account to the same verified email", async () => {
    const service = createPrismaStudentOnboardingService(db, env);
    const first = await service.register({
      google: {
        providerAccountId: `google-${randomBytes(8).toString("hex")}`,
        email: studentEmail,
        emailVerified: true,
      },
      firstName: "สมชาย",
      lastName: "ใจดี",
      consent,
      occurredAt: new Date("2026-07-24T06:05:00.000Z"),
    });
    studentUserId = first.userId;

    await expect(
      service.register({
        google: {
          providerAccountId: `google-${randomBytes(8).toString("hex")}`,
          email: studentEmail,
          emailVerified: true,
        },
        firstName: "สมชาย",
        lastName: "ใจดี",
        consent,
        occurredAt: new Date("2026-07-24T06:10:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "student_onboarding_account_exists" });

    expect(await db.user.count({ where: { email: studentEmail } })).toBe(1);
  });
});
