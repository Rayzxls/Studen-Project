/**
 * Integration — File attachment scope on SubmissionVersion (Phase 7 · P7-0a + P7-0c)
 *
 * Real Neon DB. Walks the scope-validation logic of submitVersion when
 * `fileAttachmentIds` is non-empty. Does NOT exercise R2 — that requires
 * either a live bucket or a mock SDK, deferred to Phase 9 hardening. What
 * we lock here is the lib-layer guarantee that prevents one student's file
 * from being referenced by another student's submission, even though both
 * files live under the same polymorphic `ownerType=SUBMISSION` namespace.
 *
 * The FileAttachment rows in this file are fabricated directly via Prisma
 * — they would normally arrive through the /api/storage/commit handshake,
 * but for scope-validation testing the rows just need to exist with the
 * right (ownerType, ownerId, deletedAt) shape.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { ValidationError } from "@/lib/errors";
import { createAssignment } from "@/lib/assignment/assignment";
import { submitVersion } from "@/lib/assignment/submission";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

async function makeAssignment(opts: { allowFile: boolean }) {
  return createAssignment(
    {
      courseOfferingId: ctx.courseOfferingId,
      title: `A ${Math.random().toString(36).slice(2, 6)}`,
      description: "",
      dueAt: null,
      allowText: true,
      allowFile: opts.allowFile,
      allowLink: false,
      submissionClosed: false,
      autoCloseAtDue: false,
      isScored: false,
    },
    { actorUserId: ctx.teacherUserId }
  );
}

async function mkFileAttachment(opts: {
  ownerType: "SUBMISSION" | "ASSIGNMENT";
  ownerId: string;
  uploadedById: string;
  deleted?: boolean;
}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return db.fileAttachment.create({
    data: {
      r2Key: `permanent/${opts.ownerType}/${opts.ownerId}/${suffix}.pdf`,
      originalFilename: `${suffix}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      ownerType: opts.ownerType,
      ownerId: opts.ownerId,
      uploadedById: opts.uploadedById,
      deletedAt: opts.deleted ? new Date() : null,
    },
    select: { id: true },
  });
}

async function lazyMakeSubmissionShell(
  assignmentId: string,
  enrollmentId: string
) {
  return db.submission.create({
    data: { assignmentId, enrollmentId, status: "DRAFT" },
    select: { id: true },
  });
}

describe("submitVersion — fileAttachmentIds scope (P7-0c)", () => {
  it("accepts ids that reference SUBMISSION ownerType + ownerId match", async () => {
    const a = await makeAssignment({ allowFile: true });
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const submission = await lazyMakeSubmissionShell(a.id, e.id);

    const f1 = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: submission.id,
      uploadedById: ctx.studentUserId,
    });
    const f2 = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: submission.id,
      uploadedById: ctx.studentUserId,
    });

    const v1 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: submission.id,
        fileAttachmentIds: [f1.id, f2.id],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );

    expect(v1.versionNumber).toBe(1);
    // Pointer array persists on the version row.
    const persisted = await db.submissionVersion.findUniqueOrThrow({
      where: { id: v1.id },
      select: { fileAttachmentIds: true },
    });
    expect(persisted.fileAttachmentIds).toEqual([f1.id, f2.id]);
  });

  it("rejects an id that lives under a different Submission", async () => {
    const a = await makeAssignment({ allowFile: true });
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const eOther = await enrollStudent(
      ctx.courseOfferingId,
      ctx.otherStudentUserId
    );
    const own = await lazyMakeSubmissionShell(a.id, e.id);
    const foreign = await lazyMakeSubmissionShell(a.id, eOther.id);

    // Other student uploaded a file to THEIR submission.
    const foreignFile = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: foreign.id,
      uploadedById: ctx.otherStudentUserId,
    });

    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: own.id,
          fileAttachmentIds: [foreignFile.id],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an id that belongs to ASSIGNMENT ownerType (teacher's brief attachment)", async () => {
    const a = await makeAssignment({ allowFile: true });
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const submission = await lazyMakeSubmissionShell(a.id, e.id);

    // File attached to the assignment brief (teacher upload scope).
    const briefFile = await mkFileAttachment({
      ownerType: "ASSIGNMENT",
      ownerId: a.id,
      uploadedById: ctx.teacherUserId,
    });

    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: submission.id,
          fileAttachmentIds: [briefFile.id],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects soft-deleted FileAttachment ids", async () => {
    const a = await makeAssignment({ allowFile: true });
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const submission = await lazyMakeSubmissionShell(a.id, e.id);

    const f = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: submission.id,
      uploadedById: ctx.studentUserId,
      deleted: true,
    });

    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: submission.id,
          fileAttachmentIds: [f.id],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects when assignment.allowFile=false even if ids are scope-valid", async () => {
    const a = await makeAssignment({ allowFile: false });
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const submission = await lazyMakeSubmissionShell(a.id, e.id);

    const f = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: submission.id,
      uploadedById: ctx.studentUserId,
    });

    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: submission.id,
          fileAttachmentIds: [f.id],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("v2 snapshots its own pointer array independent of v1", async () => {
    const a = await makeAssignment({ allowFile: true });
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const submission = await lazyMakeSubmissionShell(a.id, e.id);

    const f1 = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: submission.id,
      uploadedById: ctx.studentUserId,
    });
    const f2 = await mkFileAttachment({
      ownerType: "SUBMISSION",
      ownerId: submission.id,
      uploadedById: ctx.studentUserId,
    });

    const v1 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: submission.id,
        fileAttachmentIds: [f1.id],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );

    const v2 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: submission.id,
        fileAttachmentIds: [f1.id, f2.id],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );

    const persisted1 = await db.submissionVersion.findUniqueOrThrow({
      where: { id: v1.id },
      select: { fileAttachmentIds: true, isCurrent: true },
    });
    const persisted2 = await db.submissionVersion.findUniqueOrThrow({
      where: { id: v2.id },
      select: { fileAttachmentIds: true, isCurrent: true },
    });

    expect(persisted1.fileAttachmentIds).toEqual([f1.id]);
    expect(persisted1.isCurrent).toBe(false);
    expect(persisted2.fileAttachmentIds).toEqual([f1.id, f2.id]);
    expect(persisted2.isCurrent).toBe(true);
  });
});
