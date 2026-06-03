/**
 * PURE Term Status derivation — boundary coverage for `lib/scoring/term-status.ts`.
 *
 * Covers the 3-state machine (EMPTY · IN_PROGRESS · COMPLETED) and
 * confirms the one-way contract from ADR-0018: there is no path back
 * from COMPLETED to IN_PROGRESS within these PURE inputs.
 */

import { describe, it, expect } from "vitest";
import { deriveTermStatus } from "@/lib/scoring/term-status";
import type { TermGpaResult } from "@/lib/scoring/term-gpa";

function gpa(partial: Partial<TermGpaResult>): TermGpaResult {
  return {
    value: null,
    publishedItems: 0,
    totalItems: 0,
    gradeBearingCourses: 0,
    totalCourses: 0,
    ...partial,
  };
}

describe("deriveTermStatus", () => {
  it("EMPTY when 0 grade-bearing courses (no enrollment)", () => {
    expect(deriveTermStatus(gpa({ totalCourses: 0 }))).toBe("EMPTY");
  });

  it("EMPTY when every course is creditHours=0", () => {
    // 2 total courses, 0 grade-bearing — see termGpa edge.
    expect(
      deriveTermStatus(gpa({ gradeBearingCourses: 0, totalCourses: 2 }))
    ).toBe("EMPTY");
  });

  it("EMPTY when grade-bearing courses exist but no ScoreItem set up", () => {
    expect(
      deriveTermStatus(
        gpa({
          gradeBearingCourses: 2,
          totalCourses: 2,
          totalItems: 0,
          publishedItems: 0,
        })
      )
    ).toBe("EMPTY");
  });

  it("IN_PROGRESS when items exist but value is null (publish incomplete)", () => {
    expect(
      deriveTermStatus(
        gpa({
          gradeBearingCourses: 2,
          totalCourses: 2,
          totalItems: 4,
          publishedItems: 2,
          value: null,
        })
      )
    ).toBe("IN_PROGRESS");
  });

  it("IN_PROGRESS even when publishedItems === totalItems but value null (race in caller)", () => {
    // Caller's `termGpa` shouldn't produce this, but the derivation is
    // defined defensively: value=null wins over count equality.
    expect(
      deriveTermStatus(
        gpa({
          gradeBearingCourses: 1,
          totalCourses: 1,
          totalItems: 3,
          publishedItems: 3,
          value: null,
        })
      )
    ).toBe("IN_PROGRESS");
  });

  it("COMPLETED when value is finite (publish complete)", () => {
    expect(
      deriveTermStatus(
        gpa({
          gradeBearingCourses: 2,
          totalCourses: 2,
          totalItems: 4,
          publishedItems: 4,
          value: 3.75,
        })
      )
    ).toBe("COMPLETED");
  });

  it("COMPLETED with value 0 (failing GPA) is still COMPLETED", () => {
    expect(
      deriveTermStatus(
        gpa({
          gradeBearingCourses: 1,
          totalCourses: 1,
          totalItems: 1,
          publishedItems: 1,
          value: 0,
        })
      )
    ).toBe("COMPLETED");
  });

  it("COMPLETED with value 4.0 (perfect)", () => {
    expect(
      deriveTermStatus(
        gpa({
          gradeBearingCourses: 1,
          totalCourses: 1,
          totalItems: 1,
          publishedItems: 1,
          value: 4.0,
        })
      )
    ).toBe("COMPLETED");
  });
});
