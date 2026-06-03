/**
 * PURE scoring math — no I/O, no Prisma, no React.
 *
 * CLAUDE.md § Critical Files: this file calculates grades for every
 * student in the school. Boundary cases are tested exhaustively in
 * `tests/unit/scoring-calc.test.ts`. Any new branch in this file must
 * land with tests in the same commit.
 *
 * Unit conventions (ADR-0017):
 *   - weight    : integer basis points (0..10000 = 0.00 %..100.00 %)
 *   - fullScore : positive integer (whole points)
 *   - value     : non-negative integer, 0..fullScore (validated upstream)
 *   - percent   : real number in [0, 100]
 *   - grade     : real number in [0, 4]
 */

import { DEFAULT_GRADE_THRESHOLDS, type GradeThreshold } from "./constants";

/** ScoreItem projection passed into PURE scoring math. */
export type WeightedItem = Readonly<{
  /** Score Item ID — used to match against entries. */
  id: string;
  fullScore: number;
  /** Basis points (0..10000). */
  weight: number;
  /** Only published items contribute to the weighted total. */
  publishedAt: Date | null;
}>;

/** ScoreEntry projection passed into PURE scoring math. */
export type WeightedEntry = Readonly<{
  scoreItemId: string;
  /** 0..fullScore (validated upstream). */
  value: number;
}>;

/**
 * Weighted total in percent (0..100) over PUBLISHED items only.
 *
 *   Σ (value / fullScore × weight)  ÷  Σ weight  × 100
 *
 * Denominator note: we divide by the sum of PUBLISHED weights rather than
 * a fixed `WEIGHT_SUM_BP`. An in-progress CourseOffering (some items still
 * draft) thereby yields a coherent "percent of what is currently visible".
 * Once publish is complete, `Σ published weight === WEIGHT_SUM_BP` by
 * invariant (ADR-0017), so the two interpretations converge.
 *
 * Missing entry for a published item → counted as 0 / fullScore. The slot
 * was committed to the gradebook; an empty cell means "the student has
 * nothing in this slot", not "skip this item".
 *
 * Returns `null` only when no published items exist (the denominator
 * would be zero). Caller decides whether to render "—", "0 %", or
 * "ยังไม่มีคะแนน".
 */
export function weightedTotal(
  items: readonly WeightedItem[],
  entries: readonly WeightedEntry[]
): number | null {
  const entryByItem = new Map<string, number>();
  for (const e of entries) entryByItem.set(e.scoreItemId, e.value);

  let weightedSum = 0; // Σ (value / fullScore × weight)
  let weightSum = 0; // Σ weight (published only)
  for (const it of items) {
    if (it.publishedAt === null) continue;
    if (it.fullScore <= 0) continue; // skip degenerate items rather than divide by zero
    const v = entryByItem.get(it.id) ?? 0;
    weightedSum += (v / it.fullScore) * it.weight;
    weightSum += it.weight;
  }

  if (weightSum === 0) return null;
  return (weightedSum / weightSum) * 100;
}

/**
 * Map a percent in [0, 100] to a grade in [0, 4] using a sorted-desc
 * threshold list. Thresholds are inclusive (`percent >= minPercent` wins).
 *
 * Caller passes `courseOffering.gradeRulesJson ?? DEFAULT_GRADE_THRESHOLDS`
 * at the boundary — this function does not reach into the schema.
 *
 * Non-finite input → 0 (defensive; should not arise from `weightedTotal`).
 */
export function gradeFor(
  percent: number,
  thresholds: readonly GradeThreshold[] = DEFAULT_GRADE_THRESHOLDS
): number {
  if (!Number.isFinite(percent)) return 0;
  for (const t of thresholds) {
    if (percent >= t.minPercent) return t.grade;
  }
  return 0;
}

/**
 * Complete grade signal for one CourseOffering enrolled student.
 *
 * Returns `grade: null` when EITHER condition holds:
 *   - the CourseOffering has 0 ScoreItems (teacher hasn't set up scoring), OR
 *   - publish is incomplete (`publishedItems < totalItems`)
 *
 * The null contract feeds `termGpa()`: any null collapses Term GPA to
 * null per CONTEXT § Term GPA / ADR-Q4 / Decision 2.4.
 *
 * When complete, `percent` and `grade` are both finite.
 */
export type CourseGradeResult = Readonly<{
  grade: number | null;
  percent: number | null;
  publishedItems: number;
  totalItems: number;
}>;

export function gradeForCourseOffering(
  items: readonly WeightedItem[],
  entries: readonly WeightedEntry[],
  thresholds: readonly GradeThreshold[] = DEFAULT_GRADE_THRESHOLDS
): CourseGradeResult {
  const totalItems = items.length;
  let publishedItems = 0;
  for (const it of items) if (it.publishedAt !== null) publishedItems++;

  if (totalItems === 0 || publishedItems < totalItems) {
    return { grade: null, percent: null, publishedItems, totalItems };
  }

  const percent = weightedTotal(items, entries);
  if (percent === null) {
    return { grade: null, percent: null, publishedItems, totalItems };
  }
  return {
    grade: gradeFor(percent, thresholds),
    percent,
    publishedItems,
    totalItems,
  };
}

export { DEFAULT_GRADE_THRESHOLDS };
