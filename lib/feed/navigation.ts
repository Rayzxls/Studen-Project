/**
 * User Feed href resolver — Phase 7 · P7-6 · upgraded Phase 9 · P9-1
 *
 * Pure (no I/O). Maps a feed item kind + ids → student URL.
 *
 * Student-only by Q3 = B lock: teacher does not surface User Feed on
 * dashboard (creator role, not consumer). If a future role/scope adds
 * the feed for teachers, add another branch — do NOT collapse the
 * student URL pattern.
 *
 * P9-1: MATERIAL / ANNOUNCEMENT now deep-link to the student-side
 * detail routes that P7-8 shipped, mirroring
 * `lib/notification/navigation` behaviour. The course-root fallback
 * predates the P7-8 student M+A routes.
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
      return `/student/courses/${courseOfferingId}/materials/${itemId}`;
    case "ANNOUNCEMENT":
      return `/student/courses/${courseOfferingId}/announcements/${itemId}`;
  }
}

/**
 * Role-aware variant — Phase 10C · ADR-0025 Course Feed needs both
 * `/teacher/...` and `/student/...` URL families.
 */
export function resolveCourseFeedHref(args: {
  kind: FeedKind;
  courseOfferingId: string;
  itemId: string;
  role: "TEACHER" | "STUDENT";
}): string {
  const { kind, courseOfferingId, itemId, role } = args;
  const prefix = role === "TEACHER" ? "/teacher" : "/student";
  switch (kind) {
    case "ASSIGNMENT":
      return `${prefix}/courses/${courseOfferingId}/assignments/${itemId}`;
    case "SCORE_PUBLISHED":
      return `${prefix}/courses/${courseOfferingId}/scores`;
    case "MATERIAL":
      return `${prefix}/courses/${courseOfferingId}/materials/${itemId}`;
    case "ANNOUNCEMENT":
      return `${prefix}/courses/${courseOfferingId}/announcements/${itemId}`;
  }
}
