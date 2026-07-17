/**
 * Assignment mutations — Phase 6 · ADR-0019
 *
 * Every mutation follows Pattern 2 (authz inside `$transaction`) and
 * Pattern 3 (`TX_OPTS` on every transaction). The ScoreItem coupling for
 * `isScored=true` materialises in the same tx as the Assignment row
 * (ADR-0019 § 1 — schema never carries
 * "isScored=true AND scoreItemId IS NULL" at the lib boundary).
 *
 * Pre-publish CUD on a linked ScoreItem stays Verbose-tier (no audit) —
 * same posture as Phase 5 score-item.ts. The `isScored: true → false`
 * toggle on a draft-with-zero-entries ScoreItem deletes the ScoreItem
 * inside the same tx, also Verbose.
 */

import type { Assignment, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { fanOutBroadcast } from "@/lib/notification";
import { TX_OPTS } from "./constants";
import { assertLinkableLesson } from "@/lib/lesson/linking";
import {
  CreateAssignmentSchema,
  type CreateAssignmentInput,
  UpdateAssignmentSchema,
  type UpdateAssignmentInput,
} from "./validation";

// ─────────────────────────────────────────────────────────────
// Actor context — mirrors lib/scoring/score-item.ts shape
// ─────────────────────────────────────────────────────────────

export interface ActorCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────
// createAssignment — ADR-0019 § 1
// ─────────────────────────────────────────────────────────────

/**
 * Create a new Assignment. When `isScored=true`, atomically create a
 * linked `ScoreItem` (`source = ASSIGNMENT_LINKED`) in the same tx and
 * wire `Assignment.scoreItemId` to it. The dialog collected `fullScore`
 * (ADR-0024 — no more `weight` channel); this function trusts the
 * Zod-validated value.
 *
 * Pre-publish — no audit (Verbose tier, same posture as Phase 5).
 */
export async function createAssignment(
  input: CreateAssignmentInput,
  ctx: ActorCtx
): Promise<Assignment> {
  // Zod refine already enforces:
  //   - title non-empty + ≤ TITLE_MAX
  //   - description ≤ DESCRIPTION_MAX
  //   - at least one allowText/File/Link
  //   - when isScored=true: fullScore ≥ 1
  const parsed = CreateAssignmentSchema.parse(input);

  return db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: parsed.courseOfferingId },
      select: { teacherId: true },
    });
    if (!course) throw new NotFound("course_not_found");
    if (course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    await assertLinkableLesson(tx, {
      lessonId: parsed.lessonId,
      courseOfferingId: parsed.courseOfferingId,
    });

    // Materialise the Assignment with scoreItemId=null first.
    const assignmentId = parsed.id;
    if (parsed.fileAttachmentIds.length > 0 && !assignmentId) {
      throw new ValidationError({
        fileAttachmentIds: "missing_attachment_owner_id",
      });
    }
    if (parsed.fileAttachmentIds.length > 0 && assignmentId) {
      await assertOwnedFiles(tx, {
        ownerType: "ASSIGNMENT",
        ownerId: assignmentId,
        uploadedById: ctx.actorUserId,
        fileAttachmentIds: parsed.fileAttachmentIds,
      });
    }

    const assignment = await tx.assignment.create({
      data: {
        ...(assignmentId && { id: assignmentId }),
        courseOfferingId: parsed.courseOfferingId,
        lessonId: parsed.lessonId ?? null,
        title: parsed.title,
        description: parsed.description,
        dueAt: parsed.dueAt ?? null,
        allowText: parsed.allowText,
        allowFile: parsed.allowFile,
        allowLink: parsed.allowLink,
        submissionClosed: parsed.submissionClosed,
        autoCloseAtDue: parsed.autoCloseAtDue,
        isScored: parsed.isScored,
        linkUrls: parsed.linkUrls as Prisma.InputJsonValue,
        fileAttachmentIds: parsed.fileAttachmentIds as Prisma.InputJsonValue,
        createdById: ctx.actorUserId,
      },
    });

    let result: Assignment = assignment;
    if (parsed.isScored) {
      // ADR-0019 § 1 — atomic coupling.
      const scoreItem = await tx.scoreItem.create({
        data: {
          courseOfferingId: parsed.courseOfferingId,
          name: parsed.title,
          fullScore: parsed.fullScore!,
          source: "ASSIGNMENT_LINKED",
        },
      });
      result = await tx.assignment.update({
        where: { id: assignment.id },
        data: { scoreItemId: scoreItem.id },
      });
    }

    // P7-2 fan-out — ASSIGNMENT_POSTED broadcast (ADR-0022 § 1).
    const courseRow = await tx.courseOffering.findUniqueOrThrow({
      where: { id: parsed.courseOfferingId },
      select: { name: true },
    });
    await fanOutBroadcast(tx, {
      kind: "ASSIGNMENT_POSTED",
      sourceEntityType: "ASSIGNMENT",
      sourceEntityId: assignment.id,
      courseOfferingId: parsed.courseOfferingId,
      payload: {
        courseId: parsed.courseOfferingId,
        courseName: courseRow.name,
        lessonId: parsed.lessonId ?? null,
        assignmentTitle: parsed.title,
        dueAt: parsed.dueAt?.toISOString() ?? null,
      },
    });

    return result;
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// updateAssignment — ADR-0019 § 5 toggle dispatch
// ─────────────────────────────────────────────────────────────

/**
 * Update an Assignment.
 *
 * The interesting case is the `isScored` toggle:
 *
 *   false → true (couple)
 *     - Requires `fullScore` in patch (Zod cannot enforce conditional
 *       cross-field rules on a partial patch; the lib layer does it).
 *     - Creates a new ScoreItem (`source=ASSIGNMENT_LINKED`) and wires
 *       `scoreItemId` in the same tx (mirrors `createAssignment` § 1).
 *
 *   true → false (decouple), branching on linked ScoreItem state:
 *     - Draft + 0 entries          → atomic delete + null FK (Verbose, no audit)
 *     - Draft + N>0 entries        → `assignment_has_scored_entries`
 *     - Published                  → `linked_scoreitem_published` (escape via
 *                                    `deleteScoreItem` Critical-tier audit)
 *
 * Non-toggle field edits (title, description, dueAt, allow*, *Closed*)
 * are free at the Assignment layer. If the linked ScoreItem is published,
 * the ScoreItem-side rename is independent — class A per ADR-0018 — and
 * not synced here (drift is acceptable per ADR-0019 § Negative).
 */
export async function updateAssignment(
  assignmentId: string,
  patch: UpdateAssignmentInput,
  ctx: ActorCtx
): Promise<Assignment> {
  const parsed = UpdateAssignmentSchema.parse(patch);

  return db.$transaction(async (tx) => {
    const current = await tx.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        courseOfferingId: true,
        lessonId: true,
        isScored: true,
        scoreItemId: true,
        course: { select: { teacherId: true } },
        scoreItem: {
          select: {
            id: true,
            publishedAt: true,
            _count: { select: { entries: true } },
          },
        },
      },
    });
    if (!current) throw new NotFound("assignment_not_found");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    if (parsed.lessonId !== undefined) {
      await assertLinkableLesson(tx, {
        lessonId: parsed.lessonId,
        courseOfferingId: current.courseOfferingId,
      });
    }

    const toggleOn = parsed.isScored === true && current.isScored === false;
    const toggleOff = parsed.isScored === false && current.isScored === true;

    // Toggle ON — require fullScore in patch, create ScoreItem.
    if (toggleOn) {
      if (parsed.fullScore === undefined) {
        throw new ValidationError({
          fullScore: "ระบุคะแนนเต็ม (ADR-0019)",
        });
      }
      const scoreItem = await tx.scoreItem.create({
        data: {
          courseOfferingId: current.courseOfferingId,
          name: parsed.title ?? (await readTitle(tx, assignmentId)),
          fullScore: parsed.fullScore,
          source: "ASSIGNMENT_LINKED",
        },
      });
      return tx.assignment.update({
        where: { id: assignmentId },
        data: {
          ...buildPlainFieldsPatch(parsed),
          isScored: true,
          scoreItemId: scoreItem.id,
        },
      });
    }

    // Toggle OFF — 3-state branch on linked ScoreItem.
    if (toggleOff) {
      if (!current.scoreItem) {
        // No linked ScoreItem (already in a clean-up state from a prior
        // deleteScoreItem call) — just flip the flag.
        return tx.assignment.update({
          where: { id: assignmentId },
          data: {
            ...buildPlainFieldsPatch(parsed),
            isScored: false,
            scoreItemId: null,
          },
        });
      }
      if (current.scoreItem.publishedAt !== null) {
        throw new Conflict("linked_scoreitem_published");
      }
      if (current.scoreItem._count.entries > 0) {
        throw new Conflict("assignment_has_scored_entries");
      }
      // Draft + 0 entries → atomic delete. Order: null FK first (Restrict on
      // ScoreEntry.scoreItem side is irrelevant here because count is 0; the
      // Assignment FK uses SetNull but explicit-null is safer than relying
      // on the cascade for invariant clarity).
      const updated = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          ...buildPlainFieldsPatch(parsed),
          isScored: false,
          scoreItemId: null,
        },
      });
      await tx.scoreItem.delete({ where: { id: current.scoreItem.id } });
      return updated;
    }

    // Non-toggle update — reject fullScore in patch (it only accompanies a
    // toggle ON; updating the linked ScoreItem's fullScore goes through
    // lib/scoring.updateScoreItem with class-B reason gate per ADR-0018).
    if (parsed.fullScore !== undefined) {
      throw new ValidationError({
        fullScore:
          "แก้ fullScore ของรายการคะแนนผ่าน lib/scoring.updateScoreItem",
      });
    }

    return tx.assignment.update({
      where: { id: assignmentId },
      data: buildPlainFieldsPatch(parsed),
    });
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// deleteAssignment
// ─────────────────────────────────────────────────────────────

