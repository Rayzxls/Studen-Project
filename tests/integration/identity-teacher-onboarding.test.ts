// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { createPrismaTeacherInviteService } from "@/lib/identity/teacher-invite-prisma";
import { createPrismaTeacherOnboardingService } from "@/lib/identity/teacher-onboarding-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

describe("Prisma Teacher Google onboarding", () => {
  let actorUserId = "";
  let teacherUserId = "";
  let teacherEmail = "";

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    const prefix = `identity_onboarding_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    const actorEmail = `${prefix}_admin@test.local`;
    teacherEmail = `${prefix}_teacher@example.com`;
    const actor = await db.user.create({
      data: {
        identifier: actorEmail,
        email: actorEmail,
        emailVerifiedAt: new Date(),
        passwordHash: "integration-test-only",
        role: "ADMIN",
        admin: {
          create: { firstName: "Identity", lastName: "Admin" },
        },
      },
      select: { id: true },
    });
    actorUserId = actor.id;
  });

  afterEach(async () => {
    const userIds = [actorUserId, teacherUserId].filter(Boolean);
    if (userIds.length === 0) return;

    await db.auditLog.deleteMany({
      where: {
        OR: [{ actorId: { in: userIds } }, { targetLabel: teacherEmail }],
      },
    });
    await db.teacherInvite.deleteMany({
      where: {
        OR: [{ createdByUserId: actorUserId }, { email: teacherEmail }],
      },
    });
    if (teacherUserId) {
      await db.user.deleteMany({ where: { id: teacherUserId } });
    }
    if (actorUserId) {
      await db.user.deleteMany({ where: { id: actorUserId } });
    }
  });

  it("commits account, Google identity, consent, Invite acceptance, and audit atomically", async () => {
    const env = {
      IDENTITY_FOUNDATION_ENABLED: "1",
      IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
      IDENTITY_TERMS_VERSION: "terms-2026-07",
      IDENTITY_PRIVACY_VERSION: "privacy-2026-07",
    };
    const occurredAt = new Date("2026-07-24T06:00:00.000Z");
    const inviteService = createPrismaTeacherInviteService(db, env);
    const onboardingService = createPrismaTeacherOnboardingService(db, env);
    const invite = await inviteService.issue({
      actorUserId,
      email: teacherEmail,
      occurredAt,
    });

    const result = await onboardingService.accept({
      rawInviteToken: invite.rawToken,
      google: {
        providerAccountId: `google-${randomBytes(8).toString("hex")}`,
        email: teacherEmail.toUpperCase(),
        emailVerified: true,
      },
      firstName: "Ada",
      lastName: "Lovelace",
      consent: {
        termsOfUseVersion: env.IDENTITY_TERMS_VERSION,
        privacyNoticeVersion: env.IDENTITY_PRIVACY_VERSION,
      },
      occurredAt: new Date("2026-07-24T06:05:00.000Z"),
      ipAddress: "127.0.0.1",
      userAgent: "identity-integration-test",
    });
    teacherUserId = result.userId;

    const user = await db.user.findUniqueOrThrow({
      where: { id: teacherUserId },
      select: {
        role: true,
        identifier: true,
        email: true,
        emailVerifiedAt: true,
        firstName: true,
        lastName: true,
        mustResetPwd: true, // dependency-gate-allow(temporary-password): disposable legacy Admin fixture
        passwordHash: true,
        teacher: {
          select: { email: true, firstName: true, lastName: true },
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
      role: "TEACHER",
      identifier: teacherEmail,
      email: teacherEmail,
      emailVerifiedAt: new Date("2026-07-24T06:05:00.000Z"),
      firstName: "Ada",
      lastName: "Lovelace",
      mustResetPwd: false, // dependency-gate-allow(temporary-password): assert Google-only account has no reset flow
      passwordHash: expect.stringMatching(/^\$2[aby]\$/),
      teacher: {
        email: teacherEmail,
        firstName: "Ada",
        lastName: "Lovelace",
      },
      authIdentities: [
        {
          provider: "GOOGLE",
          providerEmail: teacherEmail,
          providerAccountId: expect.stringMatching(/^google-/),
        },
      ],
      consentAcceptances: [
        { document: "TERMS_OF_USE", version: "terms-2026-07" },
        { document: "PRIVACY_NOTICE", version: "privacy-2026-07" },
      ],
    });

    const acceptedInvite = await db.teacherInvite.findUniqueOrThrow({
      where: { id: invite.inviteId },
      select: { status: true, acceptedAt: true, acceptedByUserId: true },
    });
    expect(acceptedInvite).toEqual({
      status: "ACCEPTED",
      acceptedAt: new Date("2026-07-24T06:05:00.000Z"),
      acceptedByUserId: teacherUserId,
    });

    const actions = await db.auditLog.findMany({
      where: { actorId: teacherUserId },
      select: { action: true },
    });
    expect(actions.map((entry) => entry.action).sort()).toEqual([
      "CONSENT_GRANTED",
      "CONSENT_GRANTED",
      "TEACHER_INVITE_ACCEPTED",
    ]);

    await expect(
      onboardingService.accept({
        rawInviteToken: invite.rawToken,
        google: {
          providerAccountId: "google-second-attempt",
          email: teacherEmail,
          emailVerified: true,
        },
        firstName: "Ada",
        lastName: "Lovelace",
        consent: {
          termsOfUseVersion: env.IDENTITY_TERMS_VERSION,
          privacyNoticeVersion: env.IDENTITY_PRIVACY_VERSION,
        },
        occurredAt: new Date("2026-07-24T06:10:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "teacher_invite_not_pending" });

    expect(await db.user.count({ where: { email: teacherEmail } })).toBe(1);
  });
});
