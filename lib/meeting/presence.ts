/**
 * How present someone in the online room is (ADR-0053).
 *
 * Derived from two timestamps rather than stored, for the same reason ADR-0048
 * derives early warning: a stored status needs something to correct it when a
 * browser tab dies without saying goodbye, and nothing here is worth a sweeper.
 * A row that stops reporting decays through the states on its own.
 *
 * What this measures is "has the classroom open", not "is in the meeting". The
 * meeting is Google's and cannot be asked. The labels must not overclaim.
 *
 * Pure, so the thresholds are readable in one place and testable without a
 * database or a clock.
 */

/** A tab reports in on this cadence, so anything fresher than a couple of beats is live. */
export const ACTIVE_WITHIN_MS = 10_000;

/** Missed beats for this long and the tab is gone — closed, asleep, or offline. */
export const LEFT_AFTER_MS = 45_000;

/** The owner's threshold: still connected, but nobody has touched it. */
export const AWAY_AFTER_MS = 15 * 60_000;

export type PresenceState =
  /** Tab open and frontmost — the green dot. */
  | "ACTIVE"
  /** Tab open, someone is looking at something else — the hollow circle. */
  | "IDLE"
  /** Connected but untouched for AWAY_AFTER_MS — the moon. */
  | "AWAY"
  /** Stopped reporting. No longer in the room. */
  | "LEFT";

export interface PresenceSample {
  /** Any heartbeat, focused or not. */
  lastSeenAt: Date;
  /** Heartbeat sent while the tab was frontmost. */
  lastActiveAt: Date;
}

export function derivePresenceState(
  sample: PresenceSample,
  now: Date
): PresenceState {
  const sinceSeen = now.getTime() - sample.lastSeenAt.getTime();
  if (sinceSeen > LEFT_AFTER_MS) return "LEFT";

  const sinceActive = now.getTime() - sample.lastActiveAt.getTime();
  // Away is checked before active so a clock skew that makes lastActiveAt look
  // fresh cannot resurrect someone whose tab has actually stopped reporting.
  if (sinceActive >= AWAY_AFTER_MS) return "AWAY";
  if (sinceActive <= ACTIVE_WITHIN_MS) return "ACTIVE";
  return "IDLE";
}

/** Everyone the rail should draw, in the order it should draw them. */
export function presentInRoom<T extends PresenceSample>(
  samples: readonly T[],
  now: Date
): Array<T & { state: Exclude<PresenceState, "LEFT"> }> {
  const shown: Array<T & { state: Exclude<PresenceState, "LEFT"> }> = [];
  for (const sample of samples) {
    const state = derivePresenceState(sample, now);
    if (state === "LEFT") continue;
    shown.push({ ...sample, state });
  }
  return shown;
}

const LABELS: Record<Exclude<PresenceState, "LEFT">, string> = {
  ACTIVE: "เปิดแอปอยู่",
  IDLE: "สลับไปแท็บอื่น",
  AWAY: "ไม่ได้ใช้งานนานแล้ว",
};

/**
 * The state in words. Green and a hollow circle differ only by colour, which
 * is not something a screen reader or a colour-blind reader can use, so every
 * badge carries this too.
 */
export function presenceLabel(state: Exclude<PresenceState, "LEFT">): string {
  return LABELS[state];
}