/**
 * Delete an Assignment (and its Submissions / SubmissionVersions via the
 * `onDelete: Cascade` on the Submission FK).
 *
 * If a linked ScoreItem is published, block — same logic as the toggle off
 * Published case. Teacher's escape is `deleteScoreItem` (Critical-tier
 * audit per ADR-0018), which sets `Assignment.scoreItemId=null` via the
 * SetNull FK; then `deleteAssignment` succeeds.
 *
 * Pre-publish — Verbose tier (no audit). Same posture as Phase 5 draft
 * ScoreItem CUD.
 */
export async function deleteAssignment(
  assignmentId: string,
  ctx: ActorCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        scoreItemId: true,
        course: { select: { teacherId: true } },
        scoreItem: {
          select: {
            id: true,
            publishedAt: true,
            _count: { select: { entries: true } },
          },
        },
      },
    });
    if (!current) throw new NotFound("assignment_not_found");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    if (current.scoreItem) {
      if (current.scoreItem.publishedAt !== null) {
        throw new Conflict("linked_scoreitem_published");
      }
      if (current.scoreItem._count.entries > 0) {
        throw new Conflict("assignment_has_scored_entries");
      }
      // Draft + 0 entries — null FK first, then delete ScoreItem.
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { scoreItemId: null, isScored: false },
      });
      await tx.scoreItem.delete({ where: { id: current.scoreItem.id } });
    }

    // Submission + SubmissionVersion cascade via schema FK (onDelete: Cascade
    // on Submission.assignment). FileAttachment rows persist — they are
    // polymorphic and not FK-linked; lib/storage handles orphan cleanup.
    await tx.assignment.delete({ where: { id: assignmentId } });
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Read the current Assignment title — used by `updateAssignment` toggle-ON
 * path when the patch does not include a new title (the auto-created
 * ScoreItem should be named after the Assignment per ADR-0019 § 3).
 */
