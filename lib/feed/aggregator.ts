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
import {
  getModerationRestrictions,
  moderationTargetKey,
} from "@/lib/moderation/queries";

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
  /** First ~280 chars of body/description for Instagram-style card body. */
  bodyPreview?: string | null;
  /** Display name of the teacher who posted ("ครูสมชาย ใจดี"). */
  authorName?: string | null;
  /** Real user id for rendering the author's profile avatar. */
  authorUserId?: string | null;
  /** True when the author has uploaded a profile image. */
  authorHasAvatar?: boolean;
  /** Total count of file attachments + link URLs on the source. */
  attachmentCount?: number;
  /** File attachments rendered inline in course feed cards. */
  attachments?: FeedAttachment[];
  /** Reference links rendered inline in course feed cards. */
  linkUrls?: string[];
  /** Active moderation overlay. Restricted content renders a placeholder. */
  moderationRestriction?: "HIDDEN" | "QUARANTINED" | null;
}

export interface FeedAttachment {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
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
  return aggregateFeed(courseIds, cursor);
}

/**
 * Per-CourseOffering Feed — Phase 10C · ADR-0025.
 *
 * Reuses the same multi-query union as getUserFeed but scoped to a
 * single course. The caller is responsible for authorization (e.g.
 * teacher owns the course, student has an active enrollment). The
 * aggregator does not re-check.
 *
 * @param kindFilter optional whitelist of FeedKind — when set, only
 *   those kinds are fetched. Empty/undefined = all 4 kinds.
 */
export async function getCourseFeed(
  courseId: string,
  cursor?: FeedCursor,
  kindFilter?: ReadonlySet<FeedKind>
): Promise<FeedPage> {
  return aggregateFeed([courseId], cursor, kindFilter);
}

