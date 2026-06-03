/**
 * Display formatters — `lib/scoring/format.ts`.
 *
 * Coverage focuses on the basis-points → percent conversion (single
 * source of truth per ADR-0017) and the GPA "always 2 decimals" contract.
 */

import { describe, it, expect } from "vitest";
import {
  formatBasisPoints,
  formatPercent,
  formatGpa,
} from "@/lib/scoring/format";

describe("formatBasisPoints", () => {
  it("renders 10000 as '100%'", () => {
    expect(formatBasisPoints(10000)).toBe("100%");
  });

  it("renders 5000 as '50%' (no trailing zero)", () => {
    expect(formatBasisPoints(5000)).toBe("50%");
  });

  it("renders 3333 as '33.33%'", () => {
    expect(formatBasisPoints(3333)).toBe("33.33%");
  });

  it("renders 3330 as '33.3%' (one trailing zero trimmed)", () => {
    expect(formatBasisPoints(3330)).toBe("33.3%");
  });

  it("renders 0 as '0%'", () => {
    expect(formatBasisPoints(0)).toBe("0%");
  });

  it("renders non-finite as '—'", () => {
    expect(formatBasisPoints(NaN)).toBe("—");
    expect(formatBasisPoints(Infinity)).toBe("—");
  });
});

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

describe("formatGpa", () => {
  it("always 2 decimals (Thai transcript convention): 4 → '4.00'", () => {
    expect(formatGpa(4)).toBe("4.00");
  });

  it("rounds to 2 decimals: 3.752 → '3.75'", () => {
    expect(formatGpa(3.752)).toBe("3.75");
  });

  it("null → '—'", () => {
    expect(formatGpa(null)).toBe("—");
  });

  it("non-finite → '—'", () => {
    expect(formatGpa(NaN)).toBe("—");
  });
});
