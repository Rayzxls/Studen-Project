/**
 * Shared constants for `lib/scoring/*`.
 *
 * Phase 5 origin · Phase 10 cutover to sum-based scoring (ADR-0024)
 * removed the weight invariant (`WEIGHT_SUM_BP`) — fullScore now
 * expresses per-item influence directly.
 *
 * See: ADR-0018 (publish one-way + field-class A/C edit rules; class
 * B narrowed to `{fullScore}`), ADR-0024 (sum-based scoring).
 */

/**
 * Transaction options for scoring mutation wrappers.
 *
 * Same posture as `lib/attendance/constants.ts` (Pattern 3) — Neon's dev
 * branch can take >2s to wake / acquire a connection, tripping Prisma's
 * default `maxWait` (2s). 10s wait + 15s timeout covers teacher-frequency
 * actions (bulk score-grid submit at ~10 entries/s × ~40 students).
 */
export const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/**
 * Reason field length bounds. Used for:
 *   - `SCORE_EDIT_AFTER_PUBLISH` (Important tier, edit-after-publish gate)
 *   - `SCORE_DELETE_AFTER_PUBLISH` (Critical tier, delete-after-publish gate)
 * Matches `lib/attendance/constants.ts` posture for consistency across the
 * audit family (Phase 4 `SESSION_CANCELLED`, `ATTENDANCE_BACK_EDIT` use the same).
 */
export const REASON_MIN = 5;
export const REASON_MAX = 500;

/** ScoreItem.name and ScoreEntry.note length cap. */
export const NAME_MAX = 200;
export const NOTE_MAX = 200;

/**
 * Default grade thresholds — CONTEXT § Grade.
 *
 * Inclusive lower-bound: `percent >= minPercent` wins. Stored sorted
 * DESC by `minPercent` so the linear walk in `gradeFor()` early-exits at
 * the highest matching tier.
 *
 * Per-CourseOffering override editor is deferred to a later phase (the
 * `CourseOffering.gradeRulesJson` schema column is in place and the
 * runtime resolution path reads it, but no UI surfaces editing yet).
 */
export type GradeThreshold = Readonly<{ minPercent: number; grade: number }>;

export const DEFAULT_GRADE_THRESHOLDS: readonly GradeThreshold[] = [
  { minPercent: 80, grade: 4.0 },
  { minPercent: 75, grade: 3.5 },
  { minPercent: 70, grade: 3.0 },
  { minPercent: 65, grade: 2.5 },
  { minPercent: 60, grade: 2.0 },
  { minPercent: 55, grade: 1.5 },
  { minPercent: 50, grade: 1.0 },
  { minPercent: 0, grade: 0.0 },
] as const;

/**
 * Phase 5 audit event names — past-tense per Pattern 10.
 * Re-used as string constants by score-item.ts / score-entry.ts to keep
 * the audit family discoverable from one place.
 */
export const AUDIT_SCORE_ITEM_PUBLISHED = "SCORE_ITEM_PUBLISHED";
export const AUDIT_SCORE_EDIT_AFTER_PUBLISH = "SCORE_EDIT_AFTER_PUBLISH";
export const AUDIT_SCORE_DELETE_AFTER_PUBLISH = "SCORE_DELETE_AFTER_PUBLISH";
