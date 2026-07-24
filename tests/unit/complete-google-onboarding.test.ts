import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/errors";
import { completeGoogleOnboarding } from "@/lib/identity/complete-google-onboarding";

const requiredConsent = {
  termsOfUseVersion: "terms-2026-07",
  privacyNoticeVersion: "privacy-2026-07",
};
const occurredAt = new Date("2026-07-24T10:05:00.000Z");
const pending = {
  providerAccountId: "google-subject-1",
  email: "student@example.com",
};

function createDeps() {
  const register = vi.fn(async () => ({
    userId: "student-1",
    role: "STUDENT" as const,
    email: "student@example.com",
    firstName: "สมชาย",
    lastName: "ใจดี",
  }));
  return {
    deps: { onboardingService: { register }, requiredConsent },
    register,
  };
}

function validInput() {
  return {
    pending,
    firstName: "สมชาย",
    lastName: "ใจดี",
    acceptedConsent: true,
    occurredAt,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
}

describe("completeGoogleOnboarding", () => {
  it("registers the Student using the verified pending email and required consent", async () => {
    const { deps, register } = createDeps();

    const result = await completeGoogleOnboarding(deps, validInput());

    expect(result).toMatchObject({ userId: "student-1", role: "STUDENT" });
    expect(register).toHaveBeenCalledWith({
      google: {
        providerAccountId: "google-subject-1",
        email: "student@example.com",
        emailVerified: true,
      },
      firstName: "สมชาย",
      lastName: "ใจดี",
      consent: requiredConsent,
      occurredAt,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("requires the consent box before touching the onboarding service", async () => {
    const { deps, register } = createDeps();

    await expect(
      completeGoogleOnboarding(deps, {
        ...validInput(),
        acceptedConsent: false,
      })
    ).rejects.toBeInstanceOf(HttpError);
    expect(register).not.toHaveBeenCalled();
  });

  it("never lets the form override the verified Google email", async () => {
    const { deps, register } = createDeps();

    await completeGoogleOnboarding(deps, {
      ...validInput(),
      // A hostile form could try to smuggle a different address; the email is
      // taken only from the signed pending token, so this field is ignored.
      pending: { ...pending, email: "student@example.com" },
    });

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        google: expect.objectContaining({ email: "student@example.com" }),
      })
    );
  });
});
