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

  /**
   * Owning TEACHER can mutate (mark / cancel) a Session of their CourseOffering.
   *
   * Phase 4 (ADR-0015 / ADR-0016): attendance writes are scoped to the
   * course owner. ADMIN is rejected — admin moderation of attendance is
   * out of scope for Phase 4 (mirrors `ownsCourse` posture). A cancelled
   * Session is NOT rejected here — the lib layer surfaces `Conflict` if
   * the caller tries to cancel-an-already-cancelled or mark-on-cancelled;
   * this predicate is about "who", not "current state".
   *
   * Pure — caller fetches `session.course.teacherId` and passes it in.
   * For DB-backed lookup use `assert.canMutateSession` in guards.ts.
   */
  mutateSession(
    session: Session,
    sessionRow: { course: { teacherId: string } }
  ): boolean {
    if (session.user.role !== "TEACHER") return false;
    return session.user.id === sessionRow.course.teacherId;
  },

  /**
   * Owning TEACHER can mutate a ScoreItem of their CourseOffering — Phase 5.
   *
   * Scope: create / update / publish / delete of ScoreItem rows AND bulk
   * upsert of their ScoreEntry rows. ADR-0017 + ADR-0018 lifecycle rules
   * (publish gate, field-class edit policy, one-way publish, reason gate)
   * live in `lib/scoring/*` — this predicate is the "who", not the "what".
   * The lib layer surfaces `Conflict` / `ValidationError` for state /
   * invariant violations.
   *
   * ADMIN is rejected (mirrors `mutateSession` / `ownsCourse` posture).
   *
   * Pure — caller fetches `item.course.teacherId` and passes it in. For
   * DB-backed lookup use `assert.canMutateScoreItem` in guards.ts.
   */
  mutateScoreItem(
    session: Session,
    item: { course: { teacherId: string } }
  ): boolean {
    if (session.user.role !== "TEACHER") return false;
    return session.user.id === item.course.teacherId;
  },

  /**
   * Owning TEACHER can create / update / delete an Assignment of their
   * CourseOffering — Phase 6 · ADR-0019.
   *
   * Scope: Assignment CRUD AND the toggle dispatch that atomically
   * creates / deletes the linked ScoreItem in the same tx. ADR-0019 § 5
   * lifecycle rules (toggle off branching by ScoreItem state, weight gate
   * on toggle on) live in `lib/assignment/assignment.ts` — this predicate
   * is the "who", not the "what".
   *
   * ADMIN is rejected (mirrors `mutateScoreItem` posture).
   *
   * Pure — caller fetches `assignment.course.teacherId` and passes it in.
   * For DB-backed lookup use `assert.canMutateAssignment` in guards.ts.
   */
  mutateAssignment(
    session: Session,
    assignment: { course: { teacherId: string } }
  ): boolean {
    if (session.user.role !== "TEACHER") return false;
    return session.user.id === assignment.course.teacherId;
  },

  /**
   * Student with an active Enrollment may submit / resubmit to an
   * Assignment of their CourseOffering — Phase 6 · ADR-0020.
   *
   * Pure — caller fetches the matching Enrollment row (or null) for
   * (assignment.courseOfferingId, session.user.id). A non-null
   * `enrollment.removedAt` rejects (ADR-0013 — removed students lose
   * write privileges); the lib layer additionally enforces the submission
   * window (submissionClosed / autoCloseAtDue) per ADR-0020 § 3.
   *
   * TEACHER + ADMIN are rejected — teachers grade, they do not submit.
   * For DB-backed lookup use `assert.canSubmitTo`.
   */
  submitTo(
    session: Session,
    enrollment: { studentId: string; removedAt: Date | null } | null
  ): boolean {
    if (session.user.role !== "STUDENT") return false;
    if (!enrollment) return false;
    if (enrollment.removedAt !== null) return false;
    return session.user.id === enrollment.studentId;
  },

  /**
   * Visibility of a Submission row — Phase 6 · CONTEXT § L1 Visibility.
   *
   * Allowed:
   *   - the student of the Submission (own work);
   *   - the teacher who owns the Assignment's CourseOffering.
   *
   * Rejected:
   *   - peers (L1 boundary — students never see others' submissions);
   *   - ADMIN (admin moderation of submission CONTENT is out of scope
   *     for Phase 6; if PDPA forensic access is needed it goes through
   *     the audit-log review path, not a direct submission read).
   *
   * Pure — caller fetches the submission shape and passes it in.
   */
  viewSubmission(
    session: Session,
    submission: {
      enrollment: { studentId: string };
      assignment: { course: { teacherId: string } };
    }
  ): boolean {
    if (session.user.role === "TEACHER") {
      return session.user.id === submission.assignment.course.teacherId;
    }
    if (session.user.role === "STUDENT") {
      return session.user.id === submission.enrollment.studentId;
    }
    return false;
  },

  /**
   * Comment moderation — Phase 6 · CONTEXT § Comment Moderation (Q5).
   *
   * Allowed:
   *   - TEACHER who owns the Comment's host CourseOffering (any scope) —
   *     audit tier = Important;
   *   - ADMIN — any course, any scope. Tier escalates to Critical when
   *     scope=PRIVATE (lib/assignment/comment.moderateDeleteComment writes
   *     the row; this predicate is the "who", not the tier dispatch).
   *
   * Pure — caller fetches the host course's teacherId via
   * resolveOwnerContext-style logic and passes it in.
   */
  moderateComment(
    session: Session,
    host: { owningCourseTeacherId: string | null }
  ): boolean {
    if (session.user.role === "ADMIN") return true;
    if (session.user.role === "TEACHER") {
      return (
        host.owningCourseTeacherId !== null &&
        session.user.id === host.owningCourseTeacherId
      );
    }
    return false;
  },

  /**
   * File-upload owner-scope check — Phase 6 · ADR-0021 § 1 step 2.
   *
   * `lib/storage/presign` defers this decision via a `canUpload` callback.
   * For Phase 6 only ASSIGNMENT ownerType fires — Teacher of the host
   * CourseOffering uploads worksheets to the Assignment brief. Student
   * upload to SUBMISSION (P7-0a — files attach to parent Submission, see
   * SubmissionVersion.fileAttachmentIds pointer array) is now wired in
   * P7-0b storage routes.
   *
   * Pure — caller resolves the owner's host teacherId (Assignment.course.
   * teacherId) and passes it in. For DB-backed dispatch use
   * `assert.canUploadTo` in guards.ts.
   */
  uploadToAssignment(
    session: Session,
    assignment: { course: { teacherId: string } }
  ): boolean {
    if (session.user.role !== "TEACHER") return false;
    return session.user.id === assignment.course.teacherId;
  },
};
