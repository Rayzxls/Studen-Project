import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { User } from "next-auth";
import type { Role } from "@prisma/client";

import { HttpError } from "@/lib/errors";
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
    async profile(profile): Promise<User> {
      const claims = {
        providerAccountId: profile.sub,
        email: profile.email,
        emailVerified: profile.email_verified === true,
      };

      let resolved;
      try {
        resolved = await input.resolveSignIn({ ...claims, occurredAt: now() });
      } catch (error) {
        // A brand-new verified Google user has no linked account yet. Rather
        // than fail the sign-in, carry the verified claims to the sign-in
        // callback, which mints the onboarding handoff and redirects. No
        // account is created here; every other error still propagates.
        if (
          error instanceof HttpError &&
          error.code === "google_identity_not_linked"
        ) {
          return onboardingSentinel(claims.providerAccountId, claims.email);
        }
        throw error;
      }

      // A stale-consent account authenticates but has no way to re-accept yet,
      // so route it back to login instead of stranding it in a half state.
      if (resolved.requiresConsentRefresh) {
        return consentRefreshSentinel(resolved.email);
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
 * Sentinel users never reach a JWT or session: the sign-in callback returns a
 * redirect for them instead of `true`. The required role/identifier fields
 * carry placeholders only to satisfy the `User` shape and are never read.
 */
function onboardingSentinel(providerAccountId: string, email: string): User {
  return {
    id: `google-onboarding:${providerAccountId}`,
    role: "STUDENT",
    identifier: email,
    mustResetPwd: false, // dependency-gate-allow(temporary-password): sentinel placeholder, never persisted
    name: email,
    email,
    image: null,
    googleOnboarding: { providerAccountId, email },
  };
}

function consentRefreshSentinel(email: string): User {
  return {
    id: "google-consent-refresh",
    role: "STUDENT",
    identifier: email,
    mustResetPwd: false, // dependency-gate-allow(temporary-password): sentinel placeholder, never persisted
    name: email,
    email,
    image: null,
    consentRefresh: true,
  };
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
