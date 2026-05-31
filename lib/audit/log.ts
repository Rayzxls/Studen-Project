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
  // CSV Import (Phase 2)
  | "CSV_IMPORT"
  // Class Code (Phase 2)
  | "CLASS_CODE_REGENERATE"
  | "STUDENT_JOINED_COURSE"
  | "STUDENT_REMOVED_FROM_COURSE"
  // Scoring (Phase 5)
  | "SCORE_ITEM_CREATE"
  | "SCORE_ITEM_DELETE"
  | "SCORE_ITEM_PUBLISH"
  | "SCORE_EDIT_AFTER_PUBLISH"
  | "SCORE_DELETE_AFTER_PUBLISH"
  // Attendance (Phase 4)
  | "ATTENDANCE_BACK_EDIT"
  // Assignment (Phase 6)
  | "ASSIGNMENT_CREATE"
  | "ASSIGNMENT_EDIT"
  | "ASSIGNMENT_DELETE"
  | "ASSIGNMENT_GRADE"
  | "ASSIGNMENT_RETURN"
  // Moderation (Phase 6+)
  | "COMMENT_MODERATED"
  // Files (Phase 6)
  | "FILE_INFECTED_BLOCKED"
  | "FILE_UPLOAD"
  // Admin
  | "ADMIN_VIEW_STUDENT_DATA";

export interface AuditPayload {
  actorId?: string | null;
  actorRole?: Role | null;
  action: AuditEvent;
  targetType?: string;
  targetId?: string;
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
      before: payload.before,
      after: payload.after,
      reason: payload.reason ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
    },
  });
}
