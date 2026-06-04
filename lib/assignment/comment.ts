/**
 * Comment lifecycle — Phase 6 · CONTEXT § Comment Moderation · Q5 lock
 *
 * Polymorphic `Comment` rows attach to (ownerType, ownerId). Two scopes:
 *
 *   CLASS_WIDE   visible to all CourseOffering members — Assignment /
 *                Material / Announcement (Phase 7+ for the latter two).
 *   PRIVATE      teacher ↔ one student conversation — Submission only.
 *                The teacher's RETURN comment lives here (created from
 *                lib/assignment/submission.returnSubmission, not here).
 *
 * Three operations:
 *
 *   createComment   — author posts a new comment under an owner row.
 *   editComment     — author edits within the 5-min self-window
 *                     (CONTEXT lock).
 *   deleteComment   — dispatched by actor × scope per the Q5 matrix:
 *
 *                          author self     teacher (own course)   admin
 *     CLASS_WIDE            Verbose (no    Important + reason     Important
 *                           audit) any     (≥5) audit             + reason
 *                           time           COMMENT_MODERATED      audit
 *     PRIVATE               Verbose any    Important + reason     Critical
 *                           time           audit                  + reason
 *                                                                 audit
 *
 *   The Critical-tier Admin × PRIVATE escalation reflects the privacy
 *   posture trade-off discussed in ADR-0021 sibling decision (CONTEXT
 *   § Admin).
 */

import type { CommentOwnerType, Role } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { COMMENT_EDIT_WINDOW_MS, TX_OPTS } from "./constants";
import {
  CreateCommentSchema,
  type CreateCommentInput,
  EditCommentSchema,
  type EditCommentInput,
  ModerateCommentSchema,
  type ModerateCommentInput,
} from "./validation";
import { isWithinCommentEditWindow } from "./status";

