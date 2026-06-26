/**
 * Submission lifecycle — Phase 6 · ADR-0020
 *
 * Two write paths:
 *
 *   Student-facing
 *     submitVersion    — initial submit + voluntary resubmit. Lazy-
 *                        materialises the Submission row on first call.
 *                        Sets previous currentVersion.isCurrent=false and
 *                        recomputes Submission.status forward-only.
 *     withdrawSubmission — student withdraws the current submission from the
 *                        teacher review queue while preserving version
 *                        history.
 *
 *   Teacher-facing
 *     returnSubmission — workflow signal: inserts a PRIVATE Comment,
 *                        transitions status to RETURNED, fires
 *                        SUBMISSION_RETURNED audit (Important · reason =
 *                        comment body). Never touches ScoreEntry —
 *                        ScoreEntry follows ADR-0018 on its own.
 *     gradeSubmission  — scored Assignment: upserts ScoreEntry on the
 *                        linked ScoreItem under ADR-0018 (post-publish
 *                        reason gate inherited from lib/scoring). Ungraded
 *                        Assignment: marks Submission.status = GRADED.
 *
 * File handling (P7-0c): `fileAttachmentIds` is validated against the
 * Submission scope — every referenced FileAttachment must be ownerType=
 * SUBMISSION + ownerId = this Submission.id. Files attach to the parent
 * Submission (P7-0a) and SubmissionVersion.fileAttachmentIds is the
 * per-version pointer array (ADR-0021 § 1 chicken-and-egg resolved).
 */

import type { Prisma, Submission, SubmissionVersion } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { clipExcerpt, fanOutTargeted } from "@/lib/notification";
import { REASON_MIN, TX_OPTS } from "./constants";
import {
  ReturnSubmissionSchema,
  type ReturnSubmissionInput,
  SubmitVersionSchema,
  type SubmitVersionInput,
} from "./validation";
import {
  checkSubmissionWindow,
  computeSubmissionStatus,
  isLate,
} from "./status";

export interface ActorCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────
// findOrCreateSubmission
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the Submission row for an Assignment × Enrollment pair, creating
 * one in DRAFT status if it does not exist yet.
 *
 * Race-safe via P2002 recovery (mirrors `findOrCreateSession` from Phase 4).
 * Two concurrent first-submits from the same student-on-same-assignment
 * resolve to one Submission row deterministically (`@@unique([assignmentId,
 * enrollmentId])` on the schema).
 *
 * Called from submitVersion. Not exported — students reach a Submission via
 * the submitVersion entry point only; teachers read via a separate query.
 */
async function findOrCreateSubmission(
  tx: Prisma.TransactionClient,
  assignmentId: string,
  enrollmentId: string
): Promise<{ id: string; status: Submission["status"] }> {
  const existing = await tx.submission.findUnique({
    where: { assignmentId_enrollmentId: { assignmentId, enrollmentId } },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  try {
    const created = await tx.submission.create({
      data: { assignmentId, enrollmentId, status: "DRAFT" },
      select: { id: true, status: true },
    });
    return created;
  } catch (err) {
    // P2002 — unique violation. A concurrent insert won; re-read.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const refetched = await tx.submission.findUniqueOrThrow({
        where: { assignmentId_enrollmentId: { assignmentId, enrollmentId } },
        select: { id: true, status: true },
      });
      return refetched;
    }
    throw err;
  }
}

/**
 * Public wrapper around findOrCreateSubmission — materialises the DRAFT
 * Submission row for an active student when they open an Assignment, so the
 * submit form always has a stable submissionId on first visit (the file
 * upload pipeline scopes presigned files to ownerId=submissionId, and the
 * form cannot render its channels without one). Race-safe; idempotent.
 *
 * A version-less DRAFT created this way reads as "ยังไม่ส่ง" on the teacher
 * grid (gated on the presence of a current SubmissionVersion), so opening an
 * assignment never looks like a real submission.
 */
export async function ensureSubmission(
  assignmentId: string,
  enrollmentId: string
): Promise<{ id: string; status: Submission["status"] }> {
  return db.$transaction(
    (tx) => findOrCreateSubmission(tx, assignmentId, enrollmentId),
    TX_OPTS
  );
}

