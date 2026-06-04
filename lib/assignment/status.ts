/**
 * PURE helpers for Submission lifecycle — Phase 6 · ADR-0020
 *
 * No I/O. Used by both:
 *   - `lib/assignment/submission.ts` (server, inside $transaction);
 *   - client UI (`useState` lazy initialiser per Pattern 12 for "is past deadline?").
 *
 * Mirror of `lib/scoring/calc.ts` PURE posture from Phase 5.
 */

import type { SubmissionStatus } from "@prisma/client";

/**
 * Is a submit/resubmit "late" relative to its Assignment's `dueAt`?
 *
 * ADR-0020 § 2: per-version, immutable at submit-time. The deadline is the
 * deadline — no grace period, no per-Assignment grace config.
 *
 * Conventions:
 *   - `dueAt = null` (open-ended Assignment) → never late.
 *   - `submittedAt > dueAt` → late (strict greater-than; equality = on-time).
 *
 * Caller passes Date or millisecond instants — both are accepted via
 * `+new Date(x)` coercion. The check operates on UTC instants (Pattern 11).
 */
export function isLate(
  submittedAt: Date | number,
  dueAt: Date | number | null
): boolean {
  if (dueAt === null) return false;
  return +new Date(submittedAt) > +new Date(dueAt);
}

/**
 * Compute the materialised `Submission.status` for a given state of the
 * world. Encapsulates ADR-0020 § 2 ("status reflects current version, moves
 * forward only") so both `submitVersion` and `returnSubmission` can call
 * the same dispatch.
 *
 * Inputs describe the post-mutation state:
 *   - `hasCurrentVersion` — true after at least one SubmissionVersion exists
 *     with `isCurrent=true`. False before the student has submitted at all
 *     (status = `DRAFT` when a draft Submission row exists, `NOT_SUBMITTED`
 *     otherwise — the latter is a sentinel returned by queries when no row
 *     exists, not a value stored in DB).
 *   - `currentIsLate` — `SubmissionVersion.isLate` of the current version
 *     (only inspected when `hasCurrentVersion=true`).
 *   - `isReturned` — teacher hit RETURN since the last submit; cleared
 *     implicitly on the next submit (`SUBMITTED`/`LATE_SUBMITTED` again).
 *   - `isGraded` — teacher has finalised grading (scored Assignment:
 *     `ScoreItem.publishedAt !== null` AND a ScoreEntry exists for this
 *     enrollment; ungraded Assignment: teacher manually marked done).
 *
 * Precedence order (forward-only):
 *   1. `isGraded=true`           → GRADED
 *   2. `isReturned=true`         → RETURNED
 *   3. `hasCurrentVersion=true`  → SUBMITTED | LATE_SUBMITTED (by `currentIsLate`)
 *   4. otherwise                 → DRAFT
 *
 * The caller is responsible for clearing `isReturned` on resubmit (set it
 * to `false` when reading the current submission row after the new version
 * lands). The function does not encode the "RETURNED → SUBMITTED on
 * resubmit" transition timing — it only computes a status from a snapshot.
 */
export function computeSubmissionStatus(args: {
  hasCurrentVersion: boolean;
  currentIsLate: boolean;
  isReturned: boolean;
  isGraded: boolean;
}): SubmissionStatus {
  if (args.isGraded) return "GRADED";
  if (args.isReturned) return "RETURNED";
  if (args.hasCurrentVersion) {
    return args.currentIsLate ? "LATE_SUBMITTED" : "SUBMITTED";
  }
  return "DRAFT";
}

/**
 * Are new SubmissionVersions accepted for this Assignment right now?
 *
 * ADR-0020 § 3 — two independent hard stops:
 *   - `submissionClosed=true`        → manual hard stop (always closed)
 *   - `autoCloseAtDue=true` + past   → lazy soft stop (closed when `now >= dueAt`)
 *
 * Returns a discriminated result so the caller can surface a specific UI
 * message without re-deriving the reason.
 */
export type SubmissionWindowCheck =
  | { open: true }
  | { open: false; reason: "submission_closed" | "auto_closed_at_due" };

export function checkSubmissionWindow(args: {
  submissionClosed: boolean;
  autoCloseAtDue: boolean;
  dueAt: Date | number | null;
  now: Date | number;
}): SubmissionWindowCheck {
  if (args.submissionClosed) {
    return { open: false, reason: "submission_closed" };
  }
  if (args.autoCloseAtDue && args.dueAt !== null) {
    if (+new Date(args.now) >= +new Date(args.dueAt)) {
      return { open: false, reason: "auto_closed_at_due" };
    }
  }
  return { open: true };
}

/**
 * Is `commentCreatedAt` still within the author self-edit window?
 *
 * CONTEXT § Comment Moderation: "แก้ comment ของตัวเองได้ภายใน 5 นาทีหลังโพสต์".
 * Anchored to `createdAt`, not to the previous `editedAt` — once 5 min has
 * passed since the original post, all subsequent edits are blocked even
 * if a 4-min-29-second edit just landed.
 */
export function isWithinCommentEditWindow(args: {
  createdAt: Date | number;
  now: Date | number;
  windowMs: number;
}): boolean {
  return +new Date(args.now) - +new Date(args.createdAt) < args.windowMs;
}
