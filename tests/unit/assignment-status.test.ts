/**
 * PURE Submission lifecycle helpers — boundary coverage for
 * `lib/assignment/status.ts`.
 *
 * These helpers are called from both the server ($transaction) and the
 * client (lazy useState initialiser per Pattern 12), so every branch and
 * every edge case (null deadline, open-ended Assignment, exact equality
 * to dueAt, lateness on second submit, forward-only status, etc.) is
 * exercised here.
 */

import { describe, expect, it } from "vitest";
import {
  checkSubmissionWindow,
  computeSubmissionStatus,
  isLate,
  isWithinCommentEditWindow,
} from "@/lib/assignment/status";
import { COMMENT_EDIT_WINDOW_MS } from "@/lib/assignment/constants";

const T = (iso: string) => new Date(iso);

// ─────────────────────────────────────────────────────────────
// isLate
// ─────────────────────────────────────────────────────────────

describe("isLate", () => {
  it("returns false when Assignment has no deadline (dueAt = null)", () => {
    expect(isLate(T("2026-06-04T12:00:00Z"), null)).toBe(false);
  });

  it("returns false when submitted exactly at dueAt (equality = on-time)", () => {
    const due = T("2026-06-04T23:59:00Z");
    expect(isLate(due, due)).toBe(false);
  });

  it("returns false when submitted 1ms before dueAt", () => {
    const due = T("2026-06-04T23:59:00Z");
    expect(isLate(+due - 1, due)).toBe(false);
  });

  it("returns true when submitted 1ms after dueAt", () => {
    const due = T("2026-06-04T23:59:00Z");
    expect(isLate(+due + 1, due)).toBe(true);
  });

  it("accepts millisecond numbers for both args", () => {
    expect(isLate(2_000, 1_000)).toBe(true);
    expect(isLate(1_000, 2_000)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// computeSubmissionStatus — forward-only precedence
// ─────────────────────────────────────────────────────────────

describe("computeSubmissionStatus", () => {
  it("returns DRAFT before any version exists", () => {
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: false,
        currentIsLate: false,
        isReturned: false,
        isGraded: false,
      })
    ).toBe("DRAFT");
  });

  it("returns SUBMITTED for on-time current version", () => {
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: true,
        currentIsLate: false,
        isReturned: false,
        isGraded: false,
      })
    ).toBe("SUBMITTED");
  });

  it("returns LATE_SUBMITTED for late current version", () => {
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: true,
        currentIsLate: true,
        isReturned: false,
        isGraded: false,
      })
    ).toBe("LATE_SUBMITTED");
  });

  it("returns RETURNED when isReturned overrides SUBMITTED", () => {
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: true,
        currentIsLate: false,
        isReturned: true,
        isGraded: false,
      })
    ).toBe("RETURNED");
  });

  it("returns RETURNED even when current version is late (RETURNED wins over LATE_SUBMITTED)", () => {
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: true,
        currentIsLate: true,
        isReturned: true,
        isGraded: false,
      })
    ).toBe("RETURNED");
  });

  it("returns GRADED last — overrides RETURNED and SUBMITTED", () => {
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: true,
        currentIsLate: false,
        isReturned: true,
        isGraded: true,
      })
    ).toBe("GRADED");
  });

  it("returns GRADED even when no version exists (ungraded mark-done edge case is meaningless but type-safe)", () => {
    // This is a theoretical state — ungraded "mark done" without a version
    // does not happen in practice — but the precedence chain must still
    // return GRADED deterministically.
    expect(
      computeSubmissionStatus({
        hasCurrentVersion: false,
        currentIsLate: false,
        isReturned: false,
        isGraded: true,
      })
    ).toBe("GRADED");
  });

  it("on-time v1 → late v2 transition (status moves forward)", () => {
    // Snapshot after v1 (on-time)
    const afterV1 = computeSubmissionStatus({
      hasCurrentVersion: true,
      currentIsLate: false,
      isReturned: false,
      isGraded: false,
    });
    // Snapshot after voluntary v2 (now late)
    const afterV2 = computeSubmissionStatus({
      hasCurrentVersion: true,
      currentIsLate: true,
      isReturned: false,
      isGraded: false,
    });
    expect(afterV1).toBe("SUBMITTED");
    expect(afterV2).toBe("LATE_SUBMITTED");
    // ADR-0020 § 2 — status reflects current version; the transition is
    // forward (SUBMITTED → LATE_SUBMITTED) and never reverses.
  });
});

