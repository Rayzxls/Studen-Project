/**
 * lib/auth/temp-password.ts — Phase 10B · ADR-0026.
 *
 * Pure helper; deterministic via the injectable rng. Covers the shape
 * contract (14 chars including hyphens, three 4-char groups) and the
 * alphabet contract (URL-safe base64). Entropy is from node:crypto in
 * production; we override with a fixed-byte rng here.
 */

import { describe, it, expect } from "vitest";
import { generateTempPassword } from "@/lib/auth/temp-password";

function fixedRng(...values: number[]) {
  return (n: number) => {
    const out = Buffer.alloc(n);
    for (let i = 0; i < n; i++) out[i] = values[i % values.length] ?? 0;
    return out;
  };
}

describe("generateTempPassword", () => {
  it("produces a 14-char string (xxxx-xxxx-xxxx)", () => {
    const pw = generateTempPassword(fixedRng(0xff));
    expect(pw).toHaveLength(14);
    expect(pw[4]).toBe("-");
    expect(pw[9]).toBe("-");
  });

  it("emits three 4-char groups", () => {
    const pw = generateTempPassword(fixedRng(0xab, 0xcd));
    const groups = pw.split("-");
    expect(groups).toHaveLength(3);
    for (const g of groups) expect(g).toHaveLength(4);
  });

  it("uses URL-safe base64 alphabet only (no +/= and no whitespace)", () => {
    const pw = generateTempPassword(fixedRng(0x00, 0x7f, 0xff));
    const charsOnly = pw.replace(/-/g, "");
    expect(charsOnly).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pw).not.toContain("=");
    expect(pw).not.toContain("/");
    expect(pw).not.toContain("+");
  });

  it("differs across calls when rng is the default (production)", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    // Astronomically unlikely to collide on 72 bits of entropy.
    expect(a).not.toBe(b);
  });

  it("is deterministic when the rng is fixed (test-seam contract)", () => {
    const seed = fixedRng(0x12, 0x34, 0x56, 0x78);
    const a = generateTempPassword(seed);
    const b = generateTempPassword(seed);
    expect(a).toBe(b);
  });

  it("never contains a hyphen inside a group (only between groups)", () => {
    const pw = generateTempPassword(fixedRng(0x10, 0x20, 0x30));
    const groups = pw.split("-");
    for (const g of groups) expect(g).not.toContain("-");
  });
});
