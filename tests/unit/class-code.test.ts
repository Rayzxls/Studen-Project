import { describe, it, expect } from "vitest";
import {
  generateClassCode,
  isValidClassCodeFormat,
  normalizeClassCode,
} from "@/lib/course/class-code";

describe("generateClassCode", () => {
  it("produces code with hyphen separator", () => {
    const code = generateClassCode();
    expect(code).toMatch(/^[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it("contains only uppercase alphanumeric (no confusing chars)", () => {
    for (let i = 0; i < 30; i++) {
      const code = generateClassCode();
      expect(code).not.toMatch(/[0OIL1]/); // confusing chars excluded
      expect(code).toMatch(/^[A-HJ-NP-Z2-9-]+$/);
    }
  });

  it("with hint, uses hint as prefix", () => {
    const code = generateClassCode("math4a");
    expect(code.startsWith("MATH4A-")).toBe(true);
  });

  it("hint is uppercased and sanitized", () => {
    const code = generateClassCode("eng-m4");
    expect(code.startsWith("ENGM4-") || code.startsWith("ENG")).toBe(true);
  });

  it("hint with confusing chars is filtered", () => {
    const code = generateClassCode("OOIL11");
    // After filtering [0OIL1], "OOIL11" → "" → padded with random
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+-[A-HJ-NP-Z2-9]+$/);
  });

  it("generates different codes on each call", () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) codes.add(generateClassCode());
    // Expect very high uniqueness — collision rate ~ 1 / 30^6
    expect(codes.size).toBeGreaterThan(45);
  });
});

describe("isValidClassCodeFormat", () => {
  it("accepts valid codes", () => {
    expect(isValidClassCodeFormat("MATH4A-A8K2X3")).toBe(true);
    expect(isValidClassCodeFormat("ABCD-1234")).toBe(true);
    expect(isValidClassCodeFormat("AB-XY")).toBe(true);
  });

  it("rejects without hyphen", () => {
    expect(isValidClassCodeFormat("MATH4AA8K2X3")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(isValidClassCodeFormat("math4a-a8k2x3")).toBe(false);
  });

  it("rejects too short / too long", () => {
    expect(isValidClassCodeFormat("A-B")).toBe(false);
    expect(isValidClassCodeFormat("ABCDEFGHI-ABCDEFGHI")).toBe(false);
  });

  it("rejects with special chars", () => {
    expect(isValidClassCodeFormat("MATH4A_A8K2X3")).toBe(false);
    expect(isValidClassCodeFormat("MATH4A.A8K2X3")).toBe(false);
    expect(isValidClassCodeFormat("MATH4A A8K2X3")).toBe(false);
  });
});

describe("normalizeClassCode", () => {
  it("uppercases input", () => {
    expect(normalizeClassCode("math4a-a8k2")).toBe("MATH4A-A8K2");
  });

  it("trims whitespace", () => {
    expect(normalizeClassCode("  MATH4A-A8K2  ")).toBe("MATH4A-A8K2");
  });

  it("removes internal whitespace", () => {
    expect(normalizeClassCode("MATH4A - A8K2")).toBe("MATH4A-A8K2");
  });

  it("strips non-alphanumeric except hyphen", () => {
    expect(normalizeClassCode("MATH4A_A8K2X3")).toBe("MATH4AA8K2X3");
    expect(normalizeClassCode("MATH4A.A8K2X3")).toBe("MATH4AA8K2X3");
  });
});
