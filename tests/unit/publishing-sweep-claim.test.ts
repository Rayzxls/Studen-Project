// @vitest-environment node

import { describe, expect, it } from "vitest";

import { isPublished, isScheduled } from "@/lib/publishing/visibility";
import { readPublishAt } from "@/lib/publishing/validation";

const NOW = new Date("2026-08-01T08:00:00.000Z");

describe("publish time", () => {
  it("treats a missing time as published, which is what every old row means", () => {
    expect(isPublished({ publishAt: null }, NOW)).toBe(true);
    expect(isScheduled({ publishAt: null }, NOW)).toBe(false);
  });

  it("publishes exactly at the chosen moment, not a tick later", () => {
    const exact = new Date(NOW);
    expect(isPublished({ publishAt: exact }, NOW)).toBe(true);
    expect(isScheduled({ publishAt: exact }, NOW)).toBe(false);
  });

  it("keeps a future time scheduled", () => {
    const later = new Date(NOW.getTime() + 60_000);
    expect(isPublished({ publishAt: later }, NOW)).toBe(false);
    expect(isScheduled({ publishAt: later }, NOW)).toBe(true);
  });

  it("accepts a past time as already live rather than rejecting it", () => {
    // A teacher rescheduling something that already went out cannot un-send it,
    // so the honest reading is "visible now".
    const earlier = new Date(NOW.getTime() - 60_000);
    expect(isPublished({ publishAt: earlier }, NOW)).toBe(true);
  });
});

describe("reading a publish time from a form", () => {
  it("reads an empty field as post now", () => {
    expect(readPublishAt("")).toBeNull();
    expect(readPublishAt("   ")).toBeNull();
    expect(readPublishAt(null)).toBeNull();
  });

  it("ignores a value that is not a date instead of throwing at the teacher", () => {
    expect(readPublishAt("not-a-date")).toBeNull();
  });

  it("interprets the teacher's wall-clock choice in Bangkok on every server", () => {
    // Scheduling is a Bangkok wall-clock contract. The stored instant must not
    // depend on whether Node happens to run in Bangkok locally or UTC on Vercel.
    const parsed = readPublishAt("2026-08-03T08:30");
    expect(parsed?.toISOString()).toBe("2026-08-03T01:30:00.000Z");
  });

  it("does not shift an explicitly-zoned instant a second time", () => {
    const parsed = readPublishAt("2026-08-03T01:30:00.000Z");
    expect(parsed?.toISOString()).toBe("2026-08-03T01:30:00.000Z");
  });
});
