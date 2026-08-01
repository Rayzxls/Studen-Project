/**
 * Due Soon Widget query — Phase 7 · P7-6
 *
 * CONTEXT § Due Soon Widget:
 *   - Assignment WHERE `dueAt BETWEEN now AND now+24h`
 *     AND own Submission.status ∈ {NOT_SUBMITTED, DRAFT}
 *   - Active enrollment in an active course
 *   - Sort by `dueAt ASC`, max 5 items
 *   - State-derived (not a Notification kind; not a Feed entry — Q9.2
 *     in P7 grill).
 *
 * Privacy posture (Pattern 4): every `select` returns only the student's
 * own row + assignment metadata. No peer counts, no other students'
 * submissions.
 *
 * STUDENT-only by call site — caller is responsible for passing the
 * resolved student userId from `requireRole(["STUDENT"])`.
 */

import { db } from "@/lib/db/client";
import { publishedWhere } from "@/lib/publishing/visibility";

const HORIZON_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 5;

export interface DueSoonItem {
  id: string;
  title: string;
  dueAt: Date;
  courseOfferingId: string;
  courseName: string;
  /** True when own Submission row exists with status=DRAFT, false otherwise. */
  hasDraft: boolean;
}

export async function getDueSoonForStudent(
  studentUserId: string,
  now: Date = new Date()
): Promise<DueSoonItem[]> {
  const horizon = new Date(now.getTime() + HORIZON_MS);

  const rows = await db.assignment.findMany({
    where: {
      // Active enrollment in an active course (single SQL hop, no
      // duplicate scope query — the join filters down to "courses this
      // student belongs to right now").
      course: {
        archivedAt: null,
        enrollments: {
          some: { studentId: studentUserId, removedAt: null },
        },
      },
      dueAt: { gte: now, lte: horizon },
      // Two OR conditions live here — the publish gate and the submission
      // status — so both go under AND. As siblings the second would replace
      // the first and quietly drop the gate.
      AND: [
        // Scheduled work is not the student's problem until it exists for them
        // (ADR-0046). Otherwise a brief written for next week shows up in Due
        // Soon days before the class can open it.
        ...publishedWhere("STUDENT", now),
        {
          // Submission.status ∈ {NOT_SUBMITTED, DRAFT}.
          // NOT_SUBMITTED is the sentinel state (no Submission row);
          // DRAFT means a row exists but no SubmissionVersion was submitted.
          // We exclude SUBMITTED / LATE_SUBMITTED / RETURNED / GRADED.
          OR: [
            {
              submissions: {
                none: { enrollment: { studentId: studentUserId } },
              },
            },
            {
              submissions: {
                some: {
                  enrollment: { studentId: studentUserId },
                  status: "DRAFT",
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: MAX_ITEMS,
    select: {
      id: true,
      title: true,
      dueAt: true,
      courseOfferingId: true,
      course: { select: { name: true } },
      submissions: {
        where: { enrollment: { studentId: studentUserId } },
        select: { status: true },
        take: 1,
      },
    },
  });

  return rows
    .filter((r): r is typeof r & { dueAt: Date } => r.dueAt !== null)
    .map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      courseOfferingId: r.courseOfferingId,
      courseName: r.course.name,
      hasDraft: r.submissions[0]?.status === "DRAFT",
    }));
}