async function readTitle(
  tx: Prisma.TransactionClient,
  assignmentId: string
): Promise<string> {
  const row = await tx.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { title: true },
  });
  return row.title;
}

/**
 * Build the Prisma `UpdateInput` for the non-coupling fields. Excludes
 * `isScored`, `fullScore`, `scoreItemId` — those are handled by
 * the toggle dispatch in the caller.
 */
function buildPlainFieldsPatch(
  parsed: UpdateAssignmentInput
): Prisma.AssignmentUncheckedUpdateInput {
  const data: Prisma.AssignmentUncheckedUpdateInput = {};
  if (parsed.lessonId !== undefined) data.lessonId = parsed.lessonId;
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.dueAt !== undefined) data.dueAt = parsed.dueAt;
  if (parsed.allowText !== undefined) data.allowText = parsed.allowText;
  if (parsed.allowFile !== undefined) data.allowFile = parsed.allowFile;
  if (parsed.allowLink !== undefined) data.allowLink = parsed.allowLink;
  if (parsed.fileAttachmentIds !== undefined) {
    data.fileAttachmentIds = parsed.fileAttachmentIds as Prisma.InputJsonValue;
  }
  if (parsed.submissionClosed !== undefined) {
    data.submissionClosed = parsed.submissionClosed;
  }
  if (parsed.autoCloseAtDue !== undefined) {
    data.autoCloseAtDue = parsed.autoCloseAtDue;
  }
  return data;
}

async function assertOwnedFiles(
  tx: Prisma.TransactionClient,
  args: {
    ownerType: "ASSIGNMENT";
    ownerId: string;
    uploadedById: string;
    fileAttachmentIds: string[];
  }
): Promise<void> {
  const rows = await tx.fileAttachment.findMany({
    where: {
      id: { in: args.fileAttachmentIds },
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      uploadedById: args.uploadedById,
      deletedAt: null,
    },
    select: { id: true },
  });
  const found = new Set(rows.map((r) => r.id));
  const missing = args.fileAttachmentIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ValidationError({
      fileAttachmentIds: `file_not_owned_by_assignment — ${missing.join(",")}`,
    });
  }
}
