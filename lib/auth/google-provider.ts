import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { Role } from "@prisma/client";

import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";

export type GoogleSignInResolver = (input: {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  occurredAt: Date;
}) => Promise<{
  userId: string;
  role: Role;
  email: string;
  requiresConsentRefresh: boolean;
}>;

/**
 * NextAuth performs the OIDC checks on the Google ID token itself — issuer,
 * audience, signature, expiry, and the nonce it generated for this request —
 * through `oauth4webapi`, which is why the raw token is not re-verified here.
 * `lib/identity/google-id-token.ts` remains the supported verifier for any
 * caller that receives a raw ID token outside this NextAuth flow.
 */
export function createGoogleProvider(input: {
  clientId: string;
  clientSecret: string;
  resolveSignIn: GoogleSignInResolver;
  now?: () => Date;
}): Provider {
  const now = input.now ?? (() => new Date());

  return Google({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    // Minimum scope: prove ownership of a verified address and nothing else.
    authorization: {
      params: { scope: "openid email", prompt: "select_account" },
    },
    checks: ["pkce", "state", "nonce"],
    async profile(profile) {
      const resolved = await input.resolveSignIn({
        providerAccountId: profile.sub,
        email: profile.email,
        emailVerified: profile.email_verified === true,
        occurredAt: now(),
      });

      // There is no consent-refresh surface yet, so letting a stale-consent
      // account in would strand it with no way to become current. Refusing is
      // reversible; the flag stays off until that surface exists.
      if (resolved.requiresConsentRefresh) {
        throw new Error("identity_consent_refresh_required");
      }

      return {
        id: resolved.userId,
        role: resolved.role,
        identifier: resolved.email,
        mustResetPwd: false, // dependency-gate-allow(temporary-password): Google accounts never carry a reset flow
        name: resolved.email,
        email: resolved.email,
        image: null,
      };
    },
  });
}

/**
 * Fails closed three ways: the identity flags, a missing client id, and a
 * missing client secret. Any of them yields an empty list, so the deployed
 * provider set stays exactly as it was before this module existed.
 *
 * The mutation flag gates this, not just the read flag: resolving a sign-in
 * stamps last use and writes an Audit row, so offering the button while
 * mutations are disabled would show a control that always fails.
 */
export function googleProvidersIfEnabled(input: {
  env?: Readonly<Record<string, string | undefined>>;
  resolveSignIn: GoogleSignInResolver;
  now?: () => Date;
}): Provider[] {
  const env = input.env ?? process.env;

  if (!identityFoundationMutationsEnabled(env)) return [];

  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return [];

  return [
    createGoogleProvider({
      clientId,
      clientSecret,
      resolveSignIn: input.resolveSignIn,
      now: input.now,
    }),
  ];
}
