/**
 * Shared constants for `lib/attendance/*` — Phase 4
 * See: ADR-0015 (lazy materialization), ADR-0016 (sparse records)
 */

/**
 * Transaction options for attendance mutation wrappers.
 *
 * Same posture as `lib/course/enrollment.ts` — Neon's dev branch occasionally
 * takes >2s to wake / acquire a connection, tripping Prisma's default
 * `maxWait`. 10s wait + 15s timeout covers teacher-frequency actions
 * (grid submit at ~10 mark/s × ~40 students = single hit).
 */
export const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/** Min/max for reason fields (back-edit reason, cancel reason). */
export const REASON_MIN = 5;
export const REASON_MAX = 500;

/**
 * Back-edit threshold — measured from `Session.scheduledStart`.
 *
 * Q8a decision (Phase 4 design grill): anchor on `scheduledStart`, not
 * `markedAt`. Late edits to old Sessions are score-impacting and forensic
 * — late edits seconds after first mark are not.
 */
export const BACK_EDIT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Note length cap (per AttendanceRecord, per TimetableSlot.location). */
export const NOTE_MAX = 200;
