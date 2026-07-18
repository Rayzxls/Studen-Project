/**
 * ScoreItem mutations — Phase 5 · Phase 10 cutover (ADR-0024).
 *
 * All mutations follow Pattern 2 (authz inside `$transaction`) and
 * Pattern 3 (`TX_OPTS` on every transaction).
 *
 * Pre-publish CUD is unaudited (Verbose tier — same posture as Phase 4
 * TimetableSlot per Q11C). Post-publish edits fire the SCORE_* audit
 * family.
 *
 * ADR-0024 sum-based cutover removed:
 *   - The `weight` field and basis-points channel.
 *   - The Σ === WEIGHT_SUM_BP publish gate (publish has no Σ check now).
 *   - `validateWeights` (no callers; no invariant to enforce).
 *   - The `weight` member of ADR-0018 field-class B — class B narrows
 *     to `{fullScore}` only.
 */

import type { Prisma, ScoreItem, ScoreItemSource } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  fanOutBroadcast,
  suppressNotificationsForDeletedEntity,
} from "@/lib/notification";
import { NAME_MAX, REASON_MAX, REASON_MIN, TX_OPTS } from "./constants";

// ─────────────────────────────────────────────────────────────
// Field-class split — ADR-0018 § Decision 2 (B narrowed by ADR-0024)
// ─────────────────────────────────────────────────────────────

/** Patch shape for `updateScoreItem`. `publishedAt` is intentionally excluded — see ADR-0018. */
export interface UpdateScoreItemPatch {
  name?: string;
  position?: number;
  fullScore?: number;
  source?: ScoreItemSource;
}

/** Score-impacting fields per ADR-0018 Class B — post-publish edits require reason. */
const CLASS_B_FIELDS = ["fullScore"] as const;
/** Provenance fields per ADR-0018 Class C — immutable post-publish. */
const CLASS_C_FIELDS = ["source"] as const;

type FieldName = keyof UpdateScoreItemPatch;

// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────

export interface CreateScoreItemInput {
  courseOfferingId: string;
  name: string;
  fullScore: number;
  position?: number;
  source?: ScoreItemSource;
}

export interface ActorCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a new ScoreItem (always draft — `publishedAt = null`).
 *
 * Pre-publish creation is not audited (Verbose tier). The teacher can
 * freely add/remove draft items while building the gradebook.
 */
export async function createScoreItem(
  input: CreateScoreItemInput,
  ctx: ActorCtx
): Promise<ScoreItem> {
  if (input.source === "QUIZ_LINKED") {
    throw new Conflict("quiz_score_item_managed_by_quiz");
  }
  validateName(input.name);
  validateFullScore(input.fullScore);
  if (input.position !== undefined && !Number.isInteger(input.position)) {
    throw new ValidationError({ position: "ตำแหน่งต้องเป็นจำนวนเต็ม" });
  }

  return db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: input.courseOfferingId },
      select: { teacherId: true },
    });
    if (!course) throw new NotFound("course_not_found");
    if (course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    return tx.scoreItem.create({
      data: {
        courseOfferingId: input.courseOfferingId,
        name: input.name.trim(),
        fullScore: input.fullScore,
        source: input.source ?? "MANUAL",
        position: input.position ?? 0,
      },
    });
  }, TX_OPTS);
}

/**
 * Update a ScoreItem.
 *
 * Field-class dispatch (ADR-0018 § Decision 2 · ADR-0024 narrows class B):
 *   - Class A (`name`, `position`) → always free, no audit.
 *   - Class B (`fullScore`) → if published, require `reason ≥ 5`;
 *     emit `SCORE_EDIT_AFTER_PUBLISH` (Important).
 *   - Class C (`source`) → if published, throw `field_immutable_after_publish`.
 *
 * Additional cross-cutting rule for published items:
 *   - `fullScore` shrink → reject if any existing `ScoreEntry.value` exceeds
 *     the new cap (`entries_exceed_new_full_score`).
 */