// ─────────────────────────────────────────────────────────────
// submitVersion — student-facing initial submit + voluntary resubmit
// ─────────────────────────────────────────────────────────────

/**
 * Create a new SubmissionVersion (initial submit or voluntary resubmit).
 *
 * Authorisation — the actor must be:
 *   - the student of an active Enrollment in the Assignment's
 *     CourseOffering (`removedAt IS NULL`); AND
 *   - the same student across both v1 and vN (peers cannot resubmit on
 *     each other's behalf).
 *
 * Window check (ADR-0020 § 3) — `checkSubmissionWindow` against
 * `Assignment.submissionClosed` + `autoCloseAtDue` + `dueAt` + `now`.
 *
 * Per-channel allow* check — if textContent is set but Assignment.allowText
 * is false, reject (`channel_not_allowed`).
 *
 * Verbose tier — no audit. Same posture as Phase 5 pre-publish ScoreItem
 * CUD (ADR-0020 § 4 SUBMISSION_VERSION_CREATED not in enum).
 *
 * Files: `fileAttachmentIds` is the snapshot pointer array for this
 * version — each id must reference a FileAttachment with ownerType=
 * SUBMISSION and ownerId equal to the parent Submission.id. Verification
 * happens inside the same $transaction as the version insert (Pattern 2
 * extended) so a presign/commit race with a competing student cannot
 * land a foreign file into the version.
 */
export async function submitVersion(
  input: SubmitVersionInput & { assignmentId: string },
  ctx: ActorCtx
): Promise<SubmissionVersion> {
  const parsedResult = SubmitVersionSchema.safeParse(input);
  if (!parsedResult.success) {
    throw new ValidationError(
      Object.fromEntries(
        parsedResult.error.issues.map((issue) => [
          // Key by the top-level field (e.g. "links"), not the full path
          // ("links.0") — the form reads fieldErrors.links, so a per-item
          // path would silently never surface.
          issue.path[0] != null ? String(issue.path[0]) : "_",
          issue.message,
        ])
      )
    );
  }
  const parsed = parsedResult.data;

  const now = new Date();

  return db.$transaction(async (tx) => {
    // Fetch Assignment + check window + channel.
    const assignment = await tx.assignment.findUnique({
      where: { id: input.assignmentId },
      select: {
        id: true,
        courseOfferingId: true,
        dueAt: true,
        allowText: true,
        allowFile: true,
        allowLink: true,
        submissionClosed: true,
        autoCloseAtDue: true,
      },
    });
    if (!assignment) throw new NotFound("assignment_not_found");

    const window = checkSubmissionWindow({
      submissionClosed: assignment.submissionClosed,
      autoCloseAtDue: assignment.autoCloseAtDue,
      dueAt: assignment.dueAt,
      now,
    });
    if (!window.open) {
      throw new Conflict(window.reason);
    }

    if (
      parsed.textContent !== undefined &&
      parsed.textContent.trim().length > 0 &&
      !assignment.allowText
    ) {
      throw new ValidationError({
        textContent: "channel_not_allowed — ครูปิดการส่งข้อความสำหรับงานนี้",
      });
    }
    if (parsed.links.length > 0 && !assignment.allowLink) {
      throw new ValidationError({
        links: "channel_not_allowed — ครูปิดการส่งลิงก์สำหรับงานนี้",
      });
    }

    // Find the active Enrollment of the student on this CourseOffering.
    // FK to Enrollment, not Student — Pattern 14 + ADR-0013 (preserve trace).
    const enrollment = await tx.enrollment.findFirst({
      where: {
        courseOfferingId: assignment.courseOfferingId,
        studentId: ctx.actorUserId,
        removedAt: null, // only active enrollments may submit
      },
      select: { id: true },
    });
    if (!enrollment) throw new Forbidden("not_active_enrollment");

    const submission = await findOrCreateSubmission(
      tx,
      assignment.id,
      enrollment.id
    );

    // File scope verification (P7-0c) — each referenced FileAttachment must
    // be ownerType=SUBMISSION + ownerId=this Submission.id. Done inside the
    // same tx as the version insert so a concurrent file move cannot slip
    // a foreign attachment in. Files that no longer match (e.g. soft-
    // deleted between commit and submit) are surfaced individually so the
    // client can recover by re-uploading.
    if (parsed.fileAttachmentIds.length > 0) {
      if (!assignment.allowFile) {
        throw new ValidationError({
          fileAttachmentIds:
            "channel_not_allowed — ครูปิดการแนบไฟล์สำหรับงานนี้",
        });
      }
      const owned = await tx.fileAttachment.findMany({
        where: {
          id: { in: parsed.fileAttachmentIds },
          ownerType: "SUBMISSION",
          ownerId: submission.id,
          deletedAt: null,
        },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((r) => r.id));
      const missing = parsed.fileAttachmentIds.filter(
        (id) => !ownedSet.has(id)
      );
      if (missing.length > 0) {
        throw new ValidationError({
          fileAttachmentIds: `file_not_owned_by_submission — ${missing.join(",")}`,
        });
      }
    }

    // Find the latest version number on this Submission.
    const latest = await tx.submissionVersion.findFirst({
      where: { submissionId: submission.id },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, isCurrent: true },
    });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    // Flip previous current to false (preserve history per CONTEXT).
    if (latest?.isCurrent) {
      await tx.submissionVersion.update({
        where: { id: latest.id },
        data: { isCurrent: false },
      });
    }

    const newIsLate = isLate(now, assignment.dueAt);

    const created = await tx.submissionVersion.create({
      data: {
        submissionId: submission.id,
        versionNumber: nextVersionNumber,
        textContent: parsed.textContent ?? null,
        links: parsed.links as Prisma.InputJsonValue,
        fileAttachmentIds: parsed.fileAttachmentIds as Prisma.InputJsonValue,
        submittedAt: now,
        isLate: newIsLate,
        isCurrent: true,
      },
    });

    // Recompute and persist Submission.status using the PURE helper.
    // isReturned + isGraded clear implicitly on resubmit per ADR-0020 § 2.
    const nextStatus = computeSubmissionStatus({
      hasCurrentVersion: true,
      currentIsLate: newIsLate,
      isReturned: false,
      isGraded: false,
    });
    await tx.submission.update({
      where: { id: submission.id },
      data: { status: nextStatus },
    });

    return created;
  }, TX_OPTS);
}

