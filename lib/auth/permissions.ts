import type { Role } from "@prisma/client";

/**
 * Pure permission predicates — no I/O, no NextAuth import
 * Testable in isolation
 * ดู Security.md § 2 Authorization Matrix
 *
 * For async guards (requireAuth, assert) → see lib/auth/guards.ts
 */

export type SessionUser = {
  id: string;
  role: Role;
  identifier: string;
  mustResetPwd: boolean;
};

export type Session = {
  user: SessionUser;
};

export const can = {
  /** Admin only — view full audit log */
  viewAuditLog(session: Session): boolean {
    return session.user.role === "ADMIN";
  },

  /** Self OR Admin — view user PII */
  viewUserData(session: Session, targetUserId: string): boolean {
    if (session.user.role === "ADMIN") return true;
    return session.user.id === targetUserId;
  },

  /** Self — change own password */
  changeOwnPassword(session: Session, targetUserId: string): boolean {
    return session.user.id === targetUserId;
  },

  /**
   * Reset another user's password
   * Phase 1: ADMIN can reset anyone
   * Phase 2+: TEACHER can reset students in their courses (extended via scope param)
   */
  resetUserPassword(session: Session, _targetRole: Role): boolean {
    if (session.user.role === "ADMIN") return true;
    return false;
  },

  /** Admin only — import users via CSV */
  importTeachersCSV(session: Session): boolean {
    return session.user.role === "ADMIN";
  },

  /** Admin only — disable/enable user account */
  toggleUserActive(session: Session): boolean {
    return session.user.role === "ADMIN";
  },

  /** Admin only — view ALL audit logs */
  viewAllAuditLogs(session: Session): boolean {
    return session.user.role === "ADMIN";
  },
};
