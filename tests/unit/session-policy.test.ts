import { describe, expect, it } from "vitest";

import {
  SESSION_ABSOLUTE_MAX_AGE_S,
  SESSION_INACTIVITY_MAX_AGE_S,
  SESSION_UPDATE_AGE_S,
  isSessionPastAbsoluteCap,
} from "@/lib/auth/session-policy";

const DAY_S = 24 * 60 * 60;

describe("session lifetime policy", () => {
  it("locks the windows to the Release D decision (7d idle, 30d cap, 1d rotation)", () => {
    expect(SESSION_INACTIVITY_MAX_AGE_S).toBe(7 * DAY_S);
    expect(SESSION_ABSOLUTE_MAX_AGE_S).toBe(30 * DAY_S);
    expect(SESSION_UPDATE_AGE_S).toBe(DAY_S);
    // The idle window must stay strictly inside the absolute cap, or the cap
    // could never be the binding constraint.
    expect(SESSION_INACTIVITY_MAX_AGE_S).toBeLessThan(
      SESSION_ABSOLUTE_MAX_AGE_S
    );
  });

  it("keeps a session valid right up to the absolute cap", () => {
    const signInAt = 1_000_000;
    expect(isSessionPastAbsoluteCap(signInAt, signInAt)).toBe(false);
    expect(
      isSessionPastAbsoluteCap(signInAt, signInAt + SESSION_ABSOLUTE_MAX_AGE_S)
    ).toBe(false);
  });

  it("ends a session one second past the absolute cap", () => {
    const signInAt = 1_000_000;
    expect(
      isSessionPastAbsoluteCap(
        signInAt,
        signInAt + SESSION_ABSOLUTE_MAX_AGE_S + 1
      )
    ).toBe(true);
  });

  it("never force-expires a legacy token that carries no sign-in stamp", () => {
    expect(isSessionPastAbsoluteCap(undefined, 5_000_000_000)).toBe(false);
  });
});