async function aggregateFeed(
  courseIds: string[],
  cursor: FeedCursor | undefined,
  kindFilter?: ReadonlySet<FeedKind>
): Promise<FeedPage> {
  const includeKind = (k: FeedKind) => !kindFilter || kindFilter.has(k);

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
  const emptyResult: never[] = [];

  const [assignments, materials, announcements, scoreItems] = await Promise.all(
    [
      includeKind("ASSIGNMENT")
        ? db.assignment.findMany({
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
              description: true,
              fileAttachmentIds: true,
              linkUrls: true,
              dueAt: true,
              createdAt: true,
              course: {
                select: {
                  teacher: {
                    select: {
                      userId: true,
                      firstName: true,
                      lastName: true,
                      user: { select: { profileImageId: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(emptyResult),
      includeKind("MATERIAL")
        ? db.material.findMany({
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
              body: true,
              fileAttachmentIds: true,
              linkUrls: true,
              postedAt: true,
              postedBy: {
                select: {
                  id: true,
                  profileImageId: true,
                  teacher: { select: { firstName: true, lastName: true } },
                  admin: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : Promise.resolve(emptyResult),
      includeKind("ANNOUNCEMENT")
        ? db.announcement.findMany({
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
              body: true,
              fileAttachmentIds: true,
              linkUrls: true,
              postedAt: true,
              postedBy: {
                select: {
                  id: true,
                  profileImageId: true,
                  teacher: { select: { firstName: true, lastName: true } },
                  admin: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : Promise.resolve(emptyResult),
      includeKind("SCORE_PUBLISHED")
        ? db.scoreItem.findMany({
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
            // Strict L1: no fullScore, no entries — those are Scores-tab
            // concerns. Feed only surfaces "this item is live" (ADR-0024
            // sum-based formula doesn't change this L1 boundary).
            select: {
              id: true,
              courseOfferingId: true,
              name: true,
              publishedAt: true,
              course: {
                select: {
                  teacher: {
                    select: {
                      userId: true,
                      firstName: true,
                      lastName: true,
                      user: { select: { profileImageId: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(emptyResult),
    ]
  );

  const fileIds = uniqueStrings([
    ...assignments.flatMap((a) => jsonStringArray(a.fileAttachmentIds)),
    ...materials.flatMap((m) => jsonStringArray(m.fileAttachmentIds)),
    ...announcements.flatMap((an) => jsonStringArray(an.fileAttachmentIds)),
  ]);
  const fileRows =
    fileIds.length > 0
      ? await db.fileAttachment.findMany({
          where: { id: { in: fileIds }, deletedAt: null },
          select: {
            id: true,
            originalFilename: true,
            sizeBytes: true,
            mimeType: true,
          },
        })
      : [];
  const fileById = new Map(fileRows.map((file) => [file.id, file]));
  const restrictions = await getModerationRestrictions([
    ...assignments.map((item) => ({
      targetType: "ASSIGNMENT" as const,
      targetId: item.id,
    })),
    ...materials.map((item) => ({
      targetType: "MATERIAL" as const,
      targetId: item.id,
    })),
    ...announcements.map((item) => ({
      targetType: "ANNOUNCEMENT" as const,
      targetId: item.id,
    })),
    ...fileRows.map((item) => ({
      targetType: "FILE_ATTACHMENT" as const,
      targetId: item.id,
    })),
  ]);

  const merged: FeedItem[] = [
    ...assignments.map(
      (a): FeedItem => ({
        kind: "ASSIGNMENT",
        id: a.id,
        courseOfferingId: a.courseOfferingId,
        sortAt: a.createdAt,
        title: a.title,
        detail: a.dueAt ? a.dueAt.toISOString() : null,
        bodyPreview: truncatePreview(a.description),
        authorName: teacherFullName(a.course?.teacher),
        authorUserId: a.course?.teacher?.userId ?? null,
        authorHasAvatar: Boolean(a.course?.teacher?.user.profileImageId),
        attachments: attachmentsFor(
          a.fileAttachmentIds,
          fileById,
          restrictions
        ),
        linkUrls: jsonStringArray(a.linkUrls),
        moderationRestriction:
          restrictions.get(moderationTargetKey("ASSIGNMENT", a.id)) ?? null,
        attachmentCount:
          jsonArrayLength(a.fileAttachmentIds) + jsonArrayLength(a.linkUrls),
      })
    ),
    ...materials.map(
      (m): FeedItem => ({
        kind: "MATERIAL",
        id: m.id,
        courseOfferingId: m.courseOfferingId,
        sortAt: m.postedAt,
        title: m.title,
        bodyPreview: truncatePreview(m.body),
        authorName:
          teacherFullName(m.postedBy?.teacher) ??
          adminFullName(m.postedBy?.admin),
        authorUserId: m.postedBy?.id ?? null,
        authorHasAvatar: Boolean(m.postedBy?.profileImageId),
        attachments: attachmentsFor(
          m.fileAttachmentIds,
          fileById,
          restrictions
        ),
        linkUrls: jsonStringArray(m.linkUrls),
        moderationRestriction:
          restrictions.get(moderationTargetKey("MATERIAL", m.id)) ?? null,
        attachmentCount:
          jsonArrayLength(m.fileAttachmentIds) + jsonArrayLength(m.linkUrls),
      })
    ),
    ...announcements.map(
      (an): FeedItem => ({
        kind: "ANNOUNCEMENT",
        id: an.id,
        courseOfferingId: an.courseOfferingId,
        sortAt: an.postedAt,
        title: an.title,
        bodyPreview: truncatePreview(an.body),
        authorName:
          teacherFullName(an.postedBy?.teacher) ??
          adminFullName(an.postedBy?.admin),
        authorUserId: an.postedBy?.id ?? null,
        authorHasAvatar: Boolean(an.postedBy?.profileImageId),
        attachments: attachmentsFor(
          an.fileAttachmentIds,
          fileById,
          restrictions
        ),
        linkUrls: jsonStringArray(an.linkUrls),
        moderationRestriction:
          restrictions.get(moderationTargetKey("ANNOUNCEMENT", an.id)) ?? null,
        attachmentCount:
          jsonArrayLength(an.fileAttachmentIds) + jsonArrayLength(an.linkUrls),
      })
    ),
    ...scoreItems.map(
      (s): FeedItem => ({
        kind: "SCORE_PUBLISHED",
        id: s.id,
        courseOfferingId: s.courseOfferingId,
        sortAt: s.publishedAt!,
        title: s.name,
        bodyPreview: null,
        authorName: teacherFullName(s.course?.teacher),
        authorUserId: s.course?.teacher?.userId ?? null,
        authorHasAvatar: Boolean(s.course?.teacher?.user.profileImageId),
        attachmentCount: 0,
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

// ─────────────────────────────────────────────────────────────
// Helpers — extract teacher/admin display name + attachment count
// ─────────────────────────────────────────────────────────────

function teacherFullName(
  t: { firstName: string; lastName: string } | null | undefined
): string | null {
  if (!t) return null;
  return `${t.firstName} ${t.lastName}`;
}

function adminFullName(
  a: { firstName: string; lastName: string } | null | undefined
): string | null {
  if (!a) return null;
  return `${a.firstName} ${a.lastName}`;
}

/**
 * Truncate body text to ~280 chars at a word boundary so the feed card
 * shows a clean preview. Returns null on empty input.
 */
function truncatePreview(body: string | null | undefined): string | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 280) return trimmed;
  // Cut at the last space before 280; fall back to a hard cut.
  const slice = trimmed.slice(0, 280);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 200 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
}

/** Count items inside Prisma Json column when it's an array. */
function jsonArrayLength(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function jsonStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((item): item is string => typeof item === "string")
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function attachmentsFor(
  rawIds: unknown,
  fileById: Map<
    string,
    {
      id: string;
      originalFilename: string;
      sizeBytes: number;
      mimeType: string;
    }
  >,
  restrictions: Map<string, "HIDDEN" | "QUARANTINED">
): FeedAttachment[] {
  return jsonStringArray(rawIds)
    .filter(
      (id) =>
        restrictions.get(moderationTargetKey("FILE_ATTACHMENT", id)) !==
        "QUARANTINED"
    )
    .map((id) => fileById.get(id))
    .filter((file): file is FeedAttachment => Boolean(file));
}
