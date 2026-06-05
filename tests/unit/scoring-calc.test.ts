/**
 * PURE scoring math — boundary coverage for `lib/scoring/calc.ts`.
 *
 * CLAUDE.md § Critical Files: calc is the most-tested code in the codebase
 * because it derives every student's grade. Every branch and every edge
 * case (zero items, partial publish, zero fullScore, full publish, threshold
 * boundaries) is exercised here.
 *
 * Phase 10 cutover (ADR-0024): `weight` channel removed. `scoreTotal` =
 * Σscore / ΣfullScore × 100. fullScore alone encodes per-item influence —
 * larger fullScore = more sway in the course grade, automatically.
 *
 * The `weightedTotal` alias remains for transitional compatibility (and
 * lib/scoring/calc.ts still exports it pointing at scoreTotal) — this file
 * tests the canonical `scoreTotal` name and treats fullScore as the only
 * proportional knob.
 */

import { describe, it, expect } from "vitest";
import {
  scoreTotal,
  gradeFor,
  gradeForCourseOffering,
  type WeightedItem,
  type WeightedEntry,
} from "@/lib/scoring/calc";
import {
  DEFAULT_GRADE_THRESHOLDS,
  type GradeThreshold,
} from "@/lib/scoring/constants";

// Helpers
const D = new Date("2026-06-04T00:00:00Z");

function item(
  id: string,
  fullScore: number,
  publishedAt: Date | null = D
): WeightedItem {
  return { id, fullScore, publishedAt };
}

function entry(scoreItemId: string, value: number): WeightedEntry {
  return { scoreItemId, value };
}

// ─────────────────────────────────────────────────────────────
// scoreTotal (sum-based — ADR-0024)
// ─────────────────────────────────────────────────────────────

