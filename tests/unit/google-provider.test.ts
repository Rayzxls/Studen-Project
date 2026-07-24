import { describe, expect, it, vi } from "vitest";

import {
  googleProvidersIfEnabled,
  type GoogleSignInResolver,
} from "@/lib/auth/google-provider";
import type { Provider } from "next-auth/providers";

/**
 * NextAuth keeps caller-supplied provider config under `options` and merges it
 * at initialisation, so assertions read from there rather than the root.
 */
type GoogleProviderOptions = {
  authorization: { params: { scope: string } };
  checks: string[];
  profile: (profile: Record<string, unknown>) => Promise<unknown>;
};

function optionsOf(provider: Provider | undefined): GoogleProviderOptions {
  return (provider as unknown as { options: GoogleProviderOptions }).options;
}

const enabledEnv = {
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
  GOOGLE_CLIENT_ID: "beagle-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "beagle-client-secret",
};

function resolver() {
  return vi.fn(async () => ({
    userId: "user-1",
    role: "STUDENT" as const,
    email: "student@example.com",
    requiresConsentRefresh: false,
  }));
}

describe("Google provider registration", () => {
  it("registers nothing by default so the deployed provider set is unchanged", () => {
    expect(
      googleProvidersIfEnabled({ env: {}, resolveSignIn: resolver() })
    ).toEqual([]);
  });

  it("stays closed unless both identity flags are on", () => {
    const cases = [
      { ...enabledEnv, IDENTITY_FOUNDATION_ENABLED: "0" },
      { ...enabledEnv, IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "0" },
      { ...enabledEnv, IDENTITY_FOUNDATION_ENABLED: undefined },
    ];

    for (const env of cases) {
      expect(
        googleProvidersIfEnabled({ env, resolveSignIn: resolver() })
      ).toEqual([]);
    }
  });

  it("stays closed when the OAuth client is not configured", () => {
    const cases = [
      { ...enabledEnv, GOOGLE_CLIENT_ID: "" },
      { ...enabledEnv, GOOGLE_CLIENT_ID: "   " },
      { ...enabledEnv, GOOGLE_CLIENT_SECRET: "" },
      { ...enabledEnv, GOOGLE_CLIENT_ID: undefined },
      { ...enabledEnv, GOOGLE_CLIENT_SECRET: undefined },
    ];

    for (const env of cases) {
      expect(
        googleProvidersIfEnabled({ env, resolveSignIn: resolver() })
      ).toEqual([]);
    }
  });

  it("registers exactly one Google provider when fully configured", () => {
    const providers = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn: resolver(),
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ id: "google", type: "oidc" });
  });

  it("requests only the identity and verified-email scopes", () => {
    const [provider] = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn: resolver(),
    });

    expect(optionsOf(provider).authorization.params.scope).toBe("openid email");
  });

  it("checks pkce, state, and nonce on the callback", () => {
    const [provider] = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn: resolver(),
    });

    expect([...optionsOf(provider).checks].sort()).toEqual([
      "nonce",
      "pkce",
      "state",
    ]);
  });

  it("maps a resolved account onto the session user shape", async () => {
    const resolveSignIn = resolver();
    const [provider] = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn,
      now: () => new Date("2026-07-24T10:00:00.000Z"),
    });

    await expect(
      optionsOf(provider).profile({
        sub: "google-subject-1",
        email: "student@example.com",
        email_verified: true,
      })
    ).resolves.toEqual({
      id: "user-1",
      dbUserId: "user-1",
      role: "STUDENT",
      identifier: "student@example.com",
      mustResetPwd: false, // dependency-gate-allow(temporary-password): asserts Google accounts carry no reset flow
      name: "student@example.com",
      email: "student@example.com",
      image: null,
    });
    expect(resolveSignIn).toHaveBeenCalledWith({
      providerAccountId: "google-subject-1",
      email: "student@example.com",
      emailVerified: true,
      occurredAt: new Date("2026-07-24T10:00:00.000Z"),
    });
  });

  it("marks a brand-new verified user for onboarding instead of failing", async () => {
    const { NotFound } = await import("@/lib/errors");
    const resolveSignIn = vi.fn(async () => {
      throw new NotFound("google_identity_not_linked");
    });
    const [provider] = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn: resolveSignIn as unknown as GoogleSignInResolver,
    });

    const result = await optionsOf(provider).profile({
      sub: "new-subject",
      email: "new@example.com",
      email_verified: true,
    });

    expect(result).toMatchObject({
      googleOnboarding: {
        providerAccountId: "new-subject",
        email: "new@example.com",
      },
    });
    // No real role/identity is asserted: the sign-in callback redirects this
    // sentinel to onboarding before it can become a session.
  });

  it("marks a stale-consent account for a consent refresh instead of signing in", async () => {
    const resolveSignIn = vi.fn(async () => ({
      userId: "user-1",
      role: "STUDENT" as const,
      email: "student@example.com",
      requiresConsentRefresh: true,
    }));
    const [provider] = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn: resolveSignIn as unknown as GoogleSignInResolver,
    });

    const result = await optionsOf(provider).profile({
      sub: "google-subject-1",
      email: "student@example.com",
      email_verified: true,
    });

    expect(result).toMatchObject({ consentRefresh: true });
  });

  it("propagates a hard failure such as a suspended account", async () => {
    const { Forbidden } = await import("@/lib/errors");
    const resolveSignIn = vi.fn(async () => {
      throw new Forbidden("account_not_available");
    });
    const [provider] = googleProvidersIfEnabled({
      env: enabledEnv,
      resolveSignIn: resolveSignIn as unknown as GoogleSignInResolver,
    });

    await expect(
      optionsOf(provider).profile({
        sub: "google-subject-1",
        email: "student@example.com",
        email_verified: true,
      })
    ).rejects.toMatchObject({ code: "account_not_available" });
  });
});
