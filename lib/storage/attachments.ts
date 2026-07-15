import { db } from "@/lib/db/client";
import type { FeedAttachment } from "@/lib/feed/aggregator";
import { getModerationRestrictions } from "@/lib/moderation/queries";

/**
 * Shared attachment helpers for post-style surfaces (announcements,
 * materials, assignments). The owner row stores a JSON array of
 * FileAttachment ids in `fileAttachmentIds`; these helpers resolve that
 * into ordered, non-deleted FileAttachment rows in the same shape the feed
 * + FeedAttachmentPreview consume.
 *
 * Signed-URL access is enforced downstream at `/api/storage/files/[id]`
 * (per-request permission check) — these helpers only project metadata.
 */

/** Parse a JSON string-array column defensively (Prisma `Json`). */
export function attachmentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/**
 * Fetch FileAttachment rows for `fileAttachmentIds`, preserving the stored
 * order and dropping any deleted/missing ids.
 */
export async function getOrderedAttachments(
  raw: unknown
): Promise<FeedAttachment[]> {
  const ids = attachmentIds(raw);
  if (ids.length === 0) return [];
  const rows = await db.fileAttachment.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      originalFilename: true,
      sizeBytes: true,
      mimeType: true,
    },
  });
  const restrictions = await getModerationRestrictions(
    rows.map((file) => ({
      targetType: "FILE_ATTACHMENT" as const,
      targetId: file.id,
    }))
  );
  const byId = new Map(rows.map((file) => [file.id, file]));
  return ids
    .map((id) => byId.get(id))
    .filter(
      (file): file is (typeof rows)[number] =>
        file !== undefined && !restrictions.has(`FILE_ATTACHMENT:${file.id}`)
    );
}
