/**
 * Notification constants — Phase 7 · ADR-0022
 *
 * Pure module — no I/O. Co-locates the post-once kind set that gates
 * the partial unique index from `prisma/raw-sql/0001-notification-
 * partial-unique.sql`. If a kind moves between post-once and
 * repeatable, update BOTH this file AND the SQL file AND ADR-0022 § 3
 * in the same commit.
 */

import type { NotificationKind } from "@prisma/client";

/**
 * Kinds covered by the partial unique index. Insert via
 * `createMany({skipDuplicates: true})` to make double-submit a no-op.
 *
 * The complement (SCORE_ENTRY_EDITED, COMMENT_REPLIED) is intentionally
 * NOT in this set — those events are legitimately repeatable.
 */
export const POST_ONCE_KINDS: ReadonlySet<NotificationKind> = new Set([
  "SCORE_ITEM_PUBLISHED",
  "ASSIGNMENT_POSTED",
  "MATERIAL_POSTED",
  "ANNOUNCEMENT_POSTED",
  "SUBMISSION_GRADED",
  "SUBMISSION_RETURNED",
  "CLASS_CODE_JOINED",
]);

export function isPostOnceKind(kind: NotificationKind): boolean {
  return POST_ONCE_KINDS.has(kind);
}

/**
 * Max chars the bell preview surfaces from a free-text snapshot
 * (comment body, announcement excerpt). Strips longer payloads on
 * insert so the row stays compact and the bell dropdown does not need
 * to re-truncate on render.
 */
export const PAYLOAD_EXCERPT_MAX = 140;

export function clipExcerpt(s: string): string {
  if (s.length <= PAYLOAD_EXCERPT_MAX) return s;
  return s.slice(0, PAYLOAD_EXCERPT_MAX - 1) + "…";
}
