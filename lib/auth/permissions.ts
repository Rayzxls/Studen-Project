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

  /**
   * Teacher owns the given CourseOffering.
   * Pure predicate — caller fetches `course.teacherId` and passes it in.
   * For DB-backed lookup + throw semantics use `assert.ownsCourse` in
   * lib/auth/guards.ts. ADMIN does NOT pass this — admin moderation is
   * a separate predicate when Phase 8 adds it.
   */
  ownsCourse(session: Session, course: { teacherId: string }): boolean {
    if (session.user.role !== "TEACHER") return false;
    return session.user.id === course.teacherId;
  },

  /**
   * Student has an active (non-removed) Enrollment in the given course.
   * Pure predicate — caller fetches `enrollment.studentId` and
   * `enrollment.removedAt` and passes them in. ADR-0013 soft-delete:
   * an Enrollment row may exist with `removedAt !== null`; that's NOT
   * active membership. For DB-backed lookup use `assert.isActiveCourseMember`.
   */
  isActiveCourseMember(
    session: Session,
    enrollment: { studentId: string; removedAt: Date | null }
  ): boolean {
    if (session.user.role !== "STUDENT") return false;
    if (enrollment.removedAt !== null) return false;
    return session.user.id === enrollment.studentId;
  },
};
