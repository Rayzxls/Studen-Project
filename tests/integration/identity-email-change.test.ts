// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { createCapturedEmailSender } from "@/lib/email";
import { createPrismaEmailChangeService } from "@/lib/identity/email-change-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const env = {
  ...process.env,
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
  AUTH_URL: "http://localhost:3100",
};

const recent = () => new Date();
const tokenFrom = (url: string) => new URL(url).searchParams.get("token") ?? "";

describe("verified-email change through an emailed link", () => {
  const createdIds: string[] = [];
  let suffix = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    suffix = `${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    createdIds.length = 0;
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db.auditLog.deleteMany({ where: { actorId: { in: createdIds } } });
      await db.user.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  async function makeUser(local: string) {
    const email = `emailchg_${suffix}_${local}@example.com`;
    const user = await db.user.create({
      data: {
        role: "TEACHER",
        identifier: email,
        email,
        passwordHash: "DISABLED",
        accountStatus: "ACTIVE",
        sessionVersion: 2,
        teacher: { create: { email, firstName: "QA", lastName: local } },
      },
      select: { id: true },
    });
    createdIds.push(user.id);
    return { id: user.id, email };
  }

  it("verifies the new address, updates identifier, revokes sessions, single-use", async () => {
    const { id, email } = await makeUser("old");
    const newEmail = `emailchg_${suffix}_new@example.com`;

    const captured = createCapturedEmailSender();
    const service = createPrismaEmailChangeService(db, env, {
      emailSender: captured,
    });

    await service.request({
      actor: { userId: id, reauthenticatedAt: recent() },
      newEmail,
    });
    expect(captured.outbox).toHaveLength(1);
    expect(captured.outbox[0]?.to).toBe(newEmail);
    const requested = await db.auditLog.count({
      where: { actorId: id, action: "EMAIL_CHANGE_REQUESTED" },
    });
    expect(requested).toBe(1);

    const token = tokenFrom(
      (captured.outbox[0]!.template as { verifyUrl: string }).verifyUrl
    );

    const result = await service.confirm({ token });
    expect(result.newEmail).toBe(newEmail);

    const after = await db.user.findUniqueOrThrow({
      where: { id },
      select: {
        email: true,
        identifier: true,
        emailVerifiedAt: true,
        sessionVersion: true,
      },
    });
    expect(after.email).toBe(newEmail);
    expect(after.identifier).toBe(newEmail); // tracked the old email
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.sessionVersion).toBe(3);
    const changed = await db.auditLog.count({
      where: { actorId: id, action: "EMAIL_CHANGED" },
    });
    expect(changed).toBe(1);

    // Single-use: the old link no longer matches the (now new) email.
    await expect(service.confirm({ token })).rejects.toMatchObject({
      code: "email_change_superseded",
    });

    // Old address is free; the change did not leave it behind.
    expect(email).not.toBe(newEmail);
  });

  it("refuses an address already owned by another account", async () => {
    const { id } = await makeUser("mover");
    const { email: takenEmail } = await makeUser("holder");

    const captured = createCapturedEmailSender();
    const service = createPrismaEmailChangeService(db, env, {
      emailSender: captured,
    });

    await service.request({
      actor: { userId: id, reauthenticatedAt: recent() },
      newEmail: takenEmail,
    });
    const token = tokenFrom(
      (captured.outbox[0]!.template as { verifyUrl: string }).verifyUrl
    );

    await expect(service.confirm({ token })).rejects.toMatchObject({
      code: "email_taken",
    });
    const mover = await db.user.findUniqueOrThrow({
      where: { id },
      select: { email: true },
    });
    expect(mover.email).toBe(`emailchg_${suffix}_mover@example.com`);
  });
});
