/**
 * Bell-row href resolver — Phase 7 · P7-5
 *
 * Pure (no I/O, no async). Given a notification's metadata + role +
 * payload snapshot, returns the URL the bell should navigate to on
 * click.
 *
 * Resolution policy (Q5 lock):
 *  - Deep link when the snapshot carries enough to address the entity
 *    (SCORE_ITEM_PUBLISHED → scores tab; ASSIGNMENT_POSTED →
 *    assignment detail since sourceEntityId IS the assignment id).
 *  - Fall back to course root (or a tab one level up) when the
 *    snapshot lacks the addressing id. This is the case for
 *    MATERIAL_POSTED / ANNOUNCEMENT_POSTED (no UI route yet — P7-7/8)
 *    and for SUBMISSION_* / COMMENT_REPLIED whose payloads currently
 *    do not include the parent Assignment id.
 *
 * Fallback strategy = better than a broken deep-link: the user still
 * lands in the relevant course and can navigate one step further.
 *
 * TODO (later phase): enrich SubmissionGraded/Returned/CommentReplied
 * payloads with assignmentId/entityOwnerId at fan-out time so the bell
 * can deep-link to the assignment detail page.
 */

import type { NotificationKind, Role } from "@prisma/client";

const DASHBOARD = "/dashboard";

/** Safely extract a string field from an unknown JSON payload. */
function payloadString(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export interface ResolveNotificationHrefArgs {
  kind: NotificationKind;
  role: Role;
  courseOfferingId: string | null;
  sourceEntityId: string;
  payload: unknown;
}

export function resolveNotificationHref(
  args: ResolveNotificationHrefArgs
): string {
  const { kind, role, courseOfferingId, sourceEntityId } = args;

  // Ultimate fallback when the course context is missing.
  if (!courseOfferingId) return DASHBOARD;

  if (role === "ADMIN") return DASHBOARD;

  if (role === "TEACHER") {
    switch (kind) {
      case "CLASS_CODE_JOINED":
        return `/teacher/courses/${courseOfferingId}/members`;
      case "COMMENT_REPLIED": {
        // Teacher comments on own/classmate threads — fall back to course root.
        // entityKind in payload could route deeper once Material/Announcement
        // UI lands (P7-7/8).
        const entityKind = payloadString(args.payload, "entityKind");
        if (entityKind === "ASSIGNMENT") {
          // We do NOT have the assignment id in the payload yet.
          return `/teacher/courses/${courseOfferingId}`;
        }
        return `/teacher/courses/${courseOfferingId}`;
      }
      default:
        return `/teacher/courses/${courseOfferingId}`;
    }
  }

  // STUDENT
  switch (kind) {
    case "SCORE_ITEM_PUBLISHED":
    case "SCORE_ENTRY_EDITED":
      return `/student/courses/${courseOfferingId}/scores`;

    case "ASSIGNMENT_POSTED":
      // sourceEntityId IS the assignment id by construction (fan-out
      // passes assignment.id to sourceEntityId for this kind).
      return `/student/courses/${courseOfferingId}/assignments/${sourceEntityId}`;

    case "SUBMISSION_GRADED":
    case "SUBMISSION_RETURNED":
      // sourceEntityId is the submission id — we lack the assignment id
      // to deep-link. Land on the assignments list inside the course.
      return `/student/courses/${courseOfferingId}/assignments`;

    case "MATERIAL_POSTED":
    case "ANNOUNCEMENT_POSTED":
      // No UI route yet — P7-7 / P7-8 will land these.
      return `/student/courses/${courseOfferingId}`;

    case "COMMENT_REPLIED":
      return `/student/courses/${courseOfferingId}`;

    case "CLASS_CODE_JOINED":
      // Shouldn't reach a student recipient, but stay safe.
      return `/student/courses/${courseOfferingId}`;
  }
}
