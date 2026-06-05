/**
 * User Feed href resolver — Phase 7 · P7-6
 *
 * Pure (no I/O). Maps a feed item kind + ids → student URL.
 *
 * Student-only by Q3 = B lock: teacher does not surface User Feed on
 * dashboard (creator role, not consumer). If a future role/scope adds
 * the feed for teachers, add another branch — do NOT collapse the
 * student URL pattern.
 *
 * Fallback (matches `lib/notification/navigation` posture):
 *  - MATERIAL / ANNOUNCEMENT have no UI route yet (P7-7/P7-8) → fall
 *    back to course root so the click still lands somewhere useful.
 */

import type { FeedKind } from "./aggregator";

export function resolveFeedHref(args: {
  kind: FeedKind;
  courseOfferingId: string;
  itemId: string;
}): string {
  const { kind, courseOfferingId, itemId } = args;
  switch (kind) {
    case "ASSIGNMENT":
      return `/student/courses/${courseOfferingId}/assignments/${itemId}`;
    case "SCORE_PUBLISHED":
      return `/student/courses/${courseOfferingId}/scores`;
    case "MATERIAL":
    case "ANNOUNCEMENT":
      // No UI route yet — P7-7 / P7-8 lands these. Land on course root.
      return `/student/courses/${courseOfferingId}`;
  }
}