// ─────────────────────────────────────────────────────────────
// checkSubmissionWindow
// ─────────────────────────────────────────────────────────────

describe("checkSubmissionWindow", () => {
  const now = T("2026-06-04T12:00:00Z");
  const pastDue = T("2026-06-04T11:59:00Z");
  const futureDue = T("2026-06-04T12:01:00Z");

  it("is open by default (no flags, no deadline)", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: false,
        autoCloseAtDue: false,
        dueAt: null,
        now,
      })
    ).toEqual({ open: true });
  });

  it("is open when autoCloseAtDue is on but deadline is in the future", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: false,
        autoCloseAtDue: true,
        dueAt: futureDue,
        now,
      })
    ).toEqual({ open: true });
  });

  it("closes via submissionClosed regardless of deadline", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: true,
        autoCloseAtDue: false,
        dueAt: futureDue,
        now,
      })
    ).toEqual({ open: false, reason: "submission_closed" });
  });

  it("closes via autoCloseAtDue when deadline passes", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: false,
        autoCloseAtDue: true,
        dueAt: pastDue,
        now,
      })
    ).toEqual({ open: false, reason: "auto_closed_at_due" });
  });

  it("closes at the exact deadline instant (>= comparison)", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: false,
        autoCloseAtDue: true,
        dueAt: now,
        now,
      })
    ).toEqual({ open: false, reason: "auto_closed_at_due" });
  });

  it("autoCloseAtDue does nothing when dueAt is null (open-ended Assignment)", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: false,
        autoCloseAtDue: true,
        dueAt: null,
        now,
      })
    ).toEqual({ open: true });
  });

  it("manual close takes precedence over autoCloseAtDue in error reason", () => {
    expect(
      checkSubmissionWindow({
        submissionClosed: true,
        autoCloseAtDue: true,
        dueAt: pastDue,
        now,
      })
    ).toEqual({ open: false, reason: "submission_closed" });
  });
});

// ─────────────────────────────────────────────────────────────
// isWithinCommentEditWindow
// ─────────────────────────────────────────────────────────────

describe("isWithinCommentEditWindow", () => {
  it("is true 0ms after createdAt", () => {
    const t = T("2026-06-04T12:00:00Z");
    expect(
      isWithinCommentEditWindow({
        createdAt: t,
        now: t,
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ).toBe(true);
  });

  it("is true 1ms before window expires", () => {
    const created = T("2026-06-04T12:00:00Z");
    expect(
      isWithinCommentEditWindow({
        createdAt: created,
        now: +created + COMMENT_EDIT_WINDOW_MS - 1,
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ).toBe(true);
  });

  it("is false at exact window expiry instant (< comparison)", () => {
    const created = T("2026-06-04T12:00:00Z");
    expect(
      isWithinCommentEditWindow({
        createdAt: created,
        now: +created + COMMENT_EDIT_WINDOW_MS,
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ).toBe(false);
  });

  it("is false 1ms after window", () => {
    const created = T("2026-06-04T12:00:00Z");
    expect(
      isWithinCommentEditWindow({
        createdAt: created,
        now: +created + COMMENT_EDIT_WINDOW_MS + 1,
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ).toBe(false);
  });

  it("anchors to createdAt, not to last edit (per CONTEXT § Comment Moderation)", () => {
    const created = T("2026-06-04T12:00:00Z");
    // A 4-min-29s edit lands at 4:29; the window still expires at 5:00,
    // not at 4:29 + 5min = 9:29.
    expect(
      isWithinCommentEditWindow({
        createdAt: created,
        now: +created + (4 * 60 + 29) * 1_000,
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ).toBe(true);
    expect(
      isWithinCommentEditWindow({
        createdAt: created,
        now: +created + (5 * 60 + 1) * 1_000,
        windowMs: COMMENT_EDIT_WINDOW_MS,
      })
    ).toBe(false);
  });
});
