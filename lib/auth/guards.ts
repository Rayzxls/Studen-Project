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
   * the current weight + fullScore, or to gate the field-class edit
   * dispatch in the UI) don't have to issue a duplicate read. The field
   * set exposes the minimum needed by the Score grid + Publish dialog.
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
      weight: number;
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
        weight: true,
        position: true,
        publishedAt: true,
        course: { select: { name: true, teacherId: true } },
      },
    });
    if (!item) throw new NotFound("score_item_not_found");
    if (!can.mutateScoreItem(session, item)) throw new Forbidden();
    return { session, item };
  },
};
