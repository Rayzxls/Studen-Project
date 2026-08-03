/**
 * The single place that decides whether scheduled content has gone live
 * (ADR-0046).
 *
 * Visibility is a comparison against the clock, never a status a job flipped,
 * so a late or failed sweep can delay a notification but can never hide
 * coursework that was due to appear. Every read path a student can reach must
 * apply this — the feed, Due Soon, the Lesson workspace, detail routes — so it
 * lives in one function reviewers can read, in the same spirit as the
 * course-scope resolver.
 */

/** Who is looking. A teacher sees their own scheduled work; a class does not. */
export type PublishAudience = "STUDENT" | "AUTHOR";

/**
 * Prisma `where` clauses restricting a query to content that is live.
 *
 * Returned as an array meant for an `AND`, not as a fragment to spread beside
 * other keys: this condition is an `OR`, and so is keyset pagination, so two
 * sibling spreads would let the second silently replace the first and drop the
 * gate on every page after the first.
 *
 * Empty for the author, because filtering their own view would make a
 * scheduled item look like it failed to save.
 */
export function publishedWhere(
  audience: PublishAudience,
  now: Date = new Date()
): Array<{ OR: [{ publishAt: null }, { publishAt: { lte: Date } }] }> {
  if (audience === "AUTHOR") return [];
  return [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }];
}

/**
 * In-memory equivalent, for content already loaded — a Lesson projection, say,
 * where re-querying to answer the same question would be wasteful.
 */
export function isPublished(
  item: { publishAt: Date | null },
  now: Date = new Date()
): boolean {
  return item.publishAt === null || item.publishAt.getTime() <= now.getTime();
}

/**
 * True when the item is waiting for its moment. Used to badge the author's own
 * view; a student never sees one of these at all.
 */
export function isScheduled(
  item: { publishAt: Date | null },
  now: Date = new Date()
): boolean {
  return item.publishAt !== null && item.publishAt.getTime() > now.getTime();
}

/**
 * True while the author may still move the post's publish time.
 *
 * The window closes the moment the class can see it: pushing a live post back
 * into the future would take content away from students who already have it —
 * the unpublish this system does not have — and the sweep, having stamped
 * `notifiedAt` already, would never announce the second arrival.
 */
export function canReschedule(
  item: { publishAt: Date | null; notifiedAt: Date | null },
  now: Date = new Date()
): boolean {
  return item.notifiedAt === null && isScheduled(item, now);
}
