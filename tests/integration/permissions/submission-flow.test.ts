/**
 * Integration — Submission lifecycle (Phase 6 · ADR-0020)
 *
 * Real Neon DB. Walks the flow:
 *   - student first submit lazy-materialises Submission
 *   - voluntary resubmit flips isCurrent
 *   - status moves forward (SUBMITTED → LATE_SUBMITTED → RETURNED → GRADED)
 *   - RETURN does NOT mutate ScoreEntry (R1 lock)
 *   - L1 — student cannot read peer's Submission via the Prisma layer
 *   - submission window — autoCloseAtDue + past dueAt refuses new versions
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden } from "@/lib/errors";
import { createAssignment } from "@/lib/assignment/assignment";
import {
  gradeSubmission,
  returnSubmission,
  submitVersion,
} from "@/lib/assignment/submission";
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

async function makeAssignment(opts: {
  dueAt?: Date | null;
  autoClose?: boolean;
  scored?: boolean;
  closed?: boolean;
}) {
  return createAssignment(
    {
      courseOfferingId: ctx.courseOfferingId,
      title: `A ${Math.random().toString(36).slice(2, 6)}`,
      description: "",
      dueAt: opts.dueAt ?? null,
      allowText: true,
      allowFile: false,
      allowLink: true,
      submissionClosed: opts.closed ?? false,
      autoCloseAtDue: opts.autoClose ?? false,
      isScored: opts.scored ?? false,
      fullScore: opts.scored ? 50 : undefined,
    },
    { actorUserId: ctx.teacherUserId }
  );
}

describe("submitVersion — initial submit + resubmit", () => {
  it("first submit lazy-materialises Submission + SubmissionVersion v1", async () => {
    const a = await makeAssignment({});
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const v1 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "ignored-lazy-create",
        textContent: "first attempt",
        fileAttachmentIds: [],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    expect(v1.versionNumber).toBe(1);
    expect(v1.isCurrent).toBe(true);

    const sub = await db.submission.findFirstOrThrow({
      where: { assignmentId: a.id },
      select: { status: true },
    });
    expect(sub.status).toBe("SUBMITTED");
  });

  it("voluntary resubmit flips previous isCurrent + increments versionNumber", async () => {
    const a = await makeAssignment({});
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "",
        textContent: "v1",
        fileAttachmentIds: [],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    const v2 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "",
        textContent: "v2 improved",
        fileAttachmentIds: [],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    expect(v2.versionNumber).toBe(2);
    expect(v2.isCurrent).toBe(true);

    const v1 = await db.submissionVersion.findFirstOrThrow({
      where: { submissionId: v2.submissionId, versionNumber: 1 },
    });
    expect(v1.isCurrent).toBe(false);
  });

  it("late submit transitions status SUBMITTED → LATE_SUBMITTED", async () => {
    const past = new Date(Date.now() - 60_000);
    const a = await makeAssignment({ dueAt: past });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const v1 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "",
        textContent: "late",
        fileAttachmentIds: [],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    expect(v1.isLate).toBe(true);
    const sub = await db.submission.findUniqueOrThrow({
      where: { id: v1.submissionId },
      select: { status: true },
    });
    expect(sub.status).toBe("LATE_SUBMITTED");
  });

  it("autoCloseAtDue + past dueAt rejects new versions (lazy soft stop)", async () => {
    const past = new Date(Date.now() - 60_000);
    const a = await makeAssignment({ dueAt: past, autoClose: true });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: "",
          textContent: "x",
          fileAttachmentIds: [],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("submissionClosed=true rejects new versions (manual hard stop)", async () => {
    const a = await makeAssignment({ closed: true });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: "",
          textContent: "x",
          fileAttachmentIds: [],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("non-enrolled student is rejected (not_active_enrollment)", async () => {
    const a = await makeAssignment({});
    // No enrollStudent — ctx.studentUserId has no Enrollment row.
    await expect(
      submitVersion(
        {
          assignmentId: a.id,
          submissionId: "",
          textContent: "x",
          fileAttachmentIds: [],
          links: [],
        },
        { actorUserId: ctx.studentUserId }
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("returnSubmission — does NOT touch ScoreEntry (ADR-0020 § 1)", () => {
  it("RETURN persists ScoreEntry value + transitions Submission.status", async () => {
    const a = await makeAssignment({ scored: true });
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const v1 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "",
        textContent: "v1",
        fileAttachmentIds: [],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    // Teacher grades v1
    await gradeSubmission(
      { submissionId: v1.submissionId, value: 42 },
      { actorUserId: ctx.teacherUserId }
    );
    // Now teacher returns
    await returnSubmission(
      { submissionId: v1.submissionId, comment: "please fix step 2" },
      { actorUserId: ctx.teacherUserId }
    );
    // ScoreEntry survives
    const entry = await db.scoreEntry.findFirst({
      where: {
        scoreItemId: a.scoreItemId!,
      },
      select: { value: true },
    });
    expect(entry?.value).toBe(42);
    // Status is RETURNED
    const sub = await db.submission.findUniqueOrThrow({
      where: { id: v1.submissionId },
      select: { status: true },
    });
    expect(sub.status).toBe("RETURNED");
    // PRIVATE Comment was inserted with the body
    const c = await db.comment.findFirst({
      where: { ownerType: "SUBMISSION", ownerId: v1.submissionId },
      select: { scope: true, body: true },
    });
    expect(c).toEqual({ scope: "PRIVATE", body: "please fix step 2" });
  });
});

describe("L1 boundary — peer cannot read another student's Submission via Prisma", () => {
  it("peer student cannot find peer's Submission row", async () => {
    const a = await makeAssignment({});
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);
    const v1 = await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "",
        textContent: "alice's work",
        fileAttachmentIds: [],
        links: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    // Peer queries via the L1-correct shape (own enrollmentId only).
    const peerEnrollment = await db.enrollment.findUniqueOrThrow({
      where: {
        studentId_courseOfferingId: {
          studentId: ctx.otherStudentUserId,
          courseOfferingId: ctx.courseOfferingId,
        },
      },
      select: { id: true },
    });
    const peerView = await db.submission.findUnique({
      where: {
        assignmentId_enrollmentId: {
          assignmentId: a.id,
          enrollmentId: peerEnrollment.id,
        },
      },
    });
    expect(peerView).toBeNull();
    // Sanity — owner row exists.
    expect(v1.id).toBeTruthy();
  });
});