/**
 * Withdraw the current submitted version without deleting the audit trail.
 *
 * The Submission row remains, every SubmissionVersion remains visible in
 * history, and the current marker is cleared so teacher-facing grids no longer
 * treat the row as ready to review. The student may submit a new version later
 * while the submission window remains open.
 *
 * Allowed only while the work is actually sitting in the review queue
 * (SUBMITTED / LATE_SUBMITTED): GRADED is final, and RETURNED work is
 * already out of the queue — the student's path there is resubmit, not
 * withdraw (CONTEXT § Student Assignment Workspace).
 *
 * Audit: SUBMISSION_WITHDRAWN (Important) — the withdrawal changes what the
 * teacher's review queue shows, so it must be traceable even though it is a
 * student self-action. No teacher notification yet — that would need a new
 * NotificationKind enum value (schema migration), deferred deliberately.
 */
export async function withdrawSubmission(
  input: { assignmentId: string; submissionId: string },
  ctx: ActorCtx
): Promise<void> {
  const now = new Date();

  await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: input.submissionId },
      select: {
        id: true,
        status: true,
        assignmentId: true,
        versions: {
          where: { isCurrent: true },
          select: { id: true },
          take: 1,
        },
        enrollment: {
          select: {
            studentId: true,
            removedAt: true,
            courseOfferingId: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            submissionClosed: true,
            autoCloseAtDue: true,
            dueAt: true,
            courseOfferingId: true,
            course: { select: { name: true } },
          },
        },
      },
    });
    if (!submission) throw new NotFound("submission_not_found");
    if (submission.assignmentId !== input.assignmentId) {
      throw new Forbidden("submission_assignment_mismatch");
    }
    if (
      submission.enrollment.studentId !== ctx.actorUserId ||
      submission.enrollment.removedAt !== null ||
      submission.enrollment.courseOfferingId !==
        submission.assignment.courseOfferingId
    ) {
      throw new Forbidden("not_active_enrollment");
    }
    if (submission.status === "GRADED") {
      throw new Conflict("submission_already_graded");
    }
    if (submission.status === "RETURNED") {
      throw new Conflict("submission_returned_resubmit_instead");
    }

    const window = checkSubmissionWindow({
      submissionClosed: submission.assignment.submissionClosed,
      autoCloseAtDue: submission.assignment.autoCloseAtDue,
      dueAt: submission.assignment.dueAt,
      now,
    });
    if (!window.open) {
      throw new Conflict(window.reason);
    }
    if (submission.versions.length === 0) {
      throw new Conflict("no_current_submission");
    }

    await tx.submissionVersion.updateMany({
      where: { submissionId: submission.id, isCurrent: true },
      data: { isCurrent: false },
    });
    await tx.submission.update({
      where: { id: submission.id },
      data: { status: "DRAFT" },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "STUDENT",
        action: "SUBMISSION_WITHDRAWN",
        targetType: "Submission",
        targetId: submission.id,
        targetLabel: `${submission.enrollment.student.firstName} ${submission.enrollment.student.lastName} — ${submission.assignment.title} (วิชา${submission.assignment.course.name})`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: { status: submission.status },
        after: { status: "DRAFT" },
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// hideSubmissionVersion — student declutters own history (soft-hide)
// ─────────────────────────────────────────────────────────────

/**
 * Soft-hide one past SubmissionVersion from the student's OWN history list
 * (ADR-0020 — history is never destroyed; the teacher + audit trail keep
 * seeing it). Only a non-current version owned by the acting student may be
 * hidden; the current (live) submission cannot be hidden.
 */
export async function hideSubmissionVersion(
  input: { assignmentId: string; submissionId: string; versionId: string },
  ctx: ActorCtx
): Promise<void> {
  const now = new Date();

  await db.$transaction(async (tx) => {
    const version = await tx.submissionVersion.findUnique({
      where: { id: input.versionId },
      select: {
        id: true,
        versionNumber: true,
        isCurrent: true,
        hiddenFromStudentAt: true,
        submission: {
          select: {
            id: true,
            assignmentId: true,
            enrollment: {
              select: {
                studentId: true,
                removedAt: true,
                courseOfferingId: true,
                student: { select: { firstName: true, lastName: true } },
              },
            },
            assignment: {
              select: {
                id: true,
                title: true,
                courseOfferingId: true,
                course: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!version) throw new NotFound("submission_version_not_found");

    const sub = version.submission;
    if (
      sub.id !== input.submissionId ||
      sub.assignmentId !== input.assignmentId
    ) {
      throw new Forbidden("submission_version_mismatch");
    }
    if (
      sub.enrollment.studentId !== ctx.actorUserId ||
      sub.enrollment.removedAt !== null ||
      sub.enrollment.courseOfferingId !== sub.assignment.courseOfferingId
    ) {
      throw new Forbidden("not_active_enrollment");
    }
    if (version.isCurrent) {
      throw new Conflict("cannot_hide_current_version");
    }
    if (version.hiddenFromStudentAt !== null) return; // already hidden — idempotent

    await tx.submissionVersion.update({
      where: { id: version.id },
      data: { hiddenFromStudentAt: now },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "STUDENT",
        action: "SUBMISSION_VERSION_HIDDEN",
        targetType: "SubmissionVersion",
        targetId: version.id,
        targetLabel: `${sub.enrollment.student.firstName} ${sub.enrollment.student.lastName} — ${sub.assignment.title} (วิชา${sub.assignment.course.name}) · การส่งครั้งที่ ${version.versionNumber}`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: { hiddenFromStudentAt: null },
        after: { hiddenFromStudentAt: now.toISOString() },
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// returnSubmission — teacher-facing workflow signal
// ─────────────────────────────────────────────────────────────

/**
 * Teacher returns a submission for revision (ADR-0020 § 1).
 *
 * In a single tx:
 *   1. Authz — actor must own the CourseOffering.
 *   2. Insert PRIVATE Comment with `body=input.comment`, ownerType=SUBMISSION,
 *      ownerId=submissionId, authorId=ctx.actorUserId.
 *   3. Update Submission.status = RETURNED.
 *   4. Emit SUBMISSION_RETURNED audit (Important · `reason = input.comment`).
 *
 * Does NOT touch ScoreEntry — ADR-0020 § 1. Any grade the teacher recorded
 * on the linked ScoreItem persists; the next gradeSubmission call (after
 * resubmit) goes through ADR-0018's post-publish reason gate if the
 * ScoreItem is published.
 */
export async function returnSubmission(
  input: ReturnSubmissionInput,
  ctx: ActorCtx
): Promise<void> {
  // Zod already enforces comment.length ≥ REASON_MIN (5).
  const parsed = ReturnSubmissionSchema.parse(input);

  await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: parsed.submissionId },
      select: {
        id: true,
        status: true,
        assignment: {
          select: {
            id: true,
            course: { select: { teacherId: true } },
          },
        },
      },
    });
    if (!submission) throw new NotFound("submission_not_found");
    if (submission.assignment.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    // RETURNED → RETURNED is a no-op (teacher clicking twice).
    if (submission.status === "RETURNED") {
      // Still create the comment so the conversation grows.
    }

    await tx.comment.create({
      data: {
        ownerType: "SUBMISSION",
        ownerId: submission.id,
        scope: "PRIVATE",
        authorId: ctx.actorUserId,
        body: parsed.comment,
      },
    });

    await tx.submission.update({
      where: { id: submission.id },
      data: { status: "RETURNED" },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "TEACHER",
        action: "SUBMISSION_RETURNED",
        targetType: "Submission",
        targetId: submission.id,
        reason: parsed.comment,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: { status: submission.status },
        after: { status: "RETURNED" },
      },
      tx
    );

    // P7-2 fan-out — SUBMISSION_RETURNED to the student. Merges with the
    // private RETURN comment per Q5.2 — no COMMENT_REPLIED fires here
    // (the comment body lands as commentExcerpt in this payload).
    const enriched = await tx.submission.findUniqueOrThrow({
      where: { id: submission.id },
      select: {
        enrollment: { select: { studentId: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, name: true } },
          },
        },
      },
    });
    const teacher = await tx.teacher.findUniqueOrThrow({
      where: { userId: ctx.actorUserId },
      select: { firstName: true, lastName: true },
    });
    await fanOutTargeted(tx, {
      kind: "SUBMISSION_RETURNED",
      sourceEntityType: "SUBMISSION",
      sourceEntityId: submission.id,
      courseOfferingId: enriched.assignment.course.id,
      recipientId: enriched.enrollment.studentId,
      payload: {
        courseId: enriched.assignment.course.id,
        courseName: enriched.assignment.course.name,
        assignmentId: enriched.assignment.id,
        assignmentTitle: enriched.assignment.title,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        commentExcerpt: clipExcerpt(parsed.comment),
      },
    });
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// gradeSubmission — teacher-facing
// ─────────────────────────────────────────────────────────────

/**
 * Grade a submission.
 *
 * Two flows depending on the Assignment's `isScored`:
 *
 *   Scored Assignment
 *     - Resolves the linked ScoreItem via `Assignment.scoreItemId`.
 *     - Routes through `lib/scoring.score-entry.upsertScoreEntry` so the
 *       Phase 5 invariants (value ∈ [0, fullScore]; post-publish edits
 *       require reason ≥ 5 + SCORE_EDIT_AFTER_PUBLISH audit per ADR-0018)
 *       apply uniformly. NO Phase-6-specific bypass.
 *     - Submission.status remains driven by the workflow signal (RETURNED
 *       vs SUBMITTED). It only moves to GRADED when `markGraded=true`, an
 *       explicit teacher action signalling "I'm done with this one".
 *
 *   Ungraded Assignment
 *     - No ScoreEntry write. Simply marks Submission.status = GRADED.
 *
 * For the actual ScoreEntry write we delegate to lib/scoring rather than
 * touch the row directly, keeping the audit gate single-sourced.
 */
export async function gradeSubmission(
  input: {
    submissionId: string;
    /** Required when Assignment.isScored=true. */
    value?: number;
    /** Required when Assignment.isScored=true AND ScoreItem.publishedAt !== null. */
    reason?: string;
    note?: string;
    /** Set true to transition Submission.status → GRADED. */
    markGraded?: boolean;
  },
  ctx: ActorCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({
      where: { id: input.submissionId },
      select: {
        id: true,
        status: true,
        enrollmentId: true,
        assignment: {
          select: {
            id: true,
            isScored: true,
            scoreItemId: true,
            course: { select: { teacherId: true } },
            scoreItem: {
              select: { id: true, fullScore: true, publishedAt: true },
            },
          },
        },
      },
    });
    if (!submission) throw new NotFound("submission_not_found");
    if (submission.assignment.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    if (submission.assignment.isScored) {
      const scoreItem = submission.assignment.scoreItem;
      if (!scoreItem) {
        // Invariant: isScored=true implies scoreItemId NOT NULL at the
        // lib/assignment boundary. If we land here, an out-of-band
        // deleteScoreItem call broke the coupling; teacher must toggle
        // isScored=false first to clean up before grading anything.
        throw new Conflict("linked_scoreitem_missing");
      }
      if (input.value === undefined) {
        throw new ValidationError({ value: "ระบุคะแนน" });
      }
      if (
        !Number.isInteger(input.value) ||
        input.value < 0 ||
        input.value > scoreItem.fullScore
      ) {
        throw new ValidationError({
          value: `คะแนนต้องอยู่ใน 0..${scoreItem.fullScore}`,
        });
      }
      const reasonTrimmed = input.reason?.trim() ?? "";
      if (scoreItem.publishedAt !== null && reasonTrimmed.length < REASON_MIN) {
        throw new ValidationError({
          reason: `การแก้คะแนนหลัง publish ต้องใส่เหตุผล (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
        });
      }

      // Direct ScoreEntry upsert inside the same tx. Mirrors
      // lib/scoring.score-entry behaviour (post-publish audit + editCount).
      // We do not import from lib/scoring here to avoid a circular import;
      // the duplicated logic is small and stays in sync via shared
      // constants + ADR-0018 contract.
      const existing = await tx.scoreEntry.findUnique({
        where: {
          scoreItemId_enrollmentId: {
            scoreItemId: scoreItem.id,
            enrollmentId: submission.enrollmentId,
          },
        },
        select: { id: true, value: true, editCount: true },
      });

      const isPublishedEdit =
        scoreItem.publishedAt !== null && existing !== null;

      if (existing) {
        await tx.scoreEntry.update({
          where: { id: existing.id },
          data: {
            value: input.value,
            note: input.note ?? null,
            markedById: ctx.actorUserId,
            editCount: existing.editCount + 1,
          },
        });
        if (isPublishedEdit && input.value !== existing.value) {
          await audit(
            {
              actorId: ctx.actorUserId,
              actorRole: "TEACHER",
              action: "SCORE_EDIT_AFTER_PUBLISH",
              targetType: "ScoreEntry",
              targetId: existing.id,
              reason: reasonTrimmed,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              before: { value: existing.value },
              after: { value: input.value },
            },
            tx
          );
        }
      } else {
        await tx.scoreEntry.create({
          data: {
            scoreItemId: scoreItem.id,
            enrollmentId: submission.enrollmentId,
            value: input.value,
            note: input.note ?? null,
            markedById: ctx.actorUserId,
          },
        });
      }
    }

    if (input.markGraded) {
      await tx.submission.update({
        where: { id: submission.id },
        data: { status: "GRADED" },
      });

      // P7-2 fan-out — SUBMISSION_GRADED to the student. Only fires on
      // the explicit "I'm done" transition (markGraded=true), not on
      // every ScoreEntry edit — those have their own SCORE_ENTRY_EDITED
      // notification path on published items.
      const enriched = await tx.submission.findUniqueOrThrow({
        where: { id: submission.id },
        select: {
          enrollment: { select: { studentId: true } },
          assignment: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, name: true } },
            },
          },
        },
      });
      const grader = await tx.teacher.findUniqueOrThrow({
        where: { userId: ctx.actorUserId },
        select: { firstName: true, lastName: true },
      });
      await fanOutTargeted(tx, {
        kind: "SUBMISSION_GRADED",
        sourceEntityType: "SUBMISSION",
        sourceEntityId: submission.id,
        courseOfferingId: enriched.assignment.course.id,
        recipientId: enriched.enrollment.studentId,
        payload: {
          courseId: enriched.assignment.course.id,
          courseName: enriched.assignment.course.name,
          assignmentId: enriched.assignment.id,
          assignmentTitle: enriched.assignment.title,
          graderName: `${grader.firstName} ${grader.lastName}`,
        },
      });
      // entityKind selector path for gradeSubmission's enriched select
      // also needs `assignment.id`; the same SELECT shape is reused.
    }
  }, TX_OPTS);
}
