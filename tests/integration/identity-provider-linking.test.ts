// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { createPrismaProviderLinkingService } from "@/lib/identity/provider-linking-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const env = {
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
};

const linkedAt = new Date("2026-07-24T08:00:00.000Z");
const freshReauth = new Date(linkedAt.getTime() - 60_000);

describe("Prisma Google provider linking", () => {
  let teacherUserId = "";
  let teacherEmail = "";
  let providerAccountId = "";

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    const prefix = `identity_link_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    teacherEmail = `${prefix}@example.com`;
    providerAccountId = `google-${randomBytes(8).toString("hex")}`;

    const user = await db.user.create({
      data: {
        identifier: teacherEmail,
        email: teacherEmail,
        emailVerifiedAt: new Date("2026-07-24T07:00:00.000Z"),
        passwordHash: "integration-test-only",
        role: "TEACHER",
        firstName: "Ada",
        lastName: "Lovelace",
        teacher: {
          create: {
            email: teacherEmail,
            firstName: "Ada",
            lastName: "Lovelace",
          },
        },
      },
      select: { id: true },
    });
    teacherUserId = user.id;
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({
      where: {
        OR: [{ actorId: teacherUserId }, { targetLabel: teacherEmail }],
      },
    });
    await db.user.deleteMany({ where: { id: teacherUserId } });
  });

  it("links Google to the authenticated account and writes one Critical audit row", async () => {
    const result = await createPrismaProviderLinkingService(
      db,
      env
    ).linkGoogleFromAuthenticatedProfile({
      actor: { userId: teacherUserId, reauthenticatedAt: freshReauth },
      google: {
        providerAccountId,
        email: teacherEmail.toUpperCase(),
        emailVerified: true,
      },
      occurredAt: linkedAt,
      ipAddress: "127.0.0.1",
      userAgent: "identity-integration-test",
    });

    expect(result).toEqual({
      identityId: expect.any(String),
      userId: teacherUserId,
      provider: "GOOGLE",
      providerEmail: teacherEmail,
    });

    const identities = await db.authIdentity.findMany({
      where: { userId: teacherUserId },
      select: { provider: true, providerAccountId: true, providerEmail: true },
    });
    expect(identities).toEqual([
      { provider: "GOOGLE", providerAccountId, providerEmail: teacherEmail },
    ]);

    const actions = await db.auditLog.findMany({
      where: { actorId: teacherUserId, action: "AUTH_PROVIDER_LINKED" },
      select: { action: true },
    });
    expect(actions).toHaveLength(1);
  });

  it("refuses a stale re-authentication and links nothing", async () => {
    await expect(
      createPrismaProviderLinkingService(
        db,
        env
      ).linkGoogleFromAuthenticatedProfile({
        actor: {
          userId: teacherUserId,
          reauthenticatedAt: new Date("2026-07-24T06:00:00.000Z"),
        },
        google: { providerAccountId, email: teacherEmail, emailVerified: true },
        occurredAt: linkedAt,
      })
    ).rejects.toMatchObject({ code: "reauthentication_required" });

    expect(
      await db.authIdentity.count({ where: { userId: teacherUserId } })
    ).toBe(0);
  });

  it("refuses a second Google identity on the same account", async () => {
    const service = createPrismaProviderLinkingService(db, env);
    await service.linkGoogleFromAuthenticatedProfile({
      actor: { userId: teacherUserId, reauthenticatedAt: freshReauth },
      google: { providerAccountId, email: teacherEmail, emailVerified: true },
      occurredAt: linkedAt,
    });

    await expect(
      service.linkGoogleFromAuthenticatedProfile({
        actor: { userId: teacherUserId, reauthenticatedAt: freshReauth },
        google: {
          providerAccountId: `google-${randomBytes(8).toString("hex")}`,
          email: teacherEmail,
          emailVerified: true,
        },
        occurredAt: new Date("2026-07-24T08:05:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "account_already_has_google_identity" });

    expect(
      await db.authIdentity.count({ where: { userId: teacherUserId } })
    ).toBe(1);
  });
});
