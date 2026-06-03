/**
 * Scoring read-side queries — Phase 5.
 *
 * Two read paths:
 *
 *   1. `getScoreboardForTeacher` — teacher's "Score grid" view of a
 *      CourseOffering. Returns ALL ScoreItems (draft + published) and
 *      the active∪ever-graded enrollment union per Pattern 14 / ADR-0016.
 *
 *   2. `getOwnScoresForStudent` — student's "My scores" view of a
 *      CourseOffering. Returns ONLY published items and ONLY the
 *      requesting student's own ScoreEntries — projected at the Prisma
 *      `select` layer per Pattern 4 / L1 Visibility. Peer rows never
 *      leave the DB.
 */

import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────
// Teacher view — full grid (active ∪ ever-graded)
// ─────────────────────────────────────────────────────────────

export interface TeacherScoreboardItem {
  id: string;
  name: string;
  fullScore: number;
  weight: number;
  position: number;
  publishedAt: Date | null;
}

export interface TeacherScoreboardRow {
  enrollmentId: string;
  studentUserId: string;
  studentId: string; // login identifier (เลขประจำตัวนักเรียน)
  firstName: string;
  lastName: string;
  removedAt: Date | null;
  entries: { scoreItemId: string; value: number; note: string | null }[];
}

export interface TeacherScoreboard {
  items: TeacherScoreboardItem[];
  rows: TeacherScoreboardRow[];
}

/**
 * Active enrollments ∪ enrollments with at least one ScoreEntry on any
 * ScoreItem of this CourseOffering — same posture as Pattern 14 for the
 * attendance grid.
 *
 * Authorization: actor must be the teacher who owns the CourseOffering.
 */
