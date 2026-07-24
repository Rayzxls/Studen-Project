import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db/client";

/**
 * Audit Log helper
 * ดู Security.md § 7 Audit Log
 */

export type AuditEvent =
  // Auth
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "USER_LOCKED"
  | "LOGOUT"
  | "PASSWORD_RESET_BY_OTHER"
  | "PASSWORD_CHANGED_SELF"
  // Identity
  | "STUDENT_SELF_REGISTERED"
  | "USER_CREATED_BY_ADMIN"
  | "USER_ANONYMIZED"
  | "ROLE_CHANGE"
  | "CONSENT_GRANTED"
  | "CONSENT_WITHDRAWN"
  | "TEACHER_INVITE_ISSUED"
  | "TEACHER_INVITE_REPLACED"
  | "TEACHER_INVITE_REVOKED"
  | "TEACHER_INVITE_ACCEPTED"
  // CSV Import (Phase 2)
  | "CSV_IMPORT"
  | "COURSE_OFFERING_CREATED"
  // Class Code (Phase 2 regen · Phase 3 admin controls)
  | "CLASS_CODE_REGENERATED"
  | "CLASS_CODE_DEACTIVATED"
  | "CLASS_CODE_REACTIVATED"
  | "CLASS_CODE_EXPIRY_SET"
  // Course Membership lifecycle (Phase 2 join · Phase 3 remove/restore · ADR-0013)
  | "COURSE_MEMBER_JOINED"
  | "COURSE_MEMBER_LEFT"
  | "COURSE_MEMBER_REMOVED"
  | "COURSE_MEMBER_RESTORED_BY_REJOIN"
  | "COURSE_OFFERING_ARCHIVED"
  // Lesson Workspace (Release B) — creation/rename/reorder are Verbose.
  | "LESSON_ARCHIVED" // Important · reason required when B3 exposes mutation
  | "LESSON_DELETED" // Important · only an empty Lesson may be hard-deleted
  | "LESSON_CONTENT_MOVED" // Important · preserves content id/history
  // Scoring (Phase 5) — past-tense per Pattern 10; pre-publish CUD not audited (Verbose tier)
  | "SCORE_ITEM_PUBLISHED"
  | "SCORE_EDIT_AFTER_PUBLISH"
  | "SCORE_DELETE_AFTER_PUBLISH"
  // Quiz lifecycle (Release C)
  | "QUIZ_REOPENED"
  | "QUIZ_STUDENT_EXCEPTION_GRANTED"
  // Attendance (Phase 4)
  | "ATTENDANCE_BACK_EDIT"
  | "SESSION_CANCELLED"
  // Assignment + Submission (Phase 6) — past-tense per Pattern 10 · ADR-0020 § 4
  // Verbose-tier events (ASSIGNMENT_CREATED, ASSIGNMENT_DELETED,
  // SUBMISSION_VERSION_CREATED, SUBMISSION_GRADED pre-publish,
  // COMMENT_EDITED in-window, COMMENT_SELF_DELETED) are NOT logged and
  // therefore intentionally absent from this union — same posture as
  // Phase 5 pre-publish ScoreItem CUD.
  | "ASSIGNMENT_UPDATED" // Important only when isScored:true→false toggle with reason ≥ 5
  | "SUBMISSION_RETURNED" // Important · reason = private comment body (≥ 5)
  | "SUBMISSION_WITHDRAWN" // Important · student pulls own work out of the review queue (history preserved)
  | "SUBMISSION_VERSION_HIDDEN" // student soft-hides one past version from their own list (teacher + audit still see it)
  // Profile (Phase 13) — learning identity, not social media
  | "DISPLAY_NAME_CHANGED" // Important · self-service set/clear of User.displayName
  | "PROFILE_IMAGE_CHANGED" // Important · user uploads/replaces own avatar
  | "PROFILE_IMAGE_DELETED" // Important · user removes own avatar (back to default)
  | "PROFILE_IMAGE_RESET_BY_ADMIN" // Important · admin clears another user's avatar
  // Moderation (Phase 6+)
  | "COMMENT_MODERATED" // Important when Teacher (own course) · Critical when Admin × PRIVATE
  // Material + Announcement (Phase 7) — past-tense per Pattern 10 · Q4.2 lock
  // Edit lifecycle is Verbose (no audit); only soft-delete fires Important.
  | "MATERIAL_DELETED" // Important · reason ≥ 5
  | "ANNOUNCEMENT_DELETED" // Important · reason ≥ 5
  // Files (Phase 6) — ADR-0021 audit family
  | "FILE_UPLOADED" // Important · payload omits URL string (CLAUDE.md hard rule)
  | "FILE_REJECTED" // Important · category: magic_byte_mismatch / mime_not_whitelisted / size_exceeds / permission_denied
  | "FILE_DELETED" // Important · owner removal or moderator delete
  | "FILE_INFECTED_BLOCKED" // Critical · enum reserved, no fire site in Phase 6 (AV deferred to Phase 9)
  // Admin
  | "ADMIN_VIEW_STUDENT_DATA"
  // Phase 8 — read-side admin audit tools
  | "ADMIN_AUDIT_EXPORTED"
  // Phase 10 — Admin CRUD surface + analytics export (ADR-0026, Phase 10A Q8b/Q7d)
  | "ACADEMIC_YEAR_CREATED"
  | "ACADEMIC_YEAR_UPDATED"
  | "ACADEMIC_YEAR_DELETED"
  | "TERM_CREATED"
  | "TERM_UPDATED"
  | "TERM_DELETED"
  | "CLASS_CREATED"
  | "CLASS_UPDATED"
  | "CLASS_DELETED"
  | "HOMEROOM_ASSIGNED" // Important · before/after `{teacherId, classId}`
  | "TEACHER_CREATED_SINGLE" // Important · single-add path distinct from CSV_IMPORT (which is bulk)
  | "PASSWORD_RESET_BY_ADMIN" // Important · generated temp password is NOT logged (CLAUDE.md hard rule)
  | "ACCOUNT_SUSPENDED" // Critical · access closes; lifecycle event stores the user-facing message
  | "ACCOUNT_REACTIVATED" // Critical · reversible restoration from Suspended only
  | "CLASS_ANALYTICS_EXPORTED"; // Important · payload = filter snapshot, mirrors ADMIN_AUDIT_EXPORTED posture

export interface AuditPayload {
  actorId?: string | null;
  actorRole?: Role | null;
  action: AuditEvent;
  targetType?: string;
  targetId?: string;
  /**
   * Human-readable snapshot of the target — captured at fire time so the
   * audit viewer renders without JOINs even if the underlying entity is
   * renamed or deleted (ADR-0027, Q9d). Examples:
   *   - ScoreItem fire → "สอบกลางภาค (วิชาคณิตศาสตร์ ม.4)"
   *   - Enrollment fire → "นาย ก. (ม.4/2 · วิชาคณิตศาสตร์)"
   * Optional — old fire sites that haven't been touched leave it null;
   * the renderer falls back to "—".
   */
  targetLabel?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write audit log entry.
 * Pass an optional transaction client to include in a larger transaction.
 */
export async function audit(
  payload: AuditPayload,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;
  await client.auditLog.create({
    data: {
      actorId: payload.actorId ?? null,
      actorRole: payload.actorRole ?? null,
      action: payload.action,
      targetType: payload.targetType ?? null,
      targetId: payload.targetId ?? null,
      targetLabel: payload.targetLabel ?? null,
      before: payload.before,
      after: payload.after,
      reason: payload.reason ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
    },
  });
}
