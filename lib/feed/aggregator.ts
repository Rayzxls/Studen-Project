/**
 * User Feed aggregator — Phase 7 · ADR-0023
 *
 * Multi-query union at the application layer:
 *   - Assignment + Material + Announcement + ScoreItem(published)
 *   - 4 Prisma findMany in Promise.all
 *   - Merge + sort + slice 20 in JS
 *
 * Privacy posture (Pattern 4 + ADR-0023 § 2): every `select` lists
 * only L1-safe fields. ScoreItem branch never returns weight / entries
 * — feed surfaces "Item X is now visible", scores tab handles the
 * actual numbers.
 *
 * Cursor pagination: composite `(sortAt DESC, id DESC)`. Over-fetch
 * per source = 20, merged + sliced down to 20. Worst case ~80 rows
 * pulled across 4 Promise.all queries.
 */

import { db } from "@/lib/db/client";
import type { Session } from "@/lib/auth/permissions";
import { getCourseScopeForUser } from "./scope";

export type FeedKind =
  | "ASSIGNMENT"
  | "MATERIAL"
  | "ANNOUNCEMENT"
  | "SCORE_PUBLISHED";

export interface FeedItem {
  kind: FeedKind;
  id: string;
  courseOfferingId: string;
  sortAt: Date;
  /** Display title — Assignment.title, Material.title, Announcement.title (nullable), ScoreItem.name. */
  title: string | null;
  /** Optional second-line detail — Assignment.dueAt ISO string, etc. */
  detail?: string | null;
}

export interface FeedCursor {
  sortAt: Date;
  id: string;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
}

const PAGE_SIZE = 20;

export async function getUserFeed(
  session: Session,
  cursor?: FeedCursor
): Promise<FeedPage> {
  const { courseIds } = await getCourseScopeForUser(session);
  if (courseIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  // The composite cursor: (sortAt, id). For descending order, the next
  // page returns rows STRICTLY before the cursor — `sortAt < cursor.sortAt`
  // OR (`sortAt == cursor.sortAt` AND `id < cursor.id`).
  const cursorPredicate = cursor
    ? {
        OR: [
          { sortAt: { lt: cursor.sortAt } },
          { sortAt: cursor.sortAt, id: { lt: cursor.id } },
        ],
      }
    : undefined;
  void cursorPredicate; // Each branch composes its own; this is documentation.

  const courseInFilter = { in: courseIds };

  const [assignments, materials, announcements, scoreItems] = await Promise.all(
    [
      db.assignment.findMany({
        where: {
          courseOfferingId: courseInFilter,
          ...(cursor && {
            OR: [
              { createdAt: { lt: cursor.sortAt } },
              { createdAt: cursor.sortAt, id: { lt: cursor.id } },
            ],
          }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE,
        select: {
          id: true,
          courseOfferingId: true,
          title: true,
          dueAt: true,
          createdAt: true,
        },
      }),
      db.material.findMany({
        where: {
          courseOfferingId: courseInFilter,
          deletedAt: null,
          ...(cursor && {
            OR: [
              { postedAt: { lt: cursor.sortAt } },
              { postedAt: cursor.sortAt, id: { lt: cursor.id } },
            ],
          }),
        },
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE,
        select: {
          id: true,
          courseOfferingId: true,
          title: true,
          postedAt: true,
        },
      }),
      db.announcement.findMany({
        where: {
          courseOfferingId: courseInFilter,
          deletedAt: null,
          ...(cursor && {
            OR: [
              { postedAt: { lt: cursor.sortAt } },
              { postedAt: cursor.sortAt, id: { lt: cursor.id } },
            ],
          }),
        },
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE,
        select: {
          id: true,
          courseOfferingId: true,
          title: true,
          postedAt: true,
        },
      }),
      db.scoreItem.findMany({
        where: {
          courseOfferingId: courseInFilter,
          publishedAt: { not: null },
          ...(cursor && {
            OR: [
              { publishedAt: { lt: cursor.sortAt } },
              { publishedAt: cursor.sortAt, id: { lt: cursor.id } },
            ],
          }),
        },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE,
        // Strict L1: no weight, no fullScore, no entries — those are
        // Scores-tab concerns. Feed only surfaces "this item is live".
        select: {
          id: true,
          courseOfferingId: true,
          name: true,
          publishedAt: true,
        },
      }),
    ]
  );

  const merged: FeedItem[] = [
    ...assignments.map(
      (a): FeedItem => ({
        kind: "ASSIGNMENT",
        id: a.id,
        courseOfferingId: a.courseOfferingId,
        sortAt: a.createdAt,
        title: a.title,
        detail: a.dueAt ? a.dueAt.toISOString() : null,
      })
    ),
    ...materials.map(
      (m): FeedItem => ({
        kind: "MATERIAL",
        id: m.id,
        courseOfferingId: m.courseOfferingId,
        sortAt: m.postedAt,
        title: m.title,
      })
    ),
    ...announcements.map(
      (an): FeedItem => ({
        kind: "ANNOUNCEMENT",
        id: an.id,
        courseOfferingId: an.courseOfferingId,
        sortAt: an.postedAt,
        title: an.title,
      })
    ),
    ...scoreItems.map(
      (s): FeedItem => ({
        kind: "SCORE_PUBLISHED",
        id: s.id,
        courseOfferingId: s.courseOfferingId,
        sortAt: s.publishedAt!,
        title: s.name,
      })
    ),
  ];

  merged.sort((a, b) => {
    const t = b.sortAt.getTime() - a.sortAt.getTime();
    if (t !== 0) return t;
    return b.id.localeCompare(a.id);
  });

  const page = merged.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  // `hasMore` is approximated: if any source over-fetched (returned
  // PAGE_SIZE), there might be more — flag a next cursor.
  const overflow =
    assignments.length === PAGE_SIZE ||
    materials.length === PAGE_SIZE ||
    announcements.length === PAGE_SIZE ||
    scoreItems.length === PAGE_SIZE ||
    merged.length > PAGE_SIZE;
  const nextCursor =
    overflow && last ? { sortAt: last.sortAt, id: last.id } : null;

  return { items: page, nextCursor };
}
