// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  regenerateClassCode,
  setClassCodeActive,
  setClassCodeExpiry,
} from "@/lib/course/class-code";
import { Forbidden } from "@/lib/errors";
import { setupTestCourse, type TestCourseContext } from "./_fixtures";

/**
 * Ownership + audit guarantees for the three Class Code admin actions
 * (regenerate · setActive · setExpiry). All three share the
 * `assertOwningTeacherInTx` helper, so we exercise the rejection path
 * on regenerate as the representative case + happy-path each.
 */
describe("Class Code mutations (P3-5/3)", () => {
  let ctx: TestCourseContext;

  beforeEach(async () => {
    ctx = await setupTestCourse();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("regenerateClassCode produces a new code + audits CLASS_CODE_REGENERATED", async () => {
    const before = ctx.classCode;

    const { classCode: after } = await regenerateClassCode({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
    });

    expect(after).not.toBe(before);

    const dbRow = await db.courseOffering.findUniqueOrThrow({
      where: { id: ctx.courseOfferingId },
      select: { classCode: true },
    });
    expect(dbRow.classCode).toBe(after);

    const log = await db.auditLog.findFirst({
      where: {
        action: "CLASS_CODE_REGENERATED",
        targetId: ctx.courseOfferingId,
      },
      select: { actorId: true },
    });
    expect(log?.actorId).toBe(ctx.teacherUserId);
  });

  it("regenerateClassCode rejects a non-owning teacher with Forbidden", async () => {
    await expect(
      regenerateClassCode({
        courseOfferingId: ctx.courseOfferingId,
        actorUserId: ctx.otherTeacherUserId,
      })
    ).rejects.toBeInstanceOf(Forbidden);

    // Code untouched
    const row = await db.courseOffering.findUniqueOrThrow({
      where: { id: ctx.courseOfferingId },
      select: { classCode: true },
    });
    expect(row.classCode).toBe(ctx.classCode);
  });

  it("setClassCodeActive(false) deactivates + audits CLASS_CODE_DEACTIVATED", async () => {
    await setClassCodeActive({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      active: false,
    });

    const row = await db.courseOffering.findUniqueOrThrow({
      where: { id: ctx.courseOfferingId },
      select: { codeActive: true },
    });
    expect(row.codeActive).toBe(false);

    const log = await db.auditLog.findFirst({
      where: {
        action: "CLASS_CODE_DEACTIVATED",
        targetId: ctx.courseOfferingId,
      },
      select: { id: true },
    });
    expect(log).not.toBeNull();
  });

  it("setClassCodeActive is idempotent — no audit when value unchanged", async () => {
    // Course starts with codeActive=true (default). Setting true again = no-op.
    await setClassCodeActive({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      active: true,
    });

    const log = await db.auditLog.findFirst({
      where: {
        targetId: ctx.courseOfferingId,
        action: { in: ["CLASS_CODE_REACTIVATED", "CLASS_CODE_DEACTIVATED"] },
      },
      select: { id: true },
    });
    expect(log).toBeNull();
  });

  it("setClassCodeExpiry persists a future date + audits CLASS_CODE_EXPIRY_SET", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await setClassCodeExpiry({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      expiresAt: future,
    });

    const row = await db.courseOffering.findUniqueOrThrow({
      where: { id: ctx.courseOfferingId },
      select: { codeExpiresAt: true },
    });
    expect(row.codeExpiresAt?.toISOString()).toBe(future.toISOString());

    const log = await db.auditLog.findFirst({
      where: {
        action: "CLASS_CODE_EXPIRY_SET",
        targetId: ctx.courseOfferingId,
      },
      select: { id: true },
    });
    expect(log).not.toBeNull();
  });

  it("setClassCodeExpiry(null) clears the expiry", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60);
    await setClassCodeExpiry({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      expiresAt: future,
    });

    await setClassCodeExpiry({
      courseOfferingId: ctx.courseOfferingId,
      actorUserId: ctx.teacherUserId,
      expiresAt: null,
    });

    const row = await db.courseOffering.findUniqueOrThrow({
      where: { id: ctx.courseOfferingId },
      select: { codeExpiresAt: true },
    });
    expect(row.codeExpiresAt).toBeNull();
  });

  it("setClassCodeExpiry rejects a non-owning teacher", async () => {
    await expect(
      setClassCodeExpiry({
        courseOfferingId: ctx.courseOfferingId,
        actorUserId: ctx.otherTeacherUserId,
        expiresAt: new Date(Date.now() + 10000),
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});
