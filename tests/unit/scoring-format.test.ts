/**
 * Display formatters — `lib/scoring/format.ts`.
 *
 * Phase 5 → Phase 10 cutover (ADR-0024) removed `formatBasisPoints` along
 * with the `weight` channel. Remaining coverage: `formatPercent` (used by
 * Score Total) + `formatGradeValue` (always 2 decimals).
 */

import { describe, it, expect } from "vitest";
import { formatGradeValue, formatPercent } from "@/lib/scoring/format";

describe("formatPercent", () => {
  it("renders null as '—'", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("trims trailing zeros: 80.00 → '80%'", () => {
    expect(formatPercent(80)).toBe("80%");
  });

  it("keeps non-zero decimals: 73.5 → '73.5%'", () => {
    expect(formatPercent(73.5)).toBe("73.5%");
  });

  it("rounds to 2 decimals: 73.456 → '73.46%'", () => {
    expect(formatPercent(73.456)).toBe("73.46%");
  });
});

describe("formatGradeValue", () => {
  it("always 2 decimals (Thai transcript convention): 4 → '4.00'", () => {
    expect(formatGradeValue(4)).toBe("4.00");
  });

  it("rounds to 2 decimals: 3.752 → '3.75'", () => {
    expect(formatGradeValue(3.752)).toBe("3.75");
  });

  it("null → '—'", () => {
    expect(formatGradeValue(null)).toBe("—");
  });

  it("non-finite → '—'", () => {
    expect(formatGradeValue(NaN)).toBe("—");
  });
});
