import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Forbidden, Unauthorized } from "@/lib/errors";

/**
 * Permission utilities
 * ดู Security.md § 2 Authorization Matrix
 *
 * Pattern:
 *   - Phase 1: auth-only checks (require role, view own data)
 *   - Phase 2+: scope-aware (own course, enrolled course, etc.)
 *
 * Usage:
 *   const session = await requireAuth();
 *   const session = await requireRole(["TEACHER"]);
 *   if (!can.viewUserData(session, targetUserId)) throw new Forbidden();
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

/** Get session or throw 401 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new Unauthorized("not_authenticated");
  }
  return { user: session.user };
}

/** Get session and assert role, else 403 */
export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Forbidden("wrong_role");
  }
  return session;
}

/**
 * Permission predicates — pure, testable functions
 * Each returns boolean, never throws
 */
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
    // Phase 2+: extend with course scope check
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

  /** Admin only — view ALL audit logs (vs own activity) */
  viewAllAuditLogs(session: Session): boolean {
    return session.user.role === "ADMIN";
  },
};

/** Assert wrappers — throw Forbidden if predicate returns false */
export const assert = {
  async viewAuditLog(): Promise<Session> {
    const s = await requireAuth();
    if (!can.viewAuditLog(s)) throw new Forbidden();
    return s;
  },
  async viewUserData(targetUserId: string): Promise<Session> {
    const s = await requireAuth();
    if (!can.viewUserData(s, targetUserId)) throw new Forbidden();
    return s;
  },
  async importTeachersCSV(): Promise<Session> {
    const s = await requireAuth();
    if (!can.importTeachersCSV(s)) throw new Forbidden();
    return s;
  },
};
