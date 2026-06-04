/**
 * Notification fan-out helpers — Phase 7 · ADR-0022 § 1 + § 2
 *
 * Every helper takes a `Prisma.TransactionClient` (`tx`) — fan-out is
 * always in-tx with the originating mutation per ADR-0022 § 2
 * (Pattern 2 extended). Calling these outside a $transaction is
 * supported (pass `db` as tx) but loses the atomicity guarantee — only
 * do this if the originating mutation is itself outside a tx.
 *
 * Recipient list is snapshot at fan-out time (ADR-0022 § 8) — a
 * student who joins after fan-out does not retroactively receive
 * broadcast notifications; they see the entity on its content-type
 * tab.
 */

import type { NotifEntityType, NotificationKind, Prisma } from "@prisma/client";
import type { NotificationPayload } from "./types";

type TxClient = Prisma.TransactionClient;

interface FanOutCommon {
  kind: NotificationKind;
  sourceEntityType: NotifEntityType;
  sourceEntityId: string;
  courseOfferingId: string | null;
  payload: NotificationPayload["data"];
}

/**
 * Broadcast to every active enrollment in a CourseOffering.
 *
 * Used by: SCORE_ITEM_PUBLISHED · ASSIGNMENT_POSTED · MATERIAL_POSTED ·
 *          ANNOUNCEMENT_POSTED.
 *
 * `skipDuplicates: true` honours the partial unique index from
 * `prisma/raw-sql/0001-notification-partial-unique.sql` — a server-
 * action double-submit re-runs the fan-out without writing a second
 * row per recipient.
 */
export async function fanOutBroadcast(
  tx: TxClient,
  args: FanOutCommon & { courseOfferingId: string }
): Promise<number> {
  const recipients = await tx.enrollment.findMany({
    where: {
      courseOfferingId: args.courseOfferingId,
      removedAt: null,
    },
    select: { studentId: true },
  });
  if (recipients.length === 0) return 0;

  const result = await tx.notification.createMany({
    data: recipients.map((r) => ({
      recipientId: r.studentId,
      kind: args.kind,
      sourceEntityType: args.sourceEntityType,
      sourceEntityId: args.sourceEntityId,
      courseOfferingId: args.courseOfferingId,
      payloadJson: args.payload as unknown as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Single-recipient fan-out.
 *
 * Used by: SCORE_ENTRY_EDITED (1 per affected student per batch) ·
 *          SUBMISSION_GRADED · SUBMISSION_RETURNED · CLASS_CODE_JOINED.
 *
 * Post-once kinds use createMany with skipDuplicates to honour the
 * partial unique index. Repeatable kinds (SCORE_ENTRY_EDITED) use the
 * same path — the index simply does not catch them, so the row always
 * inserts.
 */
export async function fanOutTargeted(
  tx: TxClient,
  args: FanOutCommon & { recipientId: string }
): Promise<boolean> {
  const result = await tx.notification.createMany({
    data: [
      {
        recipientId: args.recipientId,
        kind: args.kind,
        sourceEntityType: args.sourceEntityType,
        sourceEntityId: args.sourceEntityId,
        courseOfferingId: args.courseOfferingId,
        payloadJson: args.payload as unknown as Prisma.InputJsonValue,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}

/**
 * Multi-recipient fan-out for value-change-driven kinds.
 *
 * Used by: SCORE_ENTRY_EDITED bulk save (Q6 lock — 1 row per affected
 * student per batch).
 *
 * Skips the partial unique index because SCORE_ENTRY_EDITED is
 * repeatable (a teacher who bulk-edits the same item twice in a term
 * must notify both times).
 */
export async function fanOutTargetedMany(
  tx: TxClient,
  args: FanOutCommon & { recipientIds: readonly string[] }
): Promise<number> {
  if (args.recipientIds.length === 0) return 0;
  const result = await tx.notification.createMany({
    data: args.recipientIds.map((rid) => ({
      recipientId: rid,
      kind: args.kind,
      sourceEntityType: args.sourceEntityType,
      sourceEntityId: args.sourceEntityId,
      courseOfferingId: args.courseOfferingId,
      payloadJson: args.payload as unknown as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Thread fan-out — DISTINCT comment authors ∪ entity author − self.
 *
 * Used by: COMMENT_REPLIED.
 *
 * Caller passes the comment scope (ownerType + ownerId) + the entity
 * author + the self id. We resolve prior thread participants from the
 * Comment table inside the same tx so a comment that just arrived in
 * the originating mutation is already visible.
 *
 * PRIVATE comments under Submission collapse to "the other party":
 * the caller should pre-resolve and use `fanOutTargeted` instead —
 * thread-resolution overhead is wasted for the 2-actor case.
 */
export async function fanOutThread(
  tx: TxClient,
  args: FanOutCommon & {
    entityOwnerType: "ASSIGNMENT" | "MATERIAL" | "ANNOUNCEMENT";
    entityOwnerId: string;
    entityAuthorId: string | null; // null when the entity has no single author (rare)
    selfId: string;
  }
): Promise<number> {
  // Resolve prior commenters in this thread.
  const priorComments = await tx.comment.findMany({
    where: {
      ownerType: args.entityOwnerType,
      ownerId: args.entityOwnerId,
      deletedAt: null,
    },
    select: { authorId: true },
    distinct: ["authorId"],
  });

  const recipients = new Set<string>();
  for (const c of priorComments) recipients.add(c.authorId);
  if (args.entityAuthorId) recipients.add(args.entityAuthorId);
  recipients.delete(args.selfId);

  if (recipients.size === 0) return 0;

  const result = await tx.notification.createMany({
    data: Array.from(recipients).map((rid) => ({
      recipientId: rid,
      kind: args.kind,
      sourceEntityType: args.sourceEntityType,
      sourceEntityId: args.sourceEntityId,
      courseOfferingId: args.courseOfferingId,
      payloadJson: args.payload as unknown as Prisma.InputJsonValue,
    })),
    // COMMENT_REPLIED is repeatable — index does not cover, so this is
    // a true append. `skipDuplicates` is harmless given the predicate.
    skipDuplicates: true,
  });
  return result.count;
}