export async function updateScoreItem(
  scoreItemId: string,
  patch: UpdateScoreItemPatch,
  ctx: ActorCtx & { reason?: string | null }
): Promise<ScoreItem> {
  if (patch.source === "QUIZ_LINKED") {
    throw new Conflict("quiz_score_item_managed_by_quiz");
  }
  const reasonTrimmed = ctx.reason?.trim() ?? "";
  if (reasonTrimmed.length > REASON_MAX) {
    throw new ValidationError({
      reason: `เหตุผลยาวเกินไป (ไม่เกิน ${REASON_MAX} ตัวอักษร)`,
    });
  }

  if (patch.name !== undefined) validateName(patch.name);
  if (patch.fullScore !== undefined) validateFullScore(patch.fullScore);
  if (patch.position !== undefined && !Number.isInteger(patch.position)) {
    throw new ValidationError({ position: "ตำแหน่งต้องเป็นจำนวนเต็ม" });
  }

  return db.$transaction(async (tx) => {
    const current = await tx.scoreItem.findUnique({
      where: { id: scoreItemId },
      select: {
        id: true,
        courseOfferingId: true,
        name: true,
        fullScore: true,
        source: true,
        position: true,
        publishedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("score_item_not_found");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    // Compute which classes of fields are being changed.
    const changed: FieldName[] = [];
    for (const [k, v] of Object.entries(patch) as [FieldName, unknown][]) {
      if (v === undefined) continue;
      const currentValue = current[k as keyof typeof current];
      if (k === "name" && typeof v === "string") {
        if (v.trim() !== currentValue) changed.push(k);
      } else if (v !== currentValue) {
        changed.push(k);
      }
    }

    if (changed.length === 0) {
      // No-op — return current row.
      return tx.scoreItem.findUniqueOrThrow({ where: { id: scoreItemId } });
    }

    const isPublished = current.publishedAt !== null;
    const classBChanged = changed.some((k) =>
      (CLASS_B_FIELDS as readonly string[]).includes(k)
    );
    const classCChanged = changed.some((k) =>
      (CLASS_C_FIELDS as readonly string[]).includes(k)
    );

    if (isPublished) {
      if (classCChanged) {
        throw new Forbidden("field_immutable_after_publish");
      }
      if (classBChanged && reasonTrimmed.length < REASON_MIN) {
        throw new ValidationError({
          reason: `การแก้ไขหลัง publish ต้องใส่เหตุผล (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
        });
      }
    }

    // Class B fullScore shrink: reject if any entry would now exceed it.
    if (patch.fullScore !== undefined && patch.fullScore < current.fullScore) {
      const maxEntry = await tx.scoreEntry.aggregate({
        where: { scoreItemId },
        _max: { value: true },
      });
      if (
        maxEntry._max.value !== null &&
        maxEntry._max.value > patch.fullScore
      ) {
        throw new ValidationError({
          fullScore: `มีคะแนนที่กรอกไว้แล้วเกิน ${patch.fullScore} — แก้คะแนนนักเรียนก่อนค่อยลดคะแนนเต็ม`,
        });
      }
    }

    // Build typed update data — exclude undefined fields.
    const data: Prisma.ScoreItemUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.position !== undefined) data.position = patch.position;
    if (patch.fullScore !== undefined) data.fullScore = patch.fullScore;
    if (patch.source !== undefined && !isPublished) data.source = patch.source;

    const updated = await tx.scoreItem.update({
      where: { id: scoreItemId },
      data,
    });

    if (isPublished && classBChanged) {
      await audit(
        {
          actorId: ctx.actorUserId,
          actorRole: "TEACHER",
          action: "SCORE_EDIT_AFTER_PUBLISH",
          targetType: "ScoreItem",
          targetId: scoreItemId,
          reason: reasonTrimmed,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          before: { fullScore: current.fullScore },
          after: { fullScore: updated.fullScore },
        },
        tx
      );
    }

    return updated;
  }, TX_OPTS);
}

/**
 * Publish a ScoreItem.
 *
 * Gates (ADR-0018):
 *   - Already published → `already_published` (one-way per ADR-0018, no
 *     idempotent republish).
 *
 * Per ADR-0024 there is no Σ-weight precondition anymore — sum-based
 * scoring has no aggregate invariant to enforce.
 *
 * Sets `publishedAt = now` and emits `SCORE_ITEM_PUBLISHED` (Important).
 */
export async function publishScoreItem(
  scoreItemId: string,
  ctx: ActorCtx
): Promise<ScoreItem> {
  return db.$transaction(async (tx) => {
    const current = await tx.scoreItem.findUnique({
      where: { id: scoreItemId },
      select: {
        id: true,
        courseOfferingId: true,
        name: true,
        fullScore: true,
        source: true,
        publishedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("score_item_not_found");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    if (current.publishedAt !== null) {
      throw new Conflict("already_published");
    }
    if (current.source === "QUIZ_LINKED") {
      throw new Conflict("quiz_results_must_publish_from_quiz");
    }

    const updated = await tx.scoreItem.update({
      where: { id: scoreItemId },
      data: { publishedAt: new Date() },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "TEACHER",
        action: "SCORE_ITEM_PUBLISHED",
        targetType: "ScoreItem",
        targetId: scoreItemId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        after: {
          name: current.name,
          fullScore: current.fullScore,
          publishedAt: updated.publishedAt?.toISOString() ?? null,
        },
      },
      tx
    );

    // P7-2 fan-out — broadcast to active enrollment (ADR-0022 § 1 + § 8
    // snapshot-at-publish-time semantics).
    const course = await tx.courseOffering.findUniqueOrThrow({
      where: { id: current.courseOfferingId },
      select: { name: true },
    });
    await fanOutBroadcast(tx, {
      kind: "SCORE_ITEM_PUBLISHED",
      sourceEntityType: "SCORE_ITEM",
      sourceEntityId: scoreItemId,
      courseOfferingId: current.courseOfferingId,
      payload: {
        courseId: current.courseOfferingId,
        courseName: course.name,
        itemName: current.name,
        publishedAt:
          updated.publishedAt?.toISOString() ?? new Date().toISOString(),
      },
    });

    return updated;
  }, TX_OPTS);
}

/**
 * Delete a ScoreItem (and cascade its ScoreEntries within the same tx).
 *
 * Pre-publish: free delete, no reason, no audit.
 * Post-publish: `reason ≥ 5` required → emits `SCORE_DELETE_AFTER_PUBLISH`
 *               (Critical tier per ADR-0018).
 *
 * Note: schema has `ScoreEntry.onDelete: Restrict` to protect against
 * accidental cascades from CourseOffering removal. Explicit per-row
 * deletion here is the sanctioned path.
 */
export async function deleteScoreItem(
  scoreItemId: string,
  ctx: ActorCtx & { reason?: string | null }
): Promise<void> {
  const reasonTrimmed = ctx.reason?.trim() ?? "";
  if (reasonTrimmed.length > REASON_MAX) {
    throw new ValidationError({
      reason: `เหตุผลยาวเกินไป (ไม่เกิน ${REASON_MAX} ตัวอักษร)`,
    });
  }

  await db.$transaction(async (tx) => {
    const current = await tx.scoreItem.findUnique({
      where: { id: scoreItemId },
      select: {
        id: true,
        courseOfferingId: true,
        name: true,
        fullScore: true,
        publishedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("score_item_not_found");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const isPublished = current.publishedAt !== null;
    if (isPublished && reasonTrimmed.length < REASON_MIN) {
      throw new ValidationError({
        reason: `การลบหลัง publish ต้องใส่เหตุผล (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
      });
    }

    // Explicit cascade — bypass onDelete:Restrict (which is a safety net
    // against unintended CourseOffering-driven cascades).
    await tx.scoreEntry.deleteMany({ where: { scoreItemId } });
    await tx.scoreItem.delete({ where: { id: scoreItemId } });

    if (isPublished) {
      await audit(
        {
          actorId: ctx.actorUserId,
          actorRole: "TEACHER",
          action: "SCORE_DELETE_AFTER_PUBLISH",
          targetType: "ScoreItem",
          targetId: scoreItemId,
          reason: reasonTrimmed,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          before: {
            name: current.name,
            fullScore: current.fullScore,
            publishedAt: current.publishedAt?.toISOString() ?? null,
          },
        },
        tx
      );
    }

    // P7-2 cascade — suppress notifications that reference this ScoreItem
    // (kind SCORE_ITEM_PUBLISHED + SCORE_ENTRY_EDITED both ref SCORE_ITEM).
    // ADR-0022 § 5 + Q13.3 lock.
    await suppressNotificationsForDeletedEntity(tx, {
      sourceEntityType: "SCORE_ITEM",
      sourceEntityId: scoreItemId,
    });
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// Local field validators (PURE — throw on bad input)
// ─────────────────────────────────────────────────────────────

function validateName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError({ name: "ระบุชื่อรายการคะแนน" });
  }
  if (trimmed.length > NAME_MAX) {
    throw new ValidationError({
      name: `ชื่อยาวเกินไป (ไม่เกิน ${NAME_MAX} ตัวอักษร)`,
    });
  }
}

function validateFullScore(fullScore: number): void {
  if (!Number.isInteger(fullScore) || fullScore <= 0) {
    throw new ValidationError({
      fullScore: "คะแนนเต็มต้องเป็นจำนวนเต็มบวก",
    });
  }
}
