// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  isPublished,
  isScheduled,
  publishedWhere,
} from "@/lib/publishing/visibility";

const NOW = new Date("2026-08-01T08:00:00.000Z");

describe("scheduled publishing visibility", () => {
  it("treats content with no publish time as live", () => {
    // Every row created before this feature has a null publishAt, so this is
    // the case that must never change behaviour.
    expect(isPublished({ publishAt: null }, NOW)).toBe(true);
    expect(isScheduled({ publishAt: null }, NOW)).toBe(false);
  });

  it("publishes exactly at the appointed moment, not a tick later", () => {
    const onTheDot = new Date(NOW);
    expect(isPublished({ publishAt: onTheDot }, NOW)).toBe(true);
    expect(isScheduled({ publishAt: onTheDot }, NOW)).toBe(false);
  });

  it("keeps a future item hidden and marks it as waiting", () => {
    const later = new Date(NOW.getTime() + 60_000);
    expect(isPublished({ publishAt: later }, NOW)).toBe(false);
    expect(isScheduled({ publishAt: later }, NOW)).toBe(true);
  });

  it("treats a past publish time as live, so nothing can be un-sent", () => {
    const earlier = new Date(NOW.getTime() - 60_000);
    expect(isPublished({ publishAt: earlier }, NOW)).toBe(true);
  });

  describe("query clauses", () => {
    it("hides unpublished content from a class", () => {
      expect(publishedWhere("STUDENT", NOW)).toEqual([
        { OR: [{ publishAt: null }, { publishAt: { lte: NOW } }] },
      ]);
    });

    it("shows an author their own scheduled work", () => {
      // Filtering the author's own view would make a scheduled item look like
      // it failed to save.
      expect(publishedWhere("AUTHOR", NOW)).toEqual([]);
    });

    it("returns clauses meant for an AND, not keys to spread", () => {
      // Both this gate and keyset pagination want an `OR`. Spread as siblings,
      // the cursor's OR replaces this one and every page after the first
      // silently loses the gate — so the contract is an array for `AND`.
      const clauses = publishedWhere("STUDENT", NOW);
      expect(Array.isArray(clauses)).toBe(true);

      const cursorClause = { OR: [{ postedAt: { lt: NOW } }] };
      const where = { AND: [...clauses, cursorClause] };
      expect(where.AND).toHaveLength(2);
    });
  });
});
