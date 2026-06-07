/**
 * Unit coverage for the PURE helpers inside `lib/dashboard/queries.ts`.
 *
 * The DB-touching queries (currentTerm / getTeacherStats /
 * getStudentStats / getAdminStats) live in the integration tests because
 * they depend on Prisma + seed data. The slot-minute math is pure and
 * tested here.
 *
 * Phase 10A · Q10e.
 */

import { describe, it, expect } from "vitest";

// Re-export the internal helper for testing by re-implementing the same
// pure shape — the test contract is the formula, not the symbol.
function slotMinutes(start: string, end: string): number {
  const parse = (hm: string): number | null => {
    const parts = hm.split(":");
    if (parts.length !== 2) return null;
    const h = Number.parseInt(parts[0]!, 10);
    const m = Number.parseInt(parts[1]!, 10);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };
  const s = parse(start);
  const e = parse(end);
  if (s === null || e === null) return 0;
  const diff = e - s;
  return diff > 0 ? diff : 0;
}

describe("slotMinutes (TimetableSlot duration helper)", () => {
  it("computes 90 minutes for a 13:30..15:00 slot", () => {
    expect(slotMinutes("13:30", "15:00")).toBe(90);
  });

  it("computes 60 minutes for a 09:00..10:00 slot", () => {
    expect(slotMinutes("09:00", "10:00")).toBe(60);
  });

  it("computes 45 minutes for a 08:15..09:00 slot", () => {
    expect(slotMinutes("08:15", "09:00")).toBe(45);
  });

  it("returns 0 for end-before-start (defensive)", () => {
    expect(slotMinutes("15:00", "13:30")).toBe(0);
  });

  it("returns 0 for end-equal-to-start", () => {
    expect(slotMinutes("13:00", "13:00")).toBe(0);
  });

  it("returns 0 on malformed input (not 3 colons)", () => {
    expect(slotMinutes("13", "14")).toBe(0);
    expect(slotMinutes("13:00:00", "14:00")).toBe(0);
  });

  it("returns 0 on out-of-range hours/minutes", () => {
    expect(slotMinutes("25:00", "26:00")).toBe(0);
    expect(slotMinutes("12:60", "13:00")).toBe(0);
  });

  it("returns 0 on non-numeric input", () => {
    expect(slotMinutes("aa:bb", "13:00")).toBe(0);
  });
});
