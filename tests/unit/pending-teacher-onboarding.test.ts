// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  PENDING_TEACHER_ONBOARDING_TTL_MS,
  createPendingTeacherOnboardingToken,
  readPendingTeacherOnboardingToken,
} from "@/lib/identity/pending-teacher-onboarding";

const secret = "test-auth-secret-at-least-32-chars-long";
const pending = {
  providerAccountId: "google-subject-teacher-1",
  email: "teacher@example.com",
  rawInviteToken: "invite-token-abcdefghijklmnopqrstuvwxyz012345",
};
const now = new Date("2026-07-25T10:00:00.000Z");

describe("pending Teacher onboarding token", () => {
  it("round-trips the verified subject, email, and invite token", async () => {
    const token = await createPendingTeacherOnboardingToken({
      pending,
      secret,
      now,
    });

    await expect(
      readPendingTeacherOnboardingToken({ token, secret, now })
    ).resolves.toEqual(pending);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createPendingTeacherOnboardingToken({
      pending,
      secret,
      now,
    });

    await expect(
      readPendingTeacherOnboardingToken({
        token,
        secret: "a-different-server-secret-value-here",
        now,
      })
    ).rejects.toMatchObject({ code: "pending_teacher_onboarding_invalid" });
  });

  it("rejects a tampered token", async () => {
    const token = await createPendingTeacherOnboardingToken({
      pending,
      secret,
      now,
    });
    const tampered = `${token.slice(0, -3)}${token.slice(-3) === "aaa" ? "bbb" : "aaa"}`;

    await expect(
      readPendingTeacherOnboardingToken({ token: tampered, secret, now })
    ).rejects.toMatchObject({ code: "pending_teacher_onboarding_invalid" });
  });

  it("rejects a token missing the invite claim", async () => {
    // A well-formed pending-google-onboarding token (no invite claim) must not
    // be accepted here even though it shares the subject/email shape.
    const { createPendingGoogleOnboardingToken } =
      await import("@/lib/identity/pending-google-onboarding");
    const studentToken = await createPendingGoogleOnboardingToken({
      pending: {
        providerAccountId: pending.providerAccountId,
        email: pending.email,
      },
      secret,
      now,
    });

    await expect(
      readPendingTeacherOnboardingToken({ token: studentToken, secret, now })
    ).rejects.toMatchObject({ code: "pending_teacher_onboarding_invalid" });
  });

  it("expires after the TTL", async () => {
    const token = await createPendingTeacherOnboardingToken({
      pending,
      secret,
      now,
    });
    const afterExpiry = new Date(
      now.getTime() + PENDING_TEACHER_ONBOARDING_TTL_MS + 1000
    );

    await expect(
      readPendingTeacherOnboardingToken({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "pending_teacher_onboarding_invalid" });
  });

  it("refuses to mint or read with an empty secret", async () => {
    await expect(
      createPendingTeacherOnboardingToken({ pending, secret: "  ", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });

    const token = await createPendingTeacherOnboardingToken({
      pending,
      secret,
      now,
    });
    await expect(
      readPendingTeacherOnboardingToken({ token, secret: "", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });
});