export interface ActorCtx {
  actorUserId: string;
  actorRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────
// Internal — resolve the (ownerType, ownerId) into "who can post here"
// ─────────────────────────────────────────────────────────────

interface OwnerContext {
  courseOfferingId: string;
  /** Set when ownerType = SUBMISSION. */
  studentOfSubmissionUserId?: string;
}

/**
 * Look up the owner row and return the CourseOffering + (for PRIVATE
 * scope) the student that the submission belongs to.
 *
 * Throws `comment_owner_not_found` when the owner row does not exist.
 *
 * MATERIAL + ANNOUNCEMENT remain reserved in the schema enum but throw
 * `owner_type_not_supported_yet` here — Phase 7 will plug them in.
 */
async function resolveOwnerContext(
  ownerType: CommentOwnerType,
  ownerId: string
): Promise<OwnerContext> {
  if (ownerType === "ASSIGNMENT") {
    const row = await db.assignment.findUnique({
      where: { id: ownerId },
      select: { courseOfferingId: true },
    });
    if (!row) throw new NotFound("comment_owner_not_found");
    return { courseOfferingId: row.courseOfferingId };
  }
  if (ownerType === "SUBMISSION") {
    const row = await db.submission.findUnique({
      where: { id: ownerId },
      select: {
        enrollment: { select: { studentId: true } },
        assignment: { select: { courseOfferingId: true } },
      },
    });
    if (!row) throw new NotFound("comment_owner_not_found");
    return {
      courseOfferingId: row.assignment.courseOfferingId,
      studentOfSubmissionUserId: row.enrollment.studentId,
    };
  }
  throw new Conflict("owner_type_not_supported_yet");
}

/**
 * Active enrollment lookup for "may a student post in this CourseOffering?".
 * Removed enrollments cannot comment (ADR-0013 — soft-delete preserves
 * trace but suspends write privileges).
 */
async function hasActiveEnrollment(
  courseOfferingId: string,
  studentUserId: string
): Promise<boolean> {
  const row = await db.enrollment.findFirst({
    where: {
      courseOfferingId,
      studentId: studentUserId,
      removedAt: null,
    },
    select: { id: true },
  });
  return row !== null;
}

/** Course teacher (owner) lookup. */
async function getCourseTeacherId(
  courseOfferingId: string
): Promise<string | null> {
  const row = await db.courseOffering.findUnique({
    where: { id: courseOfferingId },
    select: { teacherId: true },
  });
  return row?.teacherId ?? null;
}

// ─────────────────────────────────────────────────────────────
// createComment
// ─────────────────────────────────────────────────────────────

/**
 * Post a new comment.
 *
 * Authz dispatch by scope:
 *
 *   CLASS_WIDE on ASSIGNMENT
 *     - owning teacher (CourseOffering.teacherId === actor); OR
 *     - active enrolled student.
 *
 *   PRIVATE on SUBMISSION
 *     - owning teacher; OR
 *     - the student of that Submission (and only that student).
 *
 * The scope must match the ownerType — `CLASS_WIDE on SUBMISSION` or
 * `PRIVATE on ASSIGNMENT` throws `scope_owner_mismatch`. This is the
 * canonical place where the scope ↔ ownerType invariant is enforced
 * (the schema enum allows either combination, but only the four
 * scope × ownerType cells above have meaning).
 *
 * Verbose tier — no audit (normal user activity).
 */
export async function createComment(
  input: CreateCommentInput,
  ctx: ActorCtx
): Promise<{ id: string }> {
  const parsed = CreateCommentSchema.parse(input);

  // Scope ↔ ownerType invariant.
  if (parsed.scope === "PRIVATE" && parsed.ownerType !== "SUBMISSION") {
    throw new ValidationError({ scope: "scope_owner_mismatch" });
  }
  if (parsed.scope === "CLASS_WIDE" && parsed.ownerType === "SUBMISSION") {
    throw new ValidationError({ scope: "scope_owner_mismatch" });
  }

  const owner = await resolveOwnerContext(parsed.ownerType, parsed.ownerId);
  const teacherId = await getCourseTeacherId(owner.courseOfferingId);

  if (parsed.scope === "PRIVATE") {
    // PRIVATE on Submission — owning teacher OR the specific student.
    const isTeacher = teacherId === ctx.actorUserId;
    const isOwnerStudent = owner.studentOfSubmissionUserId === ctx.actorUserId;
    if (!isTeacher && !isOwnerStudent) {
      throw new Forbidden("not_private_comment_participant");
    }
  } else {
    // CLASS_WIDE — owning teacher OR any active enrolled student.
    const isTeacher = teacherId === ctx.actorUserId;
    if (!isTeacher) {
      if (ctx.actorRole !== "STUDENT") {
        throw new Forbidden("not_course_participant");
      }
      const enrolled = await hasActiveEnrollment(
        owner.courseOfferingId,
        ctx.actorUserId
      );
      if (!enrolled) throw new Forbidden("not_course_participant");
    }
  }

  const created = await db.comment.create({
    data: {
      ownerType: parsed.ownerType,
      ownerId: parsed.ownerId,
      scope: parsed.scope,
      authorId: ctx.actorUserId,
      body: parsed.body,
    },
    select: { id: true },
  });
  return created;
}

// ─────────────────────────────────────────────────────────────
// editComment
// ─────────────────────────────────────────────────────────────

/**
 * Author self-edit, within the 5-min window anchored to `createdAt`
 * (CONTEXT § Comment Moderation lock; PURE helper `isWithinCommentEditWindow`
 * in `./status.ts`).
 *
 * Outside the window — throw `edit_window_expired`. Author may still
 * self-delete; they just cannot rewrite.
 *
 * Author identity is enforced: only `authorId === ctx.actorUserId` may
 * edit (no teacher / admin override — moderators delete, never rewrite).
 *
 * Verbose tier — no audit.
 */
export async function editComment(
  input: EditCommentInput,
  ctx: ActorCtx
): Promise<void> {
  const parsed = EditCommentSchema.parse(input);

  await db.$transaction(async (tx) => {
    const current = await tx.comment.findUnique({
      where: { id: parsed.commentId },
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        deletedAt: true,
      },
    });
    if (!current) throw new NotFound("comment_not_found");
    if (current.deletedAt !== null) throw new Conflict("comment_deleted");
    if (current.authorId !== ctx.actorUserId) {
      throw new Forbidden("not_comment_author");
    }
    if (
      !isWithinCommentEditWindow({
        createdAt: current.createdAt,
        now: new Date(),
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ) {
      throw new Conflict("edit_window_expired");
    }

    await tx.comment.update({
      where: { id: parsed.commentId },
      data: { body: parsed.body, editedAt: new Date() },
    });
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// deleteComment — Q5 dispatch matrix
// ─────────────────────────────────────────────────────────────

/**
 * Author self-delete. Soft-delete (`deletedAt`, `deletedById=author`).
 * Verbose tier — no audit. Available any time, including past the edit
 * window (author owns their content).
 *
 * Refuses to soft-delete an already-deleted row (no-op idempotency would
 * mask a UI bug — caller should not reach this with a deleted comment).
 */
export async function selfDeleteComment(
  commentId: string,
  ctx: ActorCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, deletedAt: true },
    });
    if (!current) throw new NotFound("comment_not_found");
    if (current.deletedAt !== null) throw new Conflict("comment_deleted");
    if (current.authorId !== ctx.actorUserId) {
      throw new Forbidden("not_comment_author");
    }
    await tx.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), deletedById: ctx.actorUserId },
    });
  }, TX_OPTS);
}

