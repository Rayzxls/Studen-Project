/**
 * PURE scoring math — no I/O, no Prisma, no React.
 *
 * CLAUDE.md § Critical Files: this file calculates grades for every
 * student in the school. Boundary cases are tested exhaustively in
 * `tests/unit/scoring-calc.test.ts`. Any new branch in this file must
 * land with tests in the same commit.
 *
 * Unit conventions (ADR-0024 — sum-based, supersedes ADR-0017):
 *   - fullScore : positive integer (whole points) — also encodes per-
 *                 item influence in the course grade (Σscore/ΣfullScore)
 *   - value     : non-negative integer, 0..fullScore (validated upstream)
 *   - percent   : real number in [0, 100]
 *   - grade     : real number in [0, 4]
 */

import { DEFAULT_GRADE_THRESHOLDS, type GradeThreshold } from "./constants";

/** ScoreItem projection passed into PURE scoring math. */
export type ScoreItemForCalculation = Readonly<{
  /** Score Item ID — used to match against entries. */
  id: string;
  fullScore: number;
  /** Only published items contribute to the score total. */
  publishedAt: Date | null;
}>;

/** ScoreEntry projection passed into PURE scoring math. */
export type ScoreEntryForCalculation = Readonly<{
  scoreItemId: string;
  /** 0..fullScore (validated upstream). */
  value: number;
}>;

/**
 * Score Total in percent (0..100) over PUBLISHED items only — ADR-0024.
 *
 *   Σ value  ÷  Σ fullScore  × 100
 *
 * fullScore expresses both the per-item ceiling AND the per-item influence:
 * a Quiz with `fullScore = 10` contributes 10 points of denominator; a
 * Midterm with `fullScore = 50` contributes 50. No separate weight channel.
 *
 * Missing entry for a published item → counted as 0 / fullScore. The slot
 * was committed to the gradebook; an empty cell means "the student has
 * nothing in this slot", not "skip this item".
 *
 * Returns `null` only when no published items exist OR Σ fullScore === 0
 * (degenerate published items only). Caller decides whether to render
 * "—", "0 %", or "ยังไม่มีคะแนน".
 *
 * `scoreTotal` is the canonical and only public name for this calculation.
 */
export function scoreTotal(
  items: readonly ScoreItemForCalculation[],
  entries: readonly ScoreEntryForCalculation[]
): number | null {
  const entryByItem = new Map<string, number>();
  for (const e of entries) entryByItem.set(e.scoreItemId, e.value);

  let scoreSum = 0; // Σ value (published only)
  let fullSum = 0; // Σ fullScore (published only)
  for (const it of items) {
    if (it.publishedAt === null) continue;
    if (it.fullScore <= 0) continue; // skip degenerate items
    const v = entryByItem.get(it.id) ?? 0;
    scoreSum += v;
    fullSum += it.fullScore;
  }

  if (fullSum === 0) return null;
  return (scoreSum / fullSum) * 100;
}

/**
 * Map a percent in [0, 100] to a grade in [0, 4] using a sorted-desc
 * threshold list. Thresholds are inclusive (`percent >= minPercent` wins).
 *
 * Caller passes `courseOffering.gradeRulesJson ?? DEFAULT_GRADE_THRESHOLDS`
 * at the boundary — this function does not reach into the schema.
 *
 * Non-finite input → 0 (defensive; should not arise from `scoreTotal`).
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
 * null per CONTEXT § Term GPA / Decision 2.4.
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
  items: readonly ScoreItemForCalculation[],
  entries: readonly ScoreEntryForCalculation[],
  thresholds: readonly GradeThreshold[] = DEFAULT_GRADE_THRESHOLDS
): CourseGradeResult {
  const totalItems = items.length;
  let publishedItems = 0;
  for (const it of items) if (it.publishedAt !== null) publishedItems++;

  if (totalItems === 0 || publishedItems < totalItems) {
    return { grade: null, percent: null, publishedItems, totalItems };
  }

  const percent = scoreTotal(items, entries);
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
