import { isPublished } from "@/lib/publishing/visibility";

/**
 * The moment a feed card should date itself from.
 *
 * `sortAt` is when the post was written, and it stays the sort key so a
 * scheduled post keeps its place instead of jumping the feed when it appears
 * (ADR-0023). But the written time is the wrong thing to *show* once the post
 * has gone live: something scheduled for 15:00 and typed at 14:50 read as
 * "10 นาทีก่อน" the instant it landed, describing a brand-new post as one the
 * class had already had time to miss.
 *
 * A post still waiting keeps its written time. Its own banner carries the
 * future moment, and a header counting down from a time that has not happened
 * would be worse than one counting up from a time that has.
 */
export function feedMomentOf(
  item: { sortAt: Date; publishAt?: Date | null },
  now: Date = new Date()
): Date {
  const publishAt = item.publishAt ?? null;
  if (publishAt !== null && isPublished({ publishAt }, now)) return publishAt;
  return item.sortAt;
}
