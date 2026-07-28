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
 *   STUDENT  → active enrollments in active courses
 *   TEACHER  → owned active courses
 *   ADMIN    → throws Forbidden (no User Feed surface in Phase 7)
 *
 * Archived courses remain available through their explicit course routes,
 * but do not enter the current user feed.
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
        course: { archivedAt: null },
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
        archivedAt: null,
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
