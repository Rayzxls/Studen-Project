// @vitest-environment node

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  appealModerationCase,
  applyModerationCaseAction,
  createModerationReport,
} from "@/lib/moderation/service";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./permissions/_fixtures";

describe("Moderation Center workflow", () => {
  let ctx: TestCourseContext;
  let adminUserId: string;
  let caseIds: string[] = [];

  beforeEach(async () => {
    assertIsolatedTestDatabase();
    ctx = await setupTestCourse();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);

    const suffix = randomBytes(4).toString("hex");
    const admin = await db.user.create({
      data: {
        identifier: `${ctx.prefix}_moderator_${suffix}@test.local`,
        passwordHash: "integration-test-only",
        role: "ADMIN",
        admin: { create: { firstName: "QA", lastName: "Moderator" } },
      },
      select: { id: true },
    });
    adminUserId = admin.id;
  });

  afterEach(async () => {
    if (caseIds.length > 0) {
      await db.moderationCaseEvent.deleteMany({
        where: { caseId: { in: caseIds } },
      });
      await db.moderationReport.deleteMany({
        where: { caseId: { in: caseIds } },
      });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { targetType: "ModerationCase", targetId: { in: caseIds } },
            { actorId: adminUserId },
          ],
        },
      });
      await db.moderationCase.deleteMany({
        where: { id: { in: caseIds } },
      });
    }
    if (adminUserId) {
      await db.user.deleteMany({ where: { id: adminUserId } });
    }
    if (ctx) await ctx.cleanup();
    caseIds = [];
  });

  it("aggregates reports, preserves evidence, restricts content and supports one appeal", async () => {
    const announcement = await db.announcement.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        title: "QA moderation announcement",
        body: "Evidence body captured before later edits.",
        linkUrls: ["https://example.com/evidence"],
        postedById: ctx.teacherUserId,
      },
      select: { id: true },
    });

    const first = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "ANNOUNCEMENT",
        targetId: announcement.id,
        category: "INAPPROPRIATE_CONTENT",
        details: "QA report from the first enrolled student.",
      },
      { enabled: true }
    );
    caseIds = [first.caseId];

    const duplicate = await createModerationReport(
      {
        actor: { userId: ctx.studentUserId, role: "STUDENT" },
        targetType: "ANNOUNCEMENT",
        targetId: announcement.id,
        category: "SPAM",
        details: "This duplicate must not increment the case.",
      },
      { enabled: true }
    );
    const second = await createModerationReport(
      {
        actor: { userId: ctx.otherStudentUserId, role: "STUDENT" },
        targetType: "ANNOUNCEMENT",
        targetId: announcement.id,
        category: "PRIVACY",
        details: "QA report from another enrolled student.",
      },
      { enabled: true }
    );

    expect(duplicate).toMatchObject({
      caseId: first.caseId,
      duplicate: true,
      reportCount: 1,
    });
    expect(second).toMatchObject({
      caseId: first.caseId,
      duplicate: false,
      reportCount: 2,
    });

    await db.announcement.update({
      where: { id: announcement.id },
      data: { body: "Edited after the report." },
    });

    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: first.caseId,
        action: "START_REVIEW",
        internalReason: "QA moderator accepted the case for review.",
      },
      { enabled: true }
    );
    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: first.caseId,
        action: "HIDE",
        internalReason: "QA evidence requires temporary restriction.",
      },
      { enabled: true }
    );
    await applyModerationCaseAction(
      {
        actor: { userId: adminUserId, role: "ADMIN" },
        caseId: first.caseId,
        action: "RESOLVE",
        internalReason: "QA confirms the reported content violates policy.",
        userMessage: "เนื้อหาถูกจำกัดและสามารถยื่นอุทธรณ์ได้ภายใน 7 วัน",
      },
      { enabled: true }
    );

    const resolved = await db.moderationCase.findUniqueOrThrow({
      where: { id: first.caseId },
      select: {
        status: true,
        reportCount: true,
        restrictionKind: true,
        targetSnapshot: true,
        appealDeadline: true,
      },
    });
    expect(resolved).toMatchObject({
      status: "RESOLVED",
      reportCount: 2,
      restrictionKind: "HIDDEN",
      targetSnapshot: {
        title: "QA moderation announcement",
        body: "Evidence body captured before later edits.",
        linkUrls: ["https://example.com/evidence"],
        fileAttachmentIds: [],
      },
    });
    expect(resolved.appealDeadline).not.toBeNull();

    await appealModerationCase(
      {
        actor: { userId: ctx.teacherUserId, role: "TEACHER" },
        caseId: first.caseId,
        reason: "Please review the classroom context and attached evidence.",
      },
      { enabled: true }
    );

    const appealed = await db.moderationCase.findUniqueOrThrow({
      where: { id: first.caseId },
      select: { status: true, appealUsed: true, activeKey: true },
    });
    const reports = await db.moderationReport.count({
      where: { caseId: first.caseId },
    });
    const events = await db.moderationCaseEvent.findMany({
      where: { caseId: first.caseId },
      orderBy: { createdAt: "asc" },
      select: { type: true },
    });
    const auditCount = await db.auditLog.count({
      where: { targetType: "ModerationCase", targetId: first.caseId },
    });

    expect(appealed.status).toBe("APPEALED");
    expect(appealed.appealUsed).toBe(true);
    expect(appealed.activeKey).toBe(`ANNOUNCEMENT:${announcement.id}`);
    expect(reports).toBe(2);
    expect(events.map((event) => event.type)).toEqual([
      "REPORT_ADDED",
      "REPORT_ADDED",
      "REVIEW_STARTED",
      "TEMPORARILY_RESTRICTED",
      "RESOLVED",
      "APPEAL_SUBMITTED",
    ]);
    expect(auditCount).toBe(6);
  });
});
