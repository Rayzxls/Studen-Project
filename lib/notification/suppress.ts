/**
 * Suppress + restore — Phase 7 · ADR-0022 § 5
 *
 * `suppressedAt` is the soft-hide flag that keeps the row in DB (audit
 * trace + un-suppress on restore) but excludes it from the bell. All
 * triggers run in-tx with the mutation that drives them.
 */

import type { NotifEntityType, Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Soft-hide every notification a recipient holds within a course.
 *
 * Called from `lib/course/enrollment.removeMember` inside the same tx
 * that flips `Enrollment.removedAt`. The composite index
 * (recipientId, courseOfferingId, suppressedAt) makes this a targeted
 * scan even at school scale.
 */
export async function suppressNotificationsForRemovedMember(
  tx: TxClient,
  args: { recipientId: string; courseOfferingId: string }
): Promise<number> {
  const result = await tx.notification.updateMany({
    where: {
      recipientId: args.recipientId,
      courseOfferingId: args.courseOfferingId,
      suppressedAt: null,
    },
    data: { suppressedAt: new Date() },
  });
  return result.count;
}

/**
 * Un-suppress every notification a recipient holds within a course.
 *
 * Called from `lib/course/enrollment.enrollByClassCode` in the
 * restore-by-rejoin branch (ADR-0013) inside the same tx that flips
 * `Enrollment.removedAt = null`. Restores ALL `suppressedAt IS NOT NULL`
 * rows for the (recipient × course) pair — see ADR-0022 § Consequences
 * "Restore-by-rejoin un-suppress is broad" for the rationale.
 */
export async function unsuppressNotificationsOnRestore(
  tx: TxClient,
  args: { recipientId: string; courseOfferingId: string }
): Promise<number> {
  const result = await tx.notification.updateMany({
    where: {
      recipientId: args.recipientId,
      courseOfferingId: args.courseOfferingId,
      suppressedAt: { not: null },
    },
    data: { suppressedAt: null },
  });
  return result.count;
}

/**
 * Cascade-suppress every notification that references a specific
 * source entity. Called from soft-delete sites — Material /
 * Announcement / ScoreItem — inside the same tx as the delete mutation.
 *
 * Comment soft-delete is the explicit exception (Q13.5) — notification
 * snapshots stay live; the placeholder "(ข้อความถูกลบ)" surfaces at
 * click-through. Do NOT call this from Comment delete sites.
 */
export async function suppressNotificationsForDeletedEntity(
  tx: TxClient,
  args: { sourceEntityType: NotifEntityType; sourceEntityId: string }
): Promise<number> {
  const result = await tx.notification.updateMany({
    where: {
      sourceEntityType: args.sourceEntityType,
      sourceEntityId: args.sourceEntityId,
      suppressedAt: null,
    },
    data: { suppressedAt: new Date() },
  });
  return result.count;
}