export async function getScoreboardForTeacher(
  courseOfferingId: string,
  actorUserId: string
): Promise<TeacherScoreboard> {
  const course = await db.courseOffering.findUnique({
    where: { id: courseOfferingId },
    select: { teacherId: true },
  });
  if (!course) throw new NotFound("course_not_found");
  if (course.teacherId !== actorUserId) {
    throw new Forbidden("not_course_owner");
  }

  const items = await db.scoreItem.findMany({
    where: { courseOfferingId },
    select: {
      id: true,
      name: true,
      fullScore: true,
      weight: true,
      position: true,
      publishedAt: true,
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });

  // Active ∪ ever-graded for THIS course.
  const enrollments = await db.enrollment.findMany({
    where: {
      courseOfferingId,
      OR: [
        { removedAt: null },
        {
          scoreEntries: {
            some: { scoreItem: { courseOfferingId } },
          },
        },
      ],
    },
    select: {
      id: true,
      removedAt: true,
      student: {
        select: {
          userId: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
      scoreEntries: {
        where: { scoreItem: { courseOfferingId } },
        select: { scoreItemId: true, value: true, note: true },
      },
    },
    orderBy: [
      { student: { firstName: "asc" } },
      { student: { lastName: "asc" } },
    ],
  });

  return {
    items,
    rows: enrollments.map((e) => ({
      enrollmentId: e.id,
      studentUserId: e.student.userId,
      studentId: e.student.studentId,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      removedAt: e.removedAt,
      entries: e.scoreEntries,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Teacher view — single ScoreItem grid (one column of teacher scoreboard)
// ─────────────────────────────────────────────────────────────

export interface ScoreItemGridRow {
  enrollmentId: string;
  studentUserId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  removedAt: Date | null;
  value: number | null;
  note: string | null;
  editCount: number;
}

export interface ScoreItemGrid {
  item: {
    id: string;
    courseOfferingId: string;
    name: string;
    fullScore: number;
    weight: number;
    position: number;
    publishedAt: Date | null;
  };
  rows: ScoreItemGridRow[];
}

/**
 * Per-ScoreItem grid for the teacher entry page. Same active∪ever-graded
 * union as `getScoreboardForTeacher` (Pattern 14) — historical entries
 * from removed enrollments persist as read-only rows.
 *
 * Authorization: actor must be the teacher who owns the parent
 * CourseOffering. Use `assert.canMutateScoreItem` upstream to get the
 * `{ session, item }` pair and avoid a duplicate read for the item shape.
 */
export async function getScoreItemGridForTeacher(
  scoreItemId: string,
  actorUserId: string
): Promise<ScoreItemGrid | null> {
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
      course: { select: { teacherId: true } },
    },
  });
  if (!item) return null;
  if (item.course.teacherId !== actorUserId) {
    throw new Forbidden("not_course_owner");
  }

  const enrollments = await db.enrollment.findMany({
    where: {
      courseOfferingId: item.courseOfferingId,
      OR: [{ removedAt: null }, { scoreEntries: { some: { scoreItemId } } }],
    },
    select: {
      id: true,
      removedAt: true,
      student: {
        select: {
          userId: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
      },
      scoreEntries: {
        where: { scoreItemId },
        select: { value: true, note: true, editCount: true },
        take: 1,
      },
    },
    orderBy: [
      { student: { firstName: "asc" } },
      { student: { lastName: "asc" } },
    ],
  });

  return {
    item: {
      id: item.id,
      courseOfferingId: item.courseOfferingId,
      name: item.name,
      fullScore: item.fullScore,
      weight: item.weight,
      position: item.position,
      publishedAt: item.publishedAt,
    },
    rows: enrollments.map((e) => {
      const entry = e.scoreEntries[0] ?? null;
      return {
        enrollmentId: e.id,
        studentUserId: e.student.userId,
        studentId: e.student.studentId,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        removedAt: e.removedAt,
        value: entry?.value ?? null,
        note: entry?.note ?? null,
        editCount: entry?.editCount ?? 0,
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────
// Student view — term-level (Term GPA + list of CourseOfferings)
// ─────────────────────────────────────────────────────────────

import type { TermCourseBundle } from "./term-gpa";

/**
 * Term-level read for the student's `/student/terms` page.
 *
 * Returns the bundles needed by `termGpa()` PURE — one per Active
 * Enrollment of the student in `termId` (CONTEXT § Term GPA Scope rules:
 * removed enrollments don't count).
 *
 * Also returns lightweight CourseOffering metadata (name, teacher name,
 * creditHours, gradeRulesJson) so the transcript table can render
 * alongside the GPA computation without a second query.
 */
export interface StudentTermCourseRow {
  courseOfferingId: string;
  name: string;
  subjectCode: string | null;
  creditHours: number;
  teacherFirstName: string;
  teacherLastName: string;
  /** Optional override — `null` => DEFAULT_GRADE_THRESHOLDS. */
  gradeRulesJson: unknown;
}

export interface StudentTermSnapshot {
  rows: StudentTermCourseRow[];
  bundles: TermCourseBundle[];
}

export async function getStudentTermSnapshot(
  studentUserId: string,
  termId: string
): Promise<StudentTermSnapshot> {
  const enrollments = await db.enrollment.findMany({
    where: {
      studentId: studentUserId,
      removedAt: null,
      course: { termId },
    },
    select: {
      id: true,
      course: {
        select: {
          id: true,
          name: true,
          subjectCode: true,
          creditHours: true,
          gradeRulesJson: true,
          teacher: { select: { firstName: true, lastName: true } },
          scoreItems: {
            select: {
              id: true,
              fullScore: true,
              weight: true,
              publishedAt: true,
              entries: {
                where: { enrollmentId: { not: undefined } },
                select: { value: true, enrollmentId: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ course: { name: "asc" } }],
  });

  const rows: StudentTermCourseRow[] = [];
  const bundles: TermCourseBundle[] = [];
  for (const e of enrollments) {
    const c = e.course;
    rows.push({
      courseOfferingId: c.id,
      name: c.name,
      subjectCode: c.subjectCode,
      creditHours: c.creditHours,
      teacherFirstName: c.teacher.firstName,
      teacherLastName: c.teacher.lastName,
      gradeRulesJson: c.gradeRulesJson,
    });
    bundles.push({
      courseOfferingId: c.id,
      creditHours: c.creditHours,
      items: c.scoreItems.map((it) => ({
        id: it.id,
        fullScore: it.fullScore,
        weight: it.weight,
        publishedAt: it.publishedAt,
      })),
      entries: c.scoreItems.flatMap((it) =>
        it.entries
          .filter((en) => en.enrollmentId === e.id)
          .map((en) => ({ scoreItemId: it.id, value: en.value }))
      ),
    });
  }

  return { rows, bundles };
}

/**
 * Distinct list of Terms the student has any (active or removed) Enrollment
 * in — for the history dropdown on the `/student/terms` page.
 *
 * Removed enrollments are INCLUDED here (history view); the live GPA
 * computation filters back down to active-only via `getStudentTermSnapshot`.
 */
export interface StudentTermOption {
  id: string;
  name: string;
  number: number;
  academicYearName: string;
  isActive: boolean;
}

export async function listTermsForStudent(
  studentUserId: string
): Promise<StudentTermOption[]> {
  const terms = await db.term.findMany({
    where: {
      courses: {
        some: { enrollments: { some: { studentId: studentUserId } } },
      },
    },
    select: {
      id: true,
      name: true,
      number: true,
      isActive: true,
      academicYear: { select: { name: true } },
    },
    orderBy: [{ academicYear: { name: "desc" } }, { number: "desc" }],
  });
  return terms.map((t) => ({
    id: t.id,
    name: t.name,
    number: t.number,
    academicYearName: t.academicYear.name,
    isActive: t.isActive,
  }));
}

// ─────────────────────────────────────────────────────────────
// Student view — own scores only, published items only (L1)
// ─────────────────────────────────────────────────────────────

export interface StudentScoreItem {
  id: string;
  name: string;
  fullScore: number;
  weight: number;
  position: number;
  publishedAt: Date;
  /** This student's value on this item, or null if no entry exists yet. */
  myValue: number | null;
  myNote: string | null;
}

export interface StudentScoresResult {
  items: StudentScoreItem[];
  /** Publish progress — for "ยังไม่จบเทอม" UI hint. */
  totalItems: number;
  publishedItems: number;
}

/**
 * L1 projection — the Prisma `select` returns ONLY the requesting
 * student's own ScoreEntry rows (filtered by `enrollment.studentId =
 * actorUserId`). Peer entries are never fetched.
 *
 * Authorization: student must have an active OR previously-graded
 * Enrollment in this course. Removed-then-emptied students get 403; the
 * trace-preservation case (removed-but-has-entries) keeps read access
 * so they can see what their final scores were.
 */
export async function getOwnScoresForStudent(
  courseOfferingId: string,
  studentUserId: string
): Promise<StudentScoresResult> {
  const enrollment = await db.enrollment.findFirst({
    where: { courseOfferingId, studentId: studentUserId },
    select: { id: true, removedAt: true },
  });
  if (!enrollment) throw new NotFound("not_enrolled");

  // For the publish progress hint we need ALL items, but we only RETURN
  // published items in the result list.
  const allItems = await db.scoreItem.findMany({
    where: { courseOfferingId },
    select: {
      id: true,
      name: true,
      fullScore: true,
      weight: true,
      position: true,
      publishedAt: true,
      entries: {
        where: { enrollmentId: enrollment.id },
        select: { value: true, note: true },
        take: 1,
      },
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });

  const totalItems = allItems.length;
  let publishedItems = 0;
  const items: StudentScoreItem[] = [];
  for (const it of allItems) {
    if (it.publishedAt === null) continue;
    publishedItems++;
    const own = it.entries[0] ?? null;
    items.push({
      id: it.id,
      name: it.name,
      fullScore: it.fullScore,
      weight: it.weight,
      position: it.position,
      publishedAt: it.publishedAt,
      myValue: own?.value ?? null,
      myNote: own?.note ?? null,
    });
  }

  // Removed enrollment with NO entries → block (defensive — Prisma would
  // already return zero rows but we want a clear 403 over an empty 200).
  if (enrollment.removedAt !== null && publishedItems === 0) {
    throw new Forbidden("enrollment_removed_no_history");
  }

  return { items, totalItems, publishedItems };
}
