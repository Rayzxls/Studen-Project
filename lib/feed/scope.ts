/**
 * Course-scope resolver — Phase 7 · ADR-0023 § 4
 *
 * The single L1 boundary that feed queries + the Due Soon widget +
 * notification scope checks share. CLAUDE.md § Critical Files names
 * `lib/feed/aggregator.ts` as a privacy boundary; concentrating the
 * scope lookup here keeps reviewers reading ONE function instead of
 * audit-trailing every per-surface findMany.
 *
 * Behavior by role:
 *   STUDENT  → active enrollments in active-term courses
 *   TEACHER  → owned courses in active term
 *   ADMIN    → throws Forbidden (no User Feed surface in Phase 7)
 *
 * Cross-term scope is intentional active-term-only per Q11.2 = a:
 * historical terms surface through the existing Phase 5 transcript
 * route, not via the User Feed.
 */

import { db } from "@/lib/db/client";
import { Forbidden } from "@/lib/errors";
import type { Session } from "@/lib/auth/permissions";

export interface CourseScope {
  courseIds: string[];
  role: "STUDENT" | "TEACHER";
}

export async function getCourseScopeForUser(
  session: Session
): Promise<CourseScope> {
  if (session.user.role === "STUDENT") {
    const enrollments = await db.enrollment.findMany({
      where: {
        studentId: session.user.id,
        removedAt: null,
        course: { term: { isActive: true } },
      },
      select: { courseOfferingId: true },
    });
    return {
      courseIds: enrollments.map((e) => e.courseOfferingId),
      role: "STUDENT",
    };
  }
  if (session.user.role === "TEACHER") {
    const courses = await db.courseOffering.findMany({
      where: {
        teacherId: session.user.id,
        term: { isActive: true },
      },
      select: { id: true },
    });
    return {
      courseIds: courses.map((c) => c.id),
      role: "TEACHER",
    };
  }
  throw new Forbidden("admin_no_feed_surface");
}