/**
 * Moderator delete — Teacher (own course) OR Admin (any course).
 *
 * Reason ≥ 5 chars (Zod-enforced via ModerateCommentSchema).
 *
 * Audit tier dispatch per CONTEXT § Comment Moderation:
 *   Teacher              → Important (any scope)
 *   Admin × CLASS_WIDE   → Important
 *   Admin × PRIVATE      → Critical  (privacy escalation)
 *
 * Single audit event name (`COMMENT_MODERATED`) — the tier escalation
 * surfaces via the `actorRole` field on the AuditLog row + the absence
 * of any "Teacher" tag on Admin × PRIVATE deletes. The Security.md tier
 * dispatcher reads (action, actorRole, target scope) to bucket rows
 * into the Important / Critical reports.
 */
export async function moderateDeleteComment(
  input: ModerateCommentInput,
  ctx: ActorCtx
): Promise<void> {
  const parsed = ModerateCommentSchema.parse(input);

  await db.$transaction(async (tx) => {
    const current = await tx.comment.findUnique({
      where: { id: parsed.commentId },
      select: {
        id: true,
        scope: true,
        authorId: true,
        ownerType: true,
        ownerId: true,
        body: true,
        deletedAt: true,
      },
    });
    if (!current) throw new NotFound("comment_not_found");
    if (current.deletedAt !== null) throw new Conflict("comment_deleted");

    // Authz dispatch by role.
    if (ctx.actorRole === "TEACHER") {
      const owner = await resolveOwnerContext(
        current.ownerType,
        current.ownerId
      );
      const teacherId = await getCourseTeacherId(owner.courseOfferingId);
      if (teacherId !== ctx.actorUserId) {
        throw new Forbidden("not_course_owner");
      }
    } else if (ctx.actorRole === "ADMIN") {
      // Admin can moderate any comment in any course (CONTEXT § Admin).
      // No further course-level check required.
    } else {
      throw new Forbidden("not_moderator");
    }

    await tx.comment.update({
      where: { id: current.id },
      data: {
        deletedAt: new Date(),
        deletedById: ctx.actorUserId,
        deletedReason: parsed.reason,
      },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        action: "COMMENT_MODERATED",
        targetType: "Comment",
        targetId: current.id,
        reason: parsed.reason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: {
          scope: current.scope,
          authorId: current.authorId,
          ownerType: current.ownerType,
          // Truncate the body in the audit payload — keep enough for
          // forensic context without verbatim doxxing of student writing.
          bodyPreview: current.body.slice(0, 200),
        },
      },
      tx
    );
  }, TX_OPTS);
}
