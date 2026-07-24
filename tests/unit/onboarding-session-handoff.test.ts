// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  ONBOARDING_SESSION_HANDOFF_TTL_MS,
  createOnboardingSessionHandoff,
  readOnboardingSessionHandoff,
} from "@/lib/identity/onboarding-session-handoff";
import { createPendingGoogleOnboardingToken } from "@/lib/identity/pending-google-onboarding";

const secret = "test-auth-secret-at-least-32-chars-long";
const userId = "cmrypfaxd0004ug64qa7bc3xk";
const now = new Date("2026-07-24T10:00:00.000Z");

describe("onboarding session handoff token", () => {
  it("round-trips the freshly-created user id", async () => {
    const token = await createOnboardingSessionHandoff({ userId, secret, now });

    await expect(
      readOnboardingSessionHandoff({ token, secret, now })
    ).resolves.toEqual({ userId });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createOnboardingSessionHandoff({ userId, secret, now });

    await expect(
      readOnboardingSessionHandoff({
        token,
        secret: "a-different-server-secret-value-here",
        now,
      })
    ).rejects.toMatchObject({ code: "onboarding_session_handoff_invalid" });
  });

  it("rejects a tampered token", async () => {
    const token = await createOnboardingSessionHandoff({ userId, secret, now });
    const tampered = `${token.slice(0, -3)}${token.slice(-3) === "aaa" ? "bbb" : "aaa"}`;

    await expect(
      readOnboardingSessionHandoff({ token: tampered, secret, now })
    ).rejects.toMatchObject({ code: "onboarding_session_handoff_invalid" });
  });

  it("expires after the short TTL", async () => {
    const token = await createOnboardingSessionHandoff({ userId, secret, now });
    const afterExpiry = new Date(
      now.getTime() + ONBOARDING_SESSION_HANDOFF_TTL_MS + 1000
    );

    await expect(
      readOnboardingSessionHandoff({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "onboarding_session_handoff_invalid" });
  });

  it("refuses a pending-onboarding token: the audience is not interchangeable", async () => {
    // A token minted for the OAuth→onboarding handoff must never be replayable
    // as a session handoff, even though both are signed by the same secret.
    const pendingToken = await createPendingGoogleOnboardingToken({
      pending: {
        providerAccountId: "google-subject-1",
        email: "s@example.com",
      },
      secret,
      now,
    });

    await expect(
      readOnboardingSessionHandoff({ token: pendingToken, secret, now })
    ).rejects.toMatchObject({ code: "onboarding_session_handoff_invalid" });
  });

  it("refuses to mint or read with an empty secret", async () => {
    await expect(
      createOnboardingSessionHandoff({ userId, secret: "  ", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });

    const token = await createOnboardingSessionHandoff({ userId, secret, now });
    await expect(
      readOnboardingSessionHandoff({ token, secret: "", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });
});
