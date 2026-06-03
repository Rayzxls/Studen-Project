/**
 * PURE scoring math — boundary coverage for `lib/scoring/calc.ts`.
 *
 * CLAUDE.md § Critical Files: calc is the most-tested code in the codebase
 * because it derives every student's grade. Every branch and every edge
 * case (zero items, partial publish, zero fullScore, full publish, threshold
 * boundaries) is exercised here.
 */

import { describe, it, expect } from "vitest";
import {
  weightedTotal,
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
  weight: number,
  fullScore: number,
  publishedAt: Date | null = D
): WeightedItem {
  return { id, weight, fullScore, publishedAt };
}

function entry(scoreItemId: string, value: number): WeightedEntry {
  return { scoreItemId, value };
}

// ─────────────────────────────────────────────────────────────
// weightedTotal
// ─────────────────────────────────────────────────────────────

describe("weightedTotal", () => {
  it("returns null when no items", () => {
    expect(weightedTotal([], [])).toBeNull();
  });

  it("returns null when all items are draft (publishedAt = null)", () => {
    const items = [item("a", 5000, 10, null), item("b", 5000, 10, null)];
    expect(weightedTotal(items, [entry("a", 10), entry("b", 10)])).toBeNull();
  });

  it("ignores draft items entirely (denominator = published weight only)", () => {
    const items = [
      item("a", 5000, 10, D), // published
      item("b", 5000, 10, null), // draft — should not contribute to denominator
    ];
    // Student has 10/10 on the only published item → 100% of published portion
    expect(weightedTotal(items, [entry("a", 10)])).toBe(100);
  });

  it("computes weighted average across multiple published items", () => {
    // Two items, equal weight 5000 each.
    // Student: 10/10 on A (100%) + 5/10 on B (50%) → average 75%
    const items = [item("a", 5000, 10), item("b", 5000, 10)];
    const entries = [entry("a", 10), entry("b", 5)];
    expect(weightedTotal(items, entries)).toBe(75);
  });

  it("handles uneven weights correctly", () => {
    // A: weight 7000 (70%), B: weight 3000 (30%)
    // Student: 8/10 on A (80%) + 6/10 on B (60%) → 0.8×70 + 0.6×30 = 56+18 = 74
    const items = [item("a", 7000, 10), item("b", 3000, 10)];
    const entries = [entry("a", 8), entry("b", 6)];
    expect(weightedTotal(items, entries)).toBeCloseTo(74, 10);
  });

  it("treats missing entry as 0 (not as 'skip this item')", () => {
    // Published item with no entry → contributes 0/fullScore to numerator
    // but still counts in denominator.
    // A: 10/10 (100%), B: missing → 0/10 (0%). Both weight 5000.
    // Expected: 50%.
    const items = [item("a", 5000, 10), item("b", 5000, 10)];
    const entries = [entry("a", 10)];
    expect(weightedTotal(items, entries)).toBe(50);
  });

  it("skips items with fullScore <= 0 (defensive — degenerate row)", () => {
    const items = [
      item("a", 5000, 0), // degenerate, skip
      item("b", 5000, 10), // 100% if value=10
    ];
    const entries = [entry("a", 0), entry("b", 10)];
    // Only B contributes — denominator = 5000, numerator = 1.0 × 5000 = 5000
    // 5000 / 5000 × 100 = 100
    expect(weightedTotal(items, entries)).toBe(100);
  });

  it("returns null when every published item has fullScore <= 0", () => {
    const items = [item("a", 5000, 0), item("b", 5000, 0)];
    expect(weightedTotal(items, [])).toBeNull();
  });

  it("yields 0 when student has 0 on every published item", () => {
    const items = [item("a", 5000, 10), item("b", 5000, 10)];
    const entries = [entry("a", 0), entry("b", 0)];
    expect(weightedTotal(items, entries)).toBe(0);
  });

  it("yields exactly 100 when student maxes every published item", () => {
    const items = [item("a", 5000, 10), item("b", 5000, 10)];
    const entries = [entry("a", 10), entry("b", 10)];
    expect(weightedTotal(items, entries)).toBe(100);
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
    // Same as DEFAULT_GRADE_THRESHOLDS[0]
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
    const items = [item("a", 5000, 10, D), item("b", 5000, 10, null)];
    const res = gradeForCourseOffering(items, [entry("a", 10)]);
    expect(res.grade).toBeNull();
    expect(res.publishedItems).toBe(1);
    expect(res.totalItems).toBe(2);
  });

  it("returns finite grade when fully published", () => {
    const items = [item("a", 5000, 10), item("b", 5000, 10)];
    const entries = [entry("a", 10), entry("b", 8)]; // (100 + 80) / 2 = 90
    const res = gradeForCourseOffering(items, entries);
    expect(res.percent).toBe(90);
    expect(res.grade).toBe(4.0);
    expect(res.publishedItems).toBe(2);
    expect(res.totalItems).toBe(2);
  });

  it("returns 0 grade for failing percent (below 50)", () => {
    const items = [item("a", 10000, 10)];
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
    const items = [item("a", 10000, 10)];
    const entries = [entry("a", 7)]; // 70%
    const res = gradeForCourseOffering(items, entries, custom);
    expect(res.grade).toBe(4.0);
  });
});
