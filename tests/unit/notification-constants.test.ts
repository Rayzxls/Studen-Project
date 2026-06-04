/**
 * Pure unit tests — lib/notification/constants
 *
 * Locks the partial unique scope and the bell-preview clipping behavior.
 */

import { describe, expect, it } from "vitest";
import {
  POST_ONCE_KINDS,
  isPostOnceKind,
  clipExcerpt,
  PAYLOAD_EXCERPT_MAX,
} from "@/lib/notification/constants";

describe("POST_ONCE_KINDS (ADR-0022 § 3)", () => {
  it("matches the 7-element list locked in the raw SQL migration", () => {
    expect([...POST_ONCE_KINDS].sort()).toEqual(
      [
        "SCORE_ITEM_PUBLISHED",
        "ASSIGNMENT_POSTED",
        "MATERIAL_POSTED",
        "ANNOUNCEMENT_POSTED",
        "SUBMISSION_GRADED",
        "SUBMISSION_RETURNED",
        "CLASS_CODE_JOINED",
      ].sort()
    );
  });

  it("excludes the 2 repeatable kinds", () => {
    expect(isPostOnceKind("SCORE_ENTRY_EDITED")).toBe(false);
    expect(isPostOnceKind("COMMENT_REPLIED")).toBe(false);
  });

  it("accepts every post-once kind", () => {
    for (const k of POST_ONCE_KINDS) {
      expect(isPostOnceKind(k)).toBe(true);
    }
  });
});

describe("clipExcerpt", () => {
  it("returns the input unchanged when within limit", () => {
    expect(clipExcerpt("short message")).toBe("short message");
  });

  it("returns input unchanged at exact limit", () => {
    const s = "a".repeat(PAYLOAD_EXCERPT_MAX);
    expect(clipExcerpt(s)).toBe(s);
  });

  it("clips and appends ellipsis when over limit", () => {
    const s = "a".repeat(PAYLOAD_EXCERPT_MAX + 50);
    const result = clipExcerpt(s);
    expect(result.length).toBe(PAYLOAD_EXCERPT_MAX);
    expect(result.endsWith("…")).toBe(true);
  });

  it("clips Thai text without breaking the ellipsis suffix", () => {
    const s = "การบ้าน".repeat(50);
    const result = clipExcerpt(s);
    expect(result.length).toBeLessThanOrEqual(PAYLOAD_EXCERPT_MAX);
    if (s.length > PAYLOAD_EXCERPT_MAX) {
      expect(result.endsWith("…")).toBe(true);
    }
  });
});
