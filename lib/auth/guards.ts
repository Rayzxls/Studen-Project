import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound, Unauthorized } from "@/lib/errors";
import { can, type Session } from "@/lib/auth/permissions";

/**
 * Server-side auth guards — wrap NextAuth `auth()` with throw semantics
 *
 * Usage:
 *   const session = await requireAuth();
 *   const session = await requireRole(["ADMIN"]);
 *   await assert.viewAuditLog();
 */

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new Unauthorized("not_authenticated");
  }
  return { user: session.user };
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Forbidden("wrong_role");
  }
  return session;
}

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

  /**
   * Assert the session belongs to the teacher who owns this CourseOffering.
   *
   * NOTE — return shape divergence: simple asserts (above) return `Session`
   * alone. Course-scoped asserts return `{ session, course }` because the
   * authorization decision requires fetching the course; returning it saves
   * the caller an identical second lookup. Minimal field set is exposed —
   * callers needing more (enrollments, dates) should fetch separately.
   *
   * Throws:
   *   - Unauthorized — no session
   *   - NotFound     — course doesn't exist (avoid 403/404 enumeration —
   *                     we accept enumeration risk here since the ID space
   *                     is cuid, not iterable)
   *   - Forbidden    — session is not the owning teacher
   */
  async ownsCourse(courseOfferingId: string): Promise<{
    session: Session;
    course: {
      id: string;
      teacherId: string;
      name: string;
      classCode: string;
      codeActive: boolean;
    };
  }> {
    const session = await requireAuth();
    const course = await db.courseOffering.findUnique({
      where: { id: courseOfferingId },
      select: {
        id: true,
        teacherId: true,
        name: true,
        classCode: true,
        codeActive: true,
      },
    });
    if (!course) throw new NotFound("course_not_found");
    if (!can.ownsCourse(session, course)) throw new Forbidden();
    return { session, course };
  },

  /**
   * Assert the session belongs to a student who is an active (non-removed)
   * member of this CourseOffering. ADR-0013 soft-delete: a removed Enrollment
   * row still exists but is not "active" — this assert rejects it.
   *
   * Return shape: same divergence as `ownsCourse`. The enrollment is
   * returned so the caller can pass it to downstream queries scoped to that
   * row (e.g. own ScoreEntry / Submission lookups in Phase 5/6).
   *
   * Throws:
   *   - Unauthorized — no session
   *   - Forbidden    — session is not an active member (covers: wrong role,
   *                     never enrolled, removed). Does NOT distinguish to
   *                     avoid leaking enrollment state to non-members.
   */
  async isActiveCourseMember(courseOfferingId: string): Promise<{
    session: Session;
    enrollment: {
      id: string;
      studentId: string;
      courseOfferingId: string;
      enrolledAt: Date;
    };
  }> {
    const session = await requireAuth();
    if (session.user.role !== "STUDENT") throw new Forbidden();

    const enrollment = await db.enrollment.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId: session.user.id,
          courseOfferingId,
        },
      },
      select: {
        id: true,
        studentId: true,
        courseOfferingId: true,
        enrolledAt: true,
        removedAt: true,
      },
    });

    if (!enrollment || !can.isActiveCourseMember(session, enrollment)) {
      throw new Forbidden();
    }

    return {
      session,
      enrollment: {
        id: enrollment.id,
        studentId: enrollment.studentId,
        courseOfferingId: enrollment.courseOfferingId,
        enrolledAt: enrollment.enrolledAt,
      },
    };
  },

  /**
   * Assert the session belongs to the teacher who owns the CourseOffering
   * that contains the given Session. Phase 4 — attendance mark / cancel.
   *
   * Return shape: divergent like `ownsCourse` / `isActiveCourseMember`. The
   * sessionRow is returned because the authz decision already fetched it,
   * so callers (e.g. an action that needs `scheduledStart` to render a
   * back-edit warning) don't have to issue a duplicate read. Field set
   * exposes the minimum needed for the attendance UI page render.
   *
   * `cancelledAt` is intentionally NOT a rejection here — `can.mutateSession`
   * is about "who", and the lib layer (`bulkMarkAttendance`, `cancelSession`)
   * issues the proper `Conflict` if state is wrong. The action layer can
   * read `cancelledAt` from the returned row to disable the form UI.
   *
   * Throws:
   *   - Unauthorized — no session
   *   - NotFound     — session doesn't exist (cuid id-space, enumeration
   *                     risk acceptable; same posture as `ownsCourse`)
   *   - Forbidden    — session is not the owning teacher
   */
  async canMutateSession(sessionId: string): Promise<{
    session: Session;
    sessionRow: {
      id: string;
      courseOfferingId: string;
      scheduledStart: Date;
      scheduledEnd: Date;
      cancelledAt: Date | null;
      course: { name: string; teacherId: string };
    };
  }> {
    const session = await requireAuth();
    const sessionRow = await db.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        courseOfferingId: true,
        scheduledStart: true,
        scheduledEnd: true,
        cancelledAt: true,
        course: { select: { name: true, teacherId: true } },
      },
    });
    if (!sessionRow) throw new NotFound("session_not_found");
    if (!can.mutateSession(session, sessionRow)) throw new Forbidden();
    return { session, sessionRow };
  },

  /**
   * Assert the session belongs to the teacher who owns the CourseOffering
   * that contains the given ScoreItem. Phase 5 — score-item CUD + publish +
   * score-entry upserts.
   *
   * Return shape: divergent like `canMutateSession`. The `item` is
   * returned because the authz decision already fetched it, so callers
   * (a Server Action wanting to render the publish-confirm dialog with
   * the current fullScore, or to gate the field-class edit dispatch in
   * the UI) don't have to issue a duplicate read. The field set exposes
   * the minimum needed by the Score grid + Publish dialog.
   *
   * `publishedAt` is returned as a Date | null so the caller can drive
   * Pattern 12 (useState lazy initializer for "is this published?" UI flags)
   * and the field-class dispatch in `updateScoreItem`.
   *
   * Throws:
   *   - Unauthorized — no session
   *   - NotFound     — score item doesn't exist (cuid id-space, same
   *                     enumeration-risk posture as `ownsCourse`)
   *   - Forbidden    — session is not the owning teacher
   */
  async canMutateScoreItem(scoreItemId: string): Promise<{
    session: Session;
    item: {
      id: string;
      courseOfferingId: string;
      name: string;
      fullScore: number;
      position: number;
      publishedAt: Date | null;
      course: { name: string; teacherId: string };
    };
  }> {
    const session = await requireAuth();
    const item = await db.scoreItem.findUnique({
      where: { id: scoreItemId },
      select: {
        id: true,
        courseOfferingId: true,
        name: true,
        fullScore: true,
        position: true,
        publishedAt: true,
        course: { select: { name: true, teacherId: true } },
      },
    });
    if (!item) throw new NotFound("score_item_not_found");
    if (!can.mutateScoreItem(session, item)) throw new Forbidden();
    return { session, item };
  },

  /**
   * Assert the session belongs to the teacher who owns the CourseOffering
   * that contains the given Assignment. Phase 6 — Assignment CUD + the
   * ScoreItem-coupling tx (ADR-0019 § 5).
   *
   * Return shape: divergent like `canMutateScoreItem`. The `assignment` is
   * returned because the authz decision already fetched it; callers
   * driving the toggle-OFF confirm dialog (Pattern 12 lazy initialiser
   * for "is the linked ScoreItem published?") need this row anyway.
   *
   * Throws:
   *   - Unauthorized — no session
   *   - NotFound     — assignment doesn't exist (cuid id-space, same
   *                     enumeration-risk posture as `ownsCourse`)
   *   - Forbidden    — session is not the owning teacher
   */
  async canMutateAssignment(assignmentId: string): Promise<{
    session: Session;
    assignment: {
      id: string;
      courseOfferingId: string;
      title: string;
      dueAt: Date | null;
      isScored: boolean;
      scoreItemId: string | null;
      submissionClosed: boolean;
      autoCloseAtDue: boolean;
      course: { name: string; teacherId: string };
    };
  }> {
    const session = await requireAuth();
    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        courseOfferingId: true,
        title: true,
        dueAt: true,
        isScored: true,
        scoreItemId: true,
        submissionClosed: true,
        autoCloseAtDue: true,
        course: { select: { name: true, teacherId: true } },
      },
    });
    if (!assignment) throw new NotFound("assignment_not_found");
    if (!can.mutateAssignment(session, assignment)) throw new Forbidden();
    return { session, assignment };
  },

  /**
   * Assert the session belongs to a student with an active Enrollment in
   * the given Assignment's CourseOffering. Phase 6 — submit / resubmit
   * (ADR-0020 § 2).
   *
   * The submission row itself is NOT looked up here — callers go through
   * `lib/assignment/submission.submitVersion` which lazy-materialises
   * the Submission row inside its own tx (race-safe via P2002 recovery).
   * This assert produces the (assignment, enrollment) pair the caller
   * needs to drive `submitVersion`.
   *
   * Throws:
   *   - Unauthorized — no session
   *   - NotFound     — assignment doesn't exist
   *   - Forbidden    — not a student, no enrollment, or removed enrollment
   *                     (single error to avoid leaking enrollment state)
   */
  async canSubmitTo(assignmentId: string): Promise<{
    session: Session;
    assignment: {
      id: string;
      courseOfferingId: string;
      dueAt: Date | null;
      submissionClosed: boolean;
      autoCloseAtDue: boolean;
      allowText: boolean;
      allowFile: boolean;
      allowLink: boolean;
    };
    enrollment: { id: string; studentId: string };
  }> {
    const session = await requireAuth();
    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        courseOfferingId: true,
        dueAt: true,
        submissionClosed: true,
        autoCloseAtDue: true,
        allowText: true,
        allowFile: true,
        allowLink: true,
      },
    });
    if (!assignment) throw new NotFound("assignment_not_found");
    if (session.user.role !== "STUDENT") throw new Forbidden();
    const enrollment = await db.enrollment.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId: session.user.id,
          courseOfferingId: assignment.courseOfferingId,
        },
      },
      select: { id: true, studentId: true, removedAt: true },
    });
    if (!can.submitTo(session, enrollment)) throw new Forbidden();
    return {
      session,
      assignment,
      enrollment: { id: enrollment!.id, studentId: enrollment!.studentId },
    };
  },

  /**
   * Assert the session may view a Submission row. Phase 6 — student own
   * view + teacher grading view.
   *
   * Returns a discriminated `as` field so the caller can branch behaviour
   * without re-checking the role:
   *   - "owner"   — student viewing own work
   *   - "teacher" — teacher viewing one of their students' work
   *
   * Throws:
   *   - Unauthorized — no session
   *   - NotFound     — submission doesn't exist
   *   - Forbidden    — peer student or wrong teacher
   */
  async canViewSubmission(submissionId: string): Promise<{
    session: Session;
    submission: {
      id: string;
      status: import("@prisma/client").SubmissionStatus;
      assignmentId: string;
      enrollmentId: string;
      enrollment: { studentId: string };
      assignment: {
        id: string;
        isScored: boolean;
        scoreItemId: string | null;
        course: { teacherId: string };
      };
    };
    as: "owner" | "teacher";
  }> {
    const session = await requireAuth();
    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        status: true,
        assignmentId: true,
        enrollmentId: true,
        enrollment: { select: { studentId: true } },
        assignment: {
          select: {
            id: true,
            isScored: true,
            scoreItemId: true,
            course: { select: { teacherId: true } },
          },
        },
      },
    });
    if (!submission) throw new NotFound("submission_not_found");
    if (!can.viewSubmission(session, submission)) throw new Forbidden();
    const as: "owner" | "teacher" =
      session.user.role === "TEACHER" ? "teacher" : "owner";
    return { session, submission, as };
  },

  /**
   * Assert the session may moderate (soft-delete with reason) the given
   * Comment. Phase 6 — Q5 matrix (Teacher × any scope = Important; Admin
   * × CLASS_WIDE = Important; Admin × PRIVATE = Critical). This assert
   * only gates the "who"; the tier dispatch happens at the audit fire
   * site inside `lib/assignment/comment.moderateDeleteComment`.
   *
   * Returns the comment + the resolved host CourseOffering.teacherId so
   * the caller can decide tier without a second lookup.
   */
  async canModerateComment(commentId: string): Promise<{
    session: Session;
    comment: {
      id: string;
      ownerType: import("@prisma/client").CommentOwnerType;
      ownerId: string;
      scope: import("@prisma/client").CommentScope;
      authorId: string;
      deletedAt: Date | null;
    };
    owningCourseTeacherId: string | null;
  }> {
    const session = await requireAuth();
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        ownerType: true,
        ownerId: true,
        scope: true,
        authorId: true,
        deletedAt: true,
      },
    });
    if (!comment) throw new NotFound("comment_not_found");
    const owningCourseTeacherId = await resolveOwningCourseTeacherId(
      comment.ownerType,
      comment.ownerId
    );
    if (!can.moderateComment(session, { owningCourseTeacherId })) {
      throw new Forbidden();
    }
    return { session, comment, owningCourseTeacherId };
  },

  /**
   * Assert the session may presign an upload into the given owner scope.
   * Phase 6 — wraps the `canUpload` predicate that
   * `lib/storage/presign.presignUpload` consumes.
   *
   * Supported ownerTypes (P7-0b):
   *   • ASSIGNMENT  — Teacher of the host CourseOffering attaches a
   *                   worksheet to the brief.
   *   • SUBMISSION  — Student of the owning enrollment attaches files to
   *                   their Submission (files attach to the parent
   *                   Submission row; SubmissionVersion.fileAttachmentIds
   *                   is the per-version pointer array — P7-0a).
   *
   * MATERIAL / ANNOUNCEMENT / COMMENT throw `owner_type_not_supported_yet`
   * until their host models materialize (Phase 7 main).
   *
   * Returns Session — no row to share with the caller (the presign worker
   * already has owner ids from its input).
   */
  async canUploadTo(
    ownerType: import("@prisma/client").FileOwnerType,
    ownerId: string
  ): Promise<Session> {
    const session = await requireAuth();
    if (ownerType === "ASSIGNMENT") {
      const assignment = await db.assignment.findUnique({
        where: { id: ownerId },
        select: { course: { select: { teacherId: true } } },
      });
      if (!assignment) throw new NotFound("assignment_not_found");
      if (!can.uploadToAssignment(session, assignment)) {
        throw new Forbidden();
      }
      return session;
    }
    if (ownerType === "SUBMISSION") {
      const submission = await db.submission.findUnique({
        where: { id: ownerId },
        select: {
          enrollment: { select: { studentId: true, removedAt: true } },
        },
      });
      if (!submission) throw new NotFound("submission_not_found");
      if (!can.uploadToSubmission(session, submission)) {
        throw new Forbidden();
      }
      return session;
    }
    if (ownerType === "PROFILE_IMAGE") {
      // A user may only upload an avatar into their OWN profile scope —
      // ownerId must be the session user id, any role (Phase 13).
      if (ownerId !== session.user.id) throw new Forbidden();
      return session;
    }
    throw new Forbidden("owner_type_not_supported_yet");
  },
};

// ─────────────────────────────────────────────────────────────
// Internal helpers (shared across asserts)
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the teacherId of the CourseOffering that hosts a polymorphic
 * Comment owner. Mirrors `lib/assignment/comment.resolveOwnerContext`
 * but lifted to lib/auth/guards because moderation authz is here.
 */
async function resolveOwningCourseTeacherId(
  ownerType: import("@prisma/client").CommentOwnerType,
  ownerId: string
): Promise<string | null> {
  if (ownerType === "ASSIGNMENT") {
    const row = await db.assignment.findUnique({
      where: { id: ownerId },
      select: { course: { select: { teacherId: true } } },
    });
    return row?.course.teacherId ?? null;
  }
  if (ownerType === "SUBMISSION") {
    const row = await db.submission.findUnique({
      where: { id: ownerId },
      select: {
        assignment: { select: { course: { select: { teacherId: true } } } },
      },
    });
    return row?.assignment.course.teacherId ?? null;
  }
  // MATERIAL / ANNOUNCEMENT — Phase 7+. Return null so admins can still
  // moderate while teachers cannot until the host model exists.
  return null;
}
