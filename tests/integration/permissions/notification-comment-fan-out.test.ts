/**
 * Integration — Comment lifecycle + COMMENT_REPLIED fan-out (Phase 7 · P7-9)
 *
 * Locks the lib/assignment/comment behaviour against a real Neon DB:
 *
 *   - CLASS_WIDE on Assignment / Material / Announcement fans out to
 *     `DISTINCT(prior commenters) ∪ entity author − self` (thread rule).
 *   - PRIVATE on Submission collapses to the "other party" only.
 *   - Author self-edit inside the 5-min window succeeds; outside it
 *     throws `edit_window_expired` (we exercise the boundary by hand-
 *     editing `createdAt` rather than waiting 5 min).
 *   - Author self-delete succeeds any time and is Verbose (no audit).
 *   - Teacher moderate-delete fires `COMMENT_MODERATED` Important with
 *     the actor / reason payload.
 *   - Edited-comment notifications are NOT re-synced — per ADR-0022 §
 *     "Snapshot fixed", an edit within the 5-min window leaves the bell
 *     row untouched. (We don't assert on Notification updatedAt because
 *     edits emit no notification of their own.)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden } from "@/lib/errors";
import {
  createComment,
  editComment,
  selfDeleteComment,
  moderateDeleteComment,
} from "@/lib/assignment/comment";
import { createAssignment } from "@/lib/assignment/assignment";
import { createMaterial } from "@/lib/material";
import { createAnnouncement } from "@/lib/announcement";
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

async function makeAssignment() {
  return createAssignment(
    {
      courseOfferingId: ctx.courseOfferingId,
      title: `A ${Math.random().toString(36).slice(2, 6)}`,
      description: "",
      dueAt: null,
      allowText: true,
      allowFile: false,
      allowLink: false,
      submissionClosed: false,
      autoCloseAtDue: false,
      isScored: false,
    },
    { actorUserId: ctx.teacherUserId }
  );
}

describe("createComment — CLASS_WIDE thread fan-out", () => {
  it("ASSIGNMENT: thread = prior commenters ∪ entity author − self", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);

    // student1 posts first — should notify the assignment author (teacher).
    await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "first reply",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );

    const afterFirst = await db.notification.findMany({
      where: {
        sourceEntityType: "COMMENT",
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { recipientId: true },
    });
    const r1 = new Set(afterFirst.map((n) => n.recipientId));
    expect(r1.has(ctx.teacherUserId)).toBe(true);
    expect(r1.has(ctx.studentUserId)).toBe(false); // self excluded
    expect(r1.has(ctx.otherStudentUserId)).toBe(false); // not yet a participant

    // student2 posts second — should notify (teacher, student1), not self.
    await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "second reply",
      },
      { actorUserId: ctx.otherStudentUserId, actorRole: "STUDENT" }
    );

    const afterSecond = await db.notification.findMany({
      where: {
        sourceEntityType: "COMMENT",
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { recipientId: true, sourceEntityId: true },
    });
    // 1st comment: 1 row (→ teacher).
    // 2nd comment: 2 rows (→ teacher + student1).
    expect(afterSecond.length).toBe(3);
    const second = afterSecond.filter(
      (n) =>
        !afterFirst.some(
          (p) =>
            p.recipientId === n.recipientId &&
            p.recipientId === ctx.teacherUserId
        )
    );
    void second;
    // simpler: count distinct comments referenced.
    const distinctComments = new Set(afterSecond.map((n) => n.sourceEntityId));
    expect(distinctComments.size).toBe(2);
  });

  it("MATERIAL: same rule — teacher posts the material, student replies, teacher is notified", async () => {
    const m = await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Worksheet",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    // Drain the MATERIAL_POSTED broadcast row so we measure ONLY the
    // COMMENT_REPLIED fan-out below.
    const startCount = await db.notification.count({
      where: { courseOfferingId: ctx.courseOfferingId },
    });

    await createComment(
      {
        ownerType: "MATERIAL",
        ownerId: m.id,
        scope: "CLASS_WIDE",
        body: "thanks teacher",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );

    const rows = await db.notification.findMany({
      where: {
        courseOfferingId: ctx.courseOfferingId,
        sourceEntityType: "COMMENT",
      },
      select: { recipientId: true, kind: true },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.recipientId).toBe(ctx.teacherUserId);
    expect(rows[0]?.kind).toBe("COMMENT_REPLIED");
    void startCount;
  });

  it("teacher commenting under own freshly-created entity with no prior thread = 0 recipients", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "first to comment is me",
      },
      { actorUserId: ctx.teacherUserId, actorRole: "TEACHER" }
    );

    const rows = await db.notification.findMany({
      where: {
        courseOfferingId: ctx.courseOfferingId,
        sourceEntityType: "COMMENT",
      },
    });
    expect(rows.length).toBe(0);
  });
});

describe("createComment — PRIVATE on Submission", () => {
  it("notifies the other party only (teacher → student of the submission)", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);

    // Lazy-materialise a Submission via the student's first submit.
    await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "lazy",
        textContent: "draft v1",
        links: [],
        fileAttachmentIds: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    const sub = await db.submission.findFirstOrThrow({
      where: { assignmentId: a.id },
      select: { id: true },
    });

    // Teacher writes a PRIVATE comment under the submission.
    await createComment(
      {
        ownerType: "SUBMISSION",
        ownerId: sub.id,
        scope: "PRIVATE",
        body: "private note from teacher",
      },
      { actorUserId: ctx.teacherUserId, actorRole: "TEACHER" }
    );

    const rows = await db.notification.findMany({
      where: {
        courseOfferingId: ctx.courseOfferingId,
        sourceEntityType: "COMMENT",
      },
      select: { recipientId: true, kind: true },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.recipientId).toBe(ctx.studentUserId);
    expect(rows[0]?.kind).toBe("COMMENT_REPLIED");
  });

  it("scope ↔ ownerType invariant: PRIVATE on ASSIGNMENT throws", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await expect(
      createComment(
        {
          ownerType: "ASSIGNMENT",
          ownerId: a.id,
          scope: "PRIVATE",
          body: "x",
        },
        { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
      )
    ).rejects.toThrowError();
  });

  it("scope ↔ ownerType invariant: CLASS_WIDE on SUBMISSION throws", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await submitVersion(
      {
        assignmentId: a.id,
        submissionId: "lazy",
        textContent: "v",
        links: [],
        fileAttachmentIds: [],
      },
      { actorUserId: ctx.studentUserId }
    );
    const sub = await db.submission.findFirstOrThrow({
      where: { assignmentId: a.id },
      select: { id: true },
    });
    await expect(
      createComment(
        {
          ownerType: "SUBMISSION",
          ownerId: sub.id,
          scope: "CLASS_WIDE",
          body: "x",
        },
        { actorUserId: ctx.teacherUserId, actorRole: "TEACHER" }
      )
    ).rejects.toThrowError();
  });
});

describe("editComment — 5-min self-window", () => {
  it("author can edit immediately after posting", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "v1",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    await editComment(
      { commentId: c.id, body: "v2 edited" },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    const row = await db.comment.findUniqueOrThrow({
      where: { id: c.id },
      select: { body: true, editedAt: true },
    });
    expect(row.body).toBe("v2 edited");
    expect(row.editedAt).not.toBeNull();
  });

  it("edit window expires after 5 min", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "v1",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    // Backdate the row 6 minutes to fall outside the window.
    await db.comment.update({
      where: { id: c.id },
      data: { createdAt: new Date(Date.now() - 6 * 60 * 1000) },
    });
    await expect(
      editComment(
        { commentId: c.id, body: "too late" },
        { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
      )
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("non-author cannot edit", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "v1",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    await expect(
      editComment(
        { commentId: c.id, body: "hijack" },
        { actorUserId: ctx.otherStudentUserId, actorRole: "STUDENT" }
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("selfDeleteComment — author owns, anytime", () => {
  it("author can self-delete even past the edit window", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "regret",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    await db.comment.update({
      where: { id: c.id },
      data: { createdAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    await selfDeleteComment(c.id, {
      actorUserId: ctx.studentUserId,
      actorRole: "STUDENT",
    });
    const row = await db.comment.findUniqueOrThrow({
      where: { id: c.id },
      select: { deletedAt: true, deletedById: true },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).toBe(ctx.studentUserId);
  });

  it("self-delete does NOT write an audit row (Verbose tier)", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "v1",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    const before = await db.auditLog.count({
      where: { action: "COMMENT_MODERATED" },
    });
    await selfDeleteComment(c.id, {
      actorUserId: ctx.studentUserId,
      actorRole: "STUDENT",
    });
    const after = await db.auditLog.count({
      where: { action: "COMMENT_MODERATED" },
    });
    expect(after).toBe(before);
  });
});

describe("moderateDeleteComment — Teacher own course", () => {
  it("teacher of this course deletes + writes COMMENT_MODERATED Important audit", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "inappropriate",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    await moderateDeleteComment(
      { commentId: c.id, reason: "เนื้อหาไม่เหมาะสม" },
      { actorUserId: ctx.teacherUserId, actorRole: "TEACHER" }
    );
    const row = await db.comment.findUniqueOrThrow({
      where: { id: c.id },
      select: { deletedAt: true, deletedById: true, deletedReason: true },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).toBe(ctx.teacherUserId);
    expect(row.deletedReason).toBe("เนื้อหาไม่เหมาะสม");

    const audit = await db.auditLog.findFirst({
      where: {
        action: "COMMENT_MODERATED",
        targetId: c.id,
      },
      select: { actorRole: true, reason: true },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorRole).toBe("TEACHER");
    expect(audit?.reason).toBe("เนื้อหาไม่เหมาะสม");
  });

  it("foreign teacher cannot moderate (not_course_owner)", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "v",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    await expect(
      moderateDeleteComment(
        { commentId: c.id, reason: "outside my course" },
        { actorUserId: ctx.otherTeacherUserId, actorRole: "TEACHER" }
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("reason shorter than 5 chars throws", async () => {
    const a = await makeAssignment();
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const c = await createComment(
      {
        ownerType: "ASSIGNMENT",
        ownerId: a.id,
        scope: "CLASS_WIDE",
        body: "v",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    await expect(
      moderateDeleteComment(
        { commentId: c.id, reason: "no" },
        { actorUserId: ctx.teacherUserId, actorRole: "TEACHER" }
      )
    ).rejects.toThrowError();
  });
});

describe("Announcement + Material + Submission fan-out cross-check", () => {
  it("ANNOUNCEMENT thread: student reply notifies the teacher author", async () => {
    const an = await createAnnouncement(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Heads up",
        body: "Friday closed",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    // Drain the broadcast row.
    await db.notification.deleteMany({
      where: { sourceEntityType: "ANNOUNCEMENT" },
    });
    await createComment(
      {
        ownerType: "ANNOUNCEMENT",
        ownerId: an.id,
        scope: "CLASS_WIDE",
        body: "noted",
      },
      { actorUserId: ctx.studentUserId, actorRole: "STUDENT" }
    );
    const rows = await db.notification.findMany({
      where: {
        sourceEntityType: "COMMENT",
        courseOfferingId: ctx.courseOfferingId,
      },
      select: { recipientId: true },
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.recipientId).toBe(ctx.teacherUserId);
  });
});
