/**
 * PURE Term GPA computation — no I/O, no Prisma.
 *
 * Decision 2.4 / ADR-Q4 / CONTEXT § Term GPA:
 *   - Active enrollment only (removed students don't count) — caller
 *     filters this BEFORE assembling bundles; this module assumes inputs
 *     are already scoped to active membership.
 *   - `creditHours === 0` escape: CourseOffering is excluded from both
 *     GPA computation AND completion check (e.g. ลูกเสือ, ชมรม).
 *   - Result is `null` until every grade-bearing CourseOffering has all
 *     items published.
 *   - 0 enrollment → null (state EMPTY downstream).
 *
 * Formula: Σ(grade × creditHours) / Σ(creditHours), rounded to 2 decimals
 * at the boundary for stable test equality. UI re-formats via `formatGpa`.
 */

import {
  gradeForCourseOffering,
  type CourseGradeResult,
  type ScoreItemForCalculation,
  type ScoreEntryForCalculation,
} from "./calc";
import { DEFAULT_GRADE_THRESHOLDS, type GradeThreshold } from "./constants";

/** Per-CourseOffering bundle handed to `termGpa()`. */
export type TermCourseBundle = Readonly<{
  courseOfferingId: string;
  /** หน่วยกิต. `creditHours === 0` excludes the course from GPA + completion. */
  creditHours: number;
  /** Optional thresholds override — falls back to `DEFAULT_GRADE_THRESHOLDS`. */
  thresholds?: readonly GradeThreshold[];
  items: readonly ScoreItemForCalculation[];
  entries: readonly ScoreEntryForCalculation[];
}>;

export type TermGpaResult = Readonly<{
  /** Computed GPA (e.g. 3.75) when complete, otherwise `null`. */
  value: number | null;
  /** Aggregate publish progress across grade-bearing CourseOfferings only. */
  publishedItems: number;
  totalItems: number;
  /** Number of grade-bearing CourseOfferings (`creditHours > 0`). */
  gradeBearingCourses: number;
  /** Total CourseOfferings including `creditHours === 0` rows. */
  totalCourses: number;
}>;

export function termGpa(bundles: readonly TermCourseBundle[]): TermGpaResult {
  const totalCourses = bundles.length;
  const gradeBearing = bundles.filter((b) => b.creditHours > 0);

  if (gradeBearing.length === 0) {
    // Either 0 active enrollments OR every course is creditHours=0.
    return {
      value: null,
      publishedItems: 0,
      totalItems: 0,
      gradeBearingCourses: 0,
      totalCourses,
    };
  }

  let publishedItems = 0;
  let totalItems = 0;
  let weightedSum = 0; // Σ(grade × creditHours)
  let creditSum = 0; // Σ(creditHours of fully-graded courses)
  let anyNull = false;

  for (const b of gradeBearing) {
    const res: CourseGradeResult = gradeForCourseOffering(
      b.items,
      b.entries,
      b.thresholds ?? DEFAULT_GRADE_THRESHOLDS
    );
    publishedItems += res.publishedItems;
    totalItems += res.totalItems;
    if (res.grade === null) {
      anyNull = true;
      continue;
    }
    weightedSum += res.grade * b.creditHours;
    creditSum += b.creditHours;
  }

  if (anyNull || creditSum === 0) {
    return {
      value: null,
      publishedItems,
      totalItems,
      gradeBearingCourses: gradeBearing.length,
      totalCourses,
    };
  }

  // Round to 2 decimals at the edge — stable test equality + matches
  // Thai transcript convention.
  const raw = weightedSum / creditSum;
  const rounded = Math.round(raw * 100) / 100;
  return {
    value: rounded,
    publishedItems,
    totalItems,
    gradeBearingCourses: gradeBearing.length,
    totalCourses,
  };
}
