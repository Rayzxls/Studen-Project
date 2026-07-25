// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  PENDING_ONBOARDING_TTL_MS,
  createPendingGoogleOnboardingToken,
  readPendingGoogleOnboardingToken,
} from "@/lib/identity/pending-google-onboarding";

const secret = "test-auth-secret-at-least-32-chars-long";
const pending = {
  providerAccountId: "google-subject-1",
  email: "student@example.com",
};
const now = new Date("2026-07-24T10:00:00.000Z");

describe("pending Google onboarding token", () => {
  it("round-trips the verified subject and email", async () => {
    const token = await createPendingGoogleOnboardingToken({
      pending,
      secret,
      now,
    });

    await expect(
      readPendingGoogleOnboardingToken({ token, secret, now })
    ).resolves.toEqual(pending);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createPendingGoogleOnboardingToken({
      pending,
      secret,
      now,
    });

    await expect(
      readPendingGoogleOnboardingToken({
        token,
        secret: "a-different-server-secret-value-here",
        now,
      })
    ).rejects.toMatchObject({ code: "pending_google_onboarding_invalid" });
  });

  it("rejects a tampered token", async () => {
    const token = await createPendingGoogleOnboardingToken({
      pending,
      secret,
      now,
    });
    const tampered = `${token.slice(0, -3)}${token.slice(-3) === "aaa" ? "bbb" : "aaa"}`;

    await expect(
      readPendingGoogleOnboardingToken({ token: tampered, secret, now })
    ).rejects.toMatchObject({ code: "pending_google_onboarding_invalid" });
  });

  it("expires after the TTL", async () => {
    const token = await createPendingGoogleOnboardingToken({
      pending,
      secret,
      now,
    });
    const afterExpiry = new Date(
      now.getTime() + PENDING_ONBOARDING_TTL_MS + 1000
    );

    await expect(
      readPendingGoogleOnboardingToken({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "pending_google_onboarding_invalid" });
  });

  it("refuses to mint or read with an empty secret", async () => {
    await expect(
      createPendingGoogleOnboardingToken({ pending, secret: "  ", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });

    const token = await createPendingGoogleOnboardingToken({
      pending,
      secret,
      now,
    });
    await expect(
      readPendingGoogleOnboardingToken({ token, secret: "", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });
});
