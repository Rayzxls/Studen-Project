/**
 * Audit event tier dispatcher — Phase 8 · Security.md § 7
 *
 * Pure (no I/O). Maps an `AuditEvent` string to the tier badge the
 * admin viewer renders next to each row.
 *
 * Source of truth = Security.md § 7. Whenever a new audit event is
 * added, update both the const Sets here AND the Security.md listing
 * in the same commit so they stay in sync.
 *
 * The dispatcher is intentionally string-typed (not narrowed to
 * `AuditEvent`) because Phase 5 / 6 dropped a handful of verb-form
 * audit events from the enum mid-phase (see lib/audit/log.ts header
 * notes). Historical rows in the AuditLog table may still carry those
 * legacy strings; the helper returns `VERBOSE` for unknown actions
 * rather than throwing so the viewer keeps rendering them.
 *
 * `Admin × PRIVATE` comment-moderation escalates the
 * `COMMENT_MODERATED` row to CRITICAL — that's a runtime predicate
 * over `(action, actorRole, scope)` and lives in `tierForRow` below
 * rather than the per-action Set.
 */

import type { Role } from "@prisma/client";

export type AuditTier = "CRITICAL" | "IMPORTANT" | "VERBOSE";

const CRITICAL: ReadonlySet<string> = new Set([
  "SCORE_EDIT_AFTER_PUBLISH",
  "SCORE_DELETE_AFTER_PUBLISH",
  "PASSWORD_RESET_BY_OTHER",
  "ROLE_CHANGE",
  "USER_CREATED_BY_ADMIN",
  "STUDENT_SELF_REGISTERED",
  "USER_LOCKED",
  "USER_ANONYMIZED",
  "COURSE_MEMBER_REMOVED",
  "SESSION_CANCELLED",
  "CONSENT_GRANTED",
  "CONSENT_WITHDRAWN",
  "FILE_INFECTED_BLOCKED",
]);

const IMPORTANT: ReadonlySet<string> = new Set([
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "PASSWORD_CHANGED_SELF",
  "SCORE_ITEM_PUBLISHED",
  "QUIZ_REOPENED",
  "QUIZ_STUDENT_EXCEPTION_GRANTED",
  "ATTENDANCE_BACK_EDIT",
  "CSV_IMPORT",
  "COURSE_OFFERING_CREATED",
  "CLASS_CODE_REGENERATED",
  "CLASS_CODE_DEACTIVATED",
  "CLASS_CODE_REACTIVATED",
  "CLASS_CODE_EXPIRY_SET",
  "ADMIN_VIEW_STUDENT_DATA",
  "ASSIGNMENT_UPDATED",
  "SUBMISSION_RETURNED",
  "SUBMISSION_WITHDRAWN",
  "DISPLAY_NAME_CHANGED",
  "PROFILE_IMAGE_CHANGED",
  "PROFILE_IMAGE_DELETED",
  "PROFILE_IMAGE_RESET_BY_ADMIN",
  "COURSE_MEMBER_JOINED",
  "COURSE_MEMBER_RESTORED_BY_REJOIN",
  "LESSON_ARCHIVED",
  "LESSON_DELETED",
  "LESSON_CONTENT_MOVED",
  "FILE_UPLOADED",
  "FILE_REJECTED",
  "FILE_DELETED",
  "MATERIAL_DELETED",
  "ANNOUNCEMENT_DELETED",
  // CONTEXT § Comment Moderation — Teacher / Admin × CLASS_WIDE = Important;
  // Admin × PRIVATE escalates to CRITICAL via tierForRow().
  "COMMENT_MODERATED",
  // Phase 8 — read-side admin audit tools
  "ADMIN_AUDIT_EXPORTED",
  "CLASS_ANALYTICS_EXPORTED",
]);

/** Per-action default tier — does NOT account for the Admin × PRIVATE escalation. */
export function tierFor(action: string): AuditTier {
  if (CRITICAL.has(action)) return "CRITICAL";
  if (IMPORTANT.has(action)) return "IMPORTANT";
  return "VERBOSE";
}

/**
 * Row-level tier that applies the `COMMENT_MODERATED × Admin × PRIVATE`
 * escalation to Critical (CONTEXT § Comment Moderation Q5 matrix).
 *
 * The escalation predicate inspects the row's `actorRole` and the
 * snapshot `before.scope` stored on the audit row (set by
 * `lib/assignment/comment.moderateDeleteComment`).
 */
export function tierForRow(args: {
  action: string;
  actorRole: Role | null;
  beforeScope?: string | null;
}): AuditTier {
  if (
    args.action === "COMMENT_MODERATED" &&
    args.actorRole === "ADMIN" &&
    args.beforeScope === "PRIVATE"
  ) {
    return "CRITICAL";
  }
  return tierFor(args.action);
}

/** Used by the audit viewer filter to restrict by tier via WHERE action IN (…). */
export function actionsForTier(tier: AuditTier): readonly string[] {
  if (tier === "CRITICAL") return Array.from(CRITICAL);
  if (tier === "IMPORTANT") return Array.from(IMPORTANT);
  // VERBOSE = everything else; the caller composes a NOT IN predicate.
  return [];
}
