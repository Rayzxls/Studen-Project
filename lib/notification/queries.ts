/**
 * Read-side notification queries — Phase 7 · P7-2
 *
 * The bell dropdown + dashboard pull from here. Both call `requireAuth`
 * at the route boundary; this layer takes the resolved recipient id
 * and runs the indexed query.
 *
 * Pattern 4 (DB-layer projection) is automatic — the snapshot
 * `payloadJson` IS the projection, so the bell never joins source
 * tables (ADR-0022 § 4).
 */

import type { NotificationKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export interface BellListItem {
  id: string;
  kind: NotificationKind;
  sourceEntityType: string;
  sourceEntityId: string;
  courseOfferingId: string | null;
  payloadJson: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}

const BELL_PAGE_SIZE = 20;

/**
 * List recent notifications for the bell dropdown.
 *
 * Includes BOTH read and unread per Q2.1 = A (bell shows all state,
 * badge count tracks only unread). Excludes suppressed rows always.
 */
export async function listNotificationsForRecipient(args: {
  recipientId: string;
  limit?: number;
  cursor?: { createdAt: Date; id: string };
}): Promise<{
  items: BellListItem[];
  nextCursor: { createdAt: Date; id: string } | null;
}> {
  const limit = args.limit ?? BELL_PAGE_SIZE;

  const items = await db.notification.findMany({
    where: {
      recipientId: args.recipientId,
      suppressedAt: null,
      ...(args.cursor && {
        OR: [
          { createdAt: { lt: args.cursor.createdAt } },
          {
            createdAt: args.cursor.createdAt,
            id: { lt: args.cursor.id },
          },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      kind: true,
      sourceEntityType: true,
      sourceEntityId: true,
      courseOfferingId: true,
      payloadJson: true,
      readAt: true,
      createdAt: true,
    },
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;

  return { items: page, nextCursor };
}

/**
 * Unread badge count. Excludes suppressed.
 *
 * Uses the (recipientId, readAt, createdAt DESC) index — `readAt IS
 * NULL` is the partial leading column.
 */
export async function countUnreadNotifications(
  recipientId: string
): Promise<number> {
  return db.notification.count({
    where: {
      recipientId,
      readAt: null,
      suppressedAt: null,
    },
  });
}

/**
 * Mark a single notification read. Returns true if the row was
 * affected (i.e. the recipient owns it and it was unread).
 *
 * The recipient-id predicate prevents one user from marking another
 * user's notifications — there is no "admin marks for student" use
 * case in Phase 7.
 */
export async function markNotificationRead(args: {
  notificationId: string;
  recipientId: string;
}): Promise<boolean> {
  const result = await db.notification.updateMany({
    where: {
      id: args.notificationId,
      recipientId: args.recipientId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Mark every unread notification for a recipient read. Q10.1 = A:
 * global scope across all courses — no per-course filter.
 */
export async function markAllNotificationsRead(
  recipientId: string
): Promise<number> {
  const result = await db.notification.updateMany({
    where: {
      recipientId,
      readAt: null,
      suppressedAt: null,
    },
    data: { readAt: new Date() },
  });
  return result.count;
}
