// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { createPrismaTeacherInviteService } from "@/lib/identity/teacher-invite-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

describe("Prisma Teacher Invite service", () => {
  let actorUserId = "";

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    const prefix = `identity_invite_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    const actor = await db.user.create({
      data: {
        identifier: `${prefix}@test.local`,
        email: `${prefix}@test.local`,
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
    if (!actorUserId) return;

    await db.teacherInvite.deleteMany({
      where: {
        OR: [
          { createdByUserId: actorUserId },
          { revokedByUserId: actorUserId },
        ],
      },
    });
    await db.auditLog.deleteMany({ where: { actorId: actorUserId } });
    await db.user.delete({ where: { id: actorUserId } });
  });

  it("replaces and revokes invitations atomically with audit evidence", async () => {
    const service = createPrismaTeacherInviteService(db, {
      IDENTITY_FOUNDATION_ENABLED: "1",
      IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
    });
    const inviteEmail = `teacher_${randomBytes(4).toString("hex")}@example.com`;
    const firstAt = new Date("2026-07-24T03:00:00.000Z");
    const secondAt = new Date("2026-07-24T03:05:00.000Z");

    const first = await service.issue({
      actorUserId,
      email: inviteEmail,
      occurredAt: firstAt,
    });
    const replacement = await service.issue({
      actorUserId,
      email: inviteEmail.toUpperCase(),
      occurredAt: secondAt,
    });

    expect(first.rawToken).not.toBe(replacement.rawToken);
    expect(replacement.replacedInviteCount).toBe(1);

    const beforeFinalRevoke = await db.teacherInvite.findMany({
      where: { email: inviteEmail },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        tokenHash: true,
        revokedByUserId: true,
      },
    });
    expect(beforeFinalRevoke).toEqual([
      {
        id: first.inviteId,
        status: "REVOKED",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedByUserId: actorUserId,
      },
      {
        id: replacement.inviteId,
        status: "PENDING",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedByUserId: null,
      },
    ]);
    expect(beforeFinalRevoke[0]?.tokenHash).not.toBe(first.rawToken);
    expect(beforeFinalRevoke[1]?.tokenHash).not.toBe(replacement.rawToken);

    await service.revoke({
      actorUserId,
      inviteId: replacement.inviteId,
      reason: "QA verifies explicit invite revocation",
      occurredAt: new Date("2026-07-24T03:10:00.000Z"),
    });

    const finalInvite = await db.teacherInvite.findUniqueOrThrow({
      where: { id: replacement.inviteId },
      select: { status: true, revokeReason: true, revokedByUserId: true },
    });
    expect(finalInvite).toEqual({
      status: "REVOKED",
      revokeReason: "QA verifies explicit invite revocation",
      revokedByUserId: actorUserId,
    });

    const audit = await db.auditLog.findMany({
      where: {
        actorId: actorUserId,
        targetType: "TeacherInvite",
      },
      orderBy: { timestamp: "asc" },
      select: { action: true, targetId: true },
    });
    expect(audit).toEqual([
      { action: "TEACHER_INVITE_ISSUED", targetId: first.inviteId },
      {
        action: "TEACHER_INVITE_REPLACED",
        targetId: replacement.inviteId,
      },
      {
        action: "TEACHER_INVITE_REVOKED",
        targetId: replacement.inviteId,
      },
    ]);
  });
});
