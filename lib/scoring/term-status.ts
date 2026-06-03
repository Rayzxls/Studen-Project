/**
 * PURE Term Status derivation — no I/O.
 *
 * CONTEXT § Term Status — 3 values:
 *   - EMPTY        : no grade-bearing CourseOffering (no active enrollment OR every
 *                    course is `creditHours === 0`), OR no ScoreItem set up yet.
 *   - IN_PROGRESS  : items exist; publish not complete (some items still draft).
 *   - COMPLETED    : every grade-bearing course has all items published.
 *
 * One-way transitions per ADR-0018:
 *   EMPTY → IN_PROGRESS → COMPLETED
 * No backward arrow exists because unpublish is forbidden.
 */

import type { TermGpaResult } from "./term-gpa";

export type TermStatus = "EMPTY" | "IN_PROGRESS" | "COMPLETED";

export function deriveTermStatus(gpa: TermGpaResult): TermStatus {
  if (gpa.gradeBearingCourses === 0) return "EMPTY";
  if (gpa.totalItems === 0) return "EMPTY";
  if (gpa.value === null) return "IN_PROGRESS";
  return "COMPLETED";
}
