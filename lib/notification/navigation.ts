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
 *  - When Lesson Workspace is enabled and the immutable notification
 *    snapshot includes a Lesson id, open the content checkpoint inside
 *    that Lesson. Legacy rows and a disabled flag keep their direct entity URL.
 *  - Fall back to course root (or a tab one level up) only when the snapshot
 *    lacks enough addressing data.
 *
 * Fallback strategy = better than a broken deep-link: the user still
 * lands in the relevant course and can navigate one step further.
 *
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
  lessonWorkspaceEnabled?: boolean;
}

function lessonContentHref(args: {
  role: "STUDENT" | "TEACHER";
  courseOfferingId: string;
  lessonId: string | null;
  anchor: string;
  fallback: string;
  enabled: boolean;
}): string {
  if (!args.enabled || !args.lessonId) return args.fallback;
  const rolePath = args.role === "STUDENT" ? "student" : "teacher";
  return `/${rolePath}/courses/${args.courseOfferingId}/lessons/${args.lessonId}#${args.anchor}`;
}

export function resolveNotificationHref(
  args: ResolveNotificationHrefArgs
): string {
  const { kind, role, courseOfferingId, sourceEntityId } = args;
  const lessonId = payloadString(args.payload, "lessonId");
  const useLessonWorkspace = args.lessonWorkspaceEnabled === true;

  // Ultimate fallback when the course context is missing.
  if (!courseOfferingId) return DASHBOARD;

  if (role === "ADMIN") return DASHBOARD;

  if (role === "TEACHER") {
    switch (kind) {
      case "CLASS_CODE_JOINED":
        return `/teacher/courses/${courseOfferingId}/members`;
      case "COMMENT_REPLIED": {
        // P9-1: payload now carries `entityOwnerId`. Teacher branches
        // deep-link to the teacher-side detail page for each entity.
        const entityKind = payloadString(args.payload, "entityKind");
        const entityOwnerId = payloadString(args.payload, "entityOwnerId");
        if (!entityOwnerId) return `/teacher/courses/${courseOfferingId}`;
        switch (entityKind) {
          case "ASSIGNMENT":
          case "SUBMISSION":
            return lessonContentHref({
              role: "TEACHER",
              courseOfferingId,
              lessonId,
              anchor: `assignment-${entityOwnerId}`,
              fallback: `/teacher/courses/${courseOfferingId}/assignments/${entityOwnerId}`,
              enabled: useLessonWorkspace,
            });
          case "MATERIAL":
            return lessonContentHref({
              role: "TEACHER",
              courseOfferingId,
              lessonId,
              anchor: `material-${entityOwnerId}`,
              fallback: `/teacher/courses/${courseOfferingId}/materials/${entityOwnerId}`,
              enabled: useLessonWorkspace,
            });
          case "ANNOUNCEMENT":
            return `/teacher/courses/${courseOfferingId}/announcements/${entityOwnerId}`;
          default:
            return `/teacher/courses/${courseOfferingId}`;
        }
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
      return lessonContentHref({
        role: "STUDENT",
        courseOfferingId,
        lessonId,
        anchor: `assignment-${sourceEntityId}`,
        fallback: `/student/courses/${courseOfferingId}/assignments/${sourceEntityId}`,
        enabled: useLessonWorkspace,
      });

    case "SUBMISSION_GRADED":
    case "SUBMISSION_RETURNED": {
      // P9-1: payload now carries the parent `assignmentId`. Deep-link
      // to assignment detail; fall back to the assignments list for
      // legacy rows that pre-date the enrichment.
      const aid = payloadString(args.payload, "assignmentId");
      if (!aid) return `/student/courses/${courseOfferingId}/assignments`;
      return lessonContentHref({
        role: "STUDENT",
        courseOfferingId,
        lessonId,
        anchor: `assignment-${aid}`,
        fallback: `/student/courses/${courseOfferingId}/assignments/${aid}`,
        enabled: useLessonWorkspace,
      });
    }

    case "MATERIAL_POSTED": {
      // P7-8 student Material detail route is live now.
      return lessonContentHref({
        role: "STUDENT",
        courseOfferingId,
        lessonId,
        anchor: `material-${sourceEntityId}`,
        fallback: `/student/courses/${courseOfferingId}/materials/${sourceEntityId}`,
        enabled: useLessonWorkspace,
      });
    }

    case "ANNOUNCEMENT_POSTED": {
      return `/student/courses/${courseOfferingId}/announcements/${sourceEntityId}`;
    }

    case "COMMENT_REPLIED": {
      // P9-1: payload now carries `entityOwnerId` so we can route to the
      // commented entity. For SUBMISSION this is the parent
      // Assignment.id (set in lib/assignment/comment.ts).
      const entityKind = payloadString(args.payload, "entityKind");
      const entityOwnerId = payloadString(args.payload, "entityOwnerId");
      if (!entityOwnerId) return `/student/courses/${courseOfferingId}`;
      switch (entityKind) {
        case "ASSIGNMENT":
        case "SUBMISSION":
          return lessonContentHref({
            role: "STUDENT",
            courseOfferingId,
            lessonId,
            anchor: `assignment-${entityOwnerId}`,
            fallback: `/student/courses/${courseOfferingId}/assignments/${entityOwnerId}`,
            enabled: useLessonWorkspace,
          });
        case "MATERIAL":
          return lessonContentHref({
            role: "STUDENT",
            courseOfferingId,
            lessonId,
            anchor: `material-${entityOwnerId}`,
            fallback: `/student/courses/${courseOfferingId}/materials/${entityOwnerId}`,
            enabled: useLessonWorkspace,
          });
        case "ANNOUNCEMENT":
          return `/student/courses/${courseOfferingId}/announcements/${entityOwnerId}`;
        default:
          return `/student/courses/${courseOfferingId}`;
      }
    }

    case "CLASS_CODE_JOINED":
      // Shouldn't reach a student recipient, but stay safe.
      return `/student/courses/${courseOfferingId}`;
  }
}