describe("scoreTotal", () => {
  it("returns null when no items", () => {
    expect(scoreTotal([], [])).toBeNull();
  });

  it("returns null when all items are draft (publishedAt = null)", () => {
    const items = [item("a", 10, null), item("b", 10, null)];
    expect(scoreTotal(items, [entry("a", 10), entry("b", 10)])).toBeNull();
  });

  it("ignores draft items entirely (denominator = published fullScore only)", () => {
    const items = [
      item("a", 10, D), // published
      item("b", 10, null), // draft — should not contribute to denominator
    ];
    // Student has 10/10 on the only published item → 100% of published portion
    expect(scoreTotal(items, [entry("a", 10)])).toBe(100);
  });

  it("computes proportional total across equal-fullScore items", () => {
    // Two items, fullScore 10 each. Student: 10/10 + 5/10 → 15/20 = 75%
    const items = [item("a", 10), item("b", 10)];
    const entries = [entry("a", 10), entry("b", 5)];
    expect(scoreTotal(items, entries)).toBe(75);
  });

  it("weights larger-fullScore items proportionally (Quiz 10 vs Midterm 50)", () => {
    // Quiz fullScore=10 (got 8 → 80%), Midterm fullScore=50 (got 40 → 80%).
    // Total = (8 + 40) / (10 + 50) × 100 = 48/60 × 100 = 80%.
    const items = [item("a", 10), item("b", 50)];
    const entries = [entry("a", 8), entry("b", 40)];
    expect(scoreTotal(items, entries)).toBe(80);
  });

  it("Midterm 50 outweighs Quiz 5 when student scores differently", () => {
    // Quiz: 5/5 (100%), Midterm: 25/50 (50%). Quiz contributes 5 + Mid contributes 25.
    // Total = (5 + 25) / (5 + 50) × 100 = 30/55 × 100 ≈ 54.545454…%.
    const items = [item("a", 5), item("b", 50)];
    const entries = [entry("a", 5), entry("b", 25)];
    expect(scoreTotal(items, entries)).toBeCloseTo(54.5454, 3);
  });

  it("treats missing entry as 0 (not as 'skip this item')", () => {
    // A: 10/10, B: missing → 0/10. Total = 10/20 × 100 = 50%.
    const items = [item("a", 10), item("b", 10)];
    const entries = [entry("a", 10)];
    expect(scoreTotal(items, entries)).toBe(50);
  });

  it("skips items with fullScore <= 0 (defensive — degenerate row)", () => {
    const items = [
      item("a", 0), // degenerate, skip
      item("b", 10), // 100% if value=10
    ];
    const entries = [entry("a", 0), entry("b", 10)];
    // Only B contributes — 10/10 × 100 = 100.
    expect(scoreTotal(items, entries)).toBe(100);
  });

  it("returns null when every published item has fullScore <= 0", () => {
    const items = [item("a", 0), item("b", 0)];
    expect(scoreTotal(items, [])).toBeNull();
  });

  it("yields 0 when student has 0 on every published item", () => {
    const items = [item("a", 10), item("b", 10)];
    const entries = [entry("a", 0), entry("b", 0)];
    expect(scoreTotal(items, entries)).toBe(0);
  });

  it("yields exactly 100 when student maxes every published item", () => {
    const items = [item("a", 10), item("b", 10)];
    const entries = [entry("a", 10), entry("b", 10)];
    expect(scoreTotal(items, entries)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────
// gradeFor
// ─────────────────────────────────────────────────────────────

describe("gradeFor (default thresholds)", () => {
  it("maps 80+ → 4.0", () => {
    expect(gradeFor(80)).toBe(4.0);
    expect(gradeFor(85)).toBe(4.0);
    expect(gradeFor(100)).toBe(4.0);
  });

  it("maps 75 → 3.5 (boundary inclusive)", () => {
    expect(gradeFor(75)).toBe(3.5);
    expect(gradeFor(79.99)).toBe(3.5);
  });

  it("maps below-80-above-75 → 3.5", () => {
    expect(gradeFor(76)).toBe(3.5);
    expect(gradeFor(74.999)).toBe(3.0);
  });

  it("maps 70..74.99 → 3.0", () => {
    expect(gradeFor(70)).toBe(3.0);
    expect(gradeFor(74)).toBe(3.0);
  });

  it("maps 65..69.99 → 2.5", () => {
    expect(gradeFor(65)).toBe(2.5);
    expect(gradeFor(69)).toBe(2.5);
  });

  it("maps 60..64.99 → 2.0", () => {
    expect(gradeFor(60)).toBe(2.0);
    expect(gradeFor(64)).toBe(2.0);
  });

  it("maps 55..59.99 → 1.5", () => {
    expect(gradeFor(55)).toBe(1.5);
    expect(gradeFor(59)).toBe(1.5);
  });

  it("maps 50..54.99 → 1.0", () => {
    expect(gradeFor(50)).toBe(1.0);
    expect(gradeFor(54)).toBe(1.0);
  });

  it("maps <50 → 0", () => {
    expect(gradeFor(49.99)).toBe(0);
    expect(gradeFor(0)).toBe(0);
    expect(gradeFor(-5)).toBe(0); // defensive
  });

  it("returns 0 for non-finite input", () => {
    expect(gradeFor(NaN)).toBe(0);
    expect(gradeFor(Infinity)).toBe(0);
    expect(gradeFor(-Infinity)).toBe(0);
  });

  it("uses the default thresholds when none passed", () => {
    expect(gradeFor(80)).toBe(4.0);
  });

  it("honors a custom threshold list (caller-provided override)", () => {
    const custom: readonly GradeThreshold[] = [
      { minPercent: 90, grade: 4.0 },
      { minPercent: 80, grade: 3.0 },
      { minPercent: 0, grade: 0.0 },
    ];
    expect(gradeFor(95, custom)).toBe(4.0);
    expect(gradeFor(85, custom)).toBe(3.0);
    expect(gradeFor(70, custom)).toBe(0);
  });

  it("DEFAULT_GRADE_THRESHOLDS is sorted desc by minPercent (invariant)", () => {
    for (let i = 1; i < DEFAULT_GRADE_THRESHOLDS.length; i++) {
      expect(DEFAULT_GRADE_THRESHOLDS[i]!.minPercent).toBeLessThan(
        DEFAULT_GRADE_THRESHOLDS[i - 1]!.minPercent
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────
// gradeForCourseOffering
// ─────────────────────────────────────────────────────────────

describe("gradeForCourseOffering", () => {
  it("returns null grade when 0 items (CONTEXT § Term GPA edge)", () => {
    const res = gradeForCourseOffering([], []);
    expect(res.grade).toBeNull();
    expect(res.percent).toBeNull();
    expect(res.publishedItems).toBe(0);
    expect(res.totalItems).toBe(0);
  });

  it("returns null grade when publish incomplete (1 of 2 published)", () => {
    const items = [item("a", 10, D), item("b", 10, null)];
    const res = gradeForCourseOffering(items, [entry("a", 10)]);
    expect(res.grade).toBeNull();
    expect(res.publishedItems).toBe(1);
    expect(res.totalItems).toBe(2);
  });

  it("returns finite grade when fully published", () => {
    const items = [item("a", 10), item("b", 10)];
    const entries = [entry("a", 10), entry("b", 8)]; // 18/20 × 100 = 90
    const res = gradeForCourseOffering(items, entries);
    expect(res.percent).toBe(90);
    expect(res.grade).toBe(4.0);
    expect(res.publishedItems).toBe(2);
    expect(res.totalItems).toBe(2);
  });

  it("returns 0 grade for failing percent (below 50)", () => {
    const items = [item("a", 10)];
    const entries = [entry("a", 4)]; // 40%
    const res = gradeForCourseOffering(items, entries);
    expect(res.percent).toBe(40);
    expect(res.grade).toBe(0);
  });

  it("honors threshold override per course", () => {
    const custom: readonly GradeThreshold[] = [
      { minPercent: 70, grade: 4.0 },
      { minPercent: 0, grade: 0.0 },
    ];
    const items = [item("a", 10)];
    const entries = [entry("a", 7)]; // 70%
    const res = gradeForCourseOffering(items, entries, custom);
    expect(res.grade).toBe(4.0);
  });
});
