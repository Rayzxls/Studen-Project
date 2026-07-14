// @vitest-environment node

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { suspendOrReactivateAccount } from "@/lib/account/lifecycle-service";
import { createPrismaAccountLifecycleRepository } from "@/lib/account/prisma-repository";
import { db } from "@/lib/db/client";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

describe("Prisma account lifecycle port", () => {
  let actorUserId: string;
  let targetUserId: string;
  let sessionId: string;

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    const prefix = `lifecycle_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;

    const actor = await db.user.create({
      data: {
        identifier: `${prefix}_admin@test.local`,
        passwordHash: "integration-test-only",
        role: "ADMIN",
        admin: {
          create: { firstName: "Lifecycle", lastName: "Admin" },
        },
      },
      select: { id: true },
    });
    const target = await db.user.create({
      data: {
        identifier: `${prefix}_student`,
        passwordHash: "integration-test-only",
        role: "STUDENT",
        student: {
          create: {
            studentId: `${prefix}_student`,
            firstName: "Lifecycle",
            lastName: "Student",
          },
        },
      },
      select: { id: true },
    });
    const session = await db.userSession.create({
      data: {
        userId: target.id,
        tokenHash: `${prefix}_${randomBytes(16).toString("hex")}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      select: { id: true },
    });

    actorUserId = actor.id;
    targetUserId = target.id;
    sessionId = session.id;
  });

  afterEach(async () => {
    if (!actorUserId || !targetUserId) return;
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: actorUserId },
          { targetType: "User", targetId: targetUserId },
        ],
      },
    });
    await db.accountLifecycleEvent.deleteMany({
      where: {
        OR: [{ actorUserId }, { targetUserId }],
      },
    });
    await db.user.deleteMany({
      where: { id: { in: [targetUserId, actorUserId] } },
    });
  });

  it("suspends and reactivates while preserving lifecycle and audit evidence", async () => {
    const repository = createPrismaAccountLifecycleRepository();

    await suspendOrReactivateAccount(
      {
        actor: { userId: actorUserId, role: "ADMIN" },
        targetUserId,
        to: "SUSPENDED",
        internalReason: "QA lifecycle suspension verification",
        userMessage: "Your account is temporarily unavailable.",
      },
      { repository, mutationsEnabled: true }
    );

    const suspended = await db.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: { accountStatus: true, isActive: true },
    });
    const revokedSession = await db.userSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { revokedAt: true },
    });
    expect(suspended).toEqual({
      accountStatus: "SUSPENDED",
      isActive: false,
    });
    expect(revokedSession.revokedAt).not.toBeNull();

    await suspendOrReactivateAccount(
      {
        actor: { userId: actorUserId, role: "ADMIN" },
        targetUserId,
        to: "ACTIVE",
        internalReason: "QA lifecycle reactivation verification",
        userMessage: "Your account is available again.",
      },
      { repository, mutationsEnabled: true }
    );

    const active = await db.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: { accountStatus: true, isActive: true },
    });
    const lifecycleEvents = await db.accountLifecycleEvent.findMany({
      where: { targetUserId },
      orderBy: { createdAt: "asc" },
      select: { fromStatus: true, toStatus: true, userMessage: true },
    });
    const auditEvents = await db.auditLog.findMany({
      where: { targetType: "User", targetId: targetUserId },
      orderBy: { timestamp: "asc" },
      select: { action: true, reason: true },
    });

    expect(active).toEqual({ accountStatus: "ACTIVE", isActive: true });
    expect(lifecycleEvents).toEqual([
      {
        fromStatus: "ACTIVE",
        toStatus: "SUSPENDED",
        userMessage: "Your account is temporarily unavailable.",
      },
      {
        fromStatus: "SUSPENDED",
        toStatus: "ACTIVE",
        userMessage: "Your account is available again.",
      },
    ]);
    expect(auditEvents).toEqual([
      {
        action: "ACCOUNT_SUSPENDED",
        reason: "QA lifecycle suspension verification",
      },
      {
        action: "ACCOUNT_REACTIVATED",
        reason: "QA lifecycle reactivation verification",
      },
    ]);
  });
});
