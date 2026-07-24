import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import type { User } from "next-auth";

import { db } from "@/lib/db/client";
import { isAccountAvailableForAuthentication } from "@/lib/account/status";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { readOnboardingSessionHandoff } from "@/lib/identity/onboarding-session-handoff";

export const ONBOARDING_SESSION_PROVIDER_ID = "google-onboarding-handoff";

/**
 * A programmatic-only credentials provider: it renders no login form and is
 * invoked solely by the onboarding action through server-side `signIn`,
 * exchanging a signed one-time handoff token for a real Auth.js session. It
 * exists so a brand-new Google Student is signed in immediately after
 * onboarding instead of being bounced back to the login page for a second
 * Google click.
 *
 * It is gated by the same mutation flag as the Google provider, so it never
 * exists in a build that has not opted in. Trust rests on the signed token
 * (only this server can mint it, it is short-lived and audience-scoped), and
 * `authorize` still re-checks that the account is available before issuing a
 * session — a valid token for a suspended or deleted account is refused.
 */
export function onboardingSessionProviderIfEnabled(input?: {
  env?: Readonly<Record<string, string | undefined>>;
}): Provider[] {
  const env = input?.env ?? process.env;
  if (!identityFoundationMutationsEnabled(env)) return [];
  const secret = env.AUTH_SECRET ?? "";

  return [
    Credentials({
      id: ONBOARDING_SESSION_PROVIDER_ID,
      // No credential fields are rendered; the token is supplied by the server.
      credentials: { handoff: {} },
      async authorize(raw): Promise<User | null> {
        const token = typeof raw?.handoff === "string" ? raw.handoff : "";
        if (!token) return null;

        let claim;
        try {
          claim = await readOnboardingSessionHandoff({ token, secret });
        } catch {
          return null;
        }

        const user = await db.user.findUnique({
          where: { id: claim.userId },
          select: {
            id: true,
            role: true,
            email: true,
            accountStatus: true,
            isActive: true,
            deletedAt: true,
            student: { select: { anonymized: true } },
          },
        });
        if (!user || !user.email) return null;
        if (
          !isAccountAvailableForAuthentication({
            accountStatus: user.accountStatus,
            isActive: user.isActive,
            deletedAt: user.deletedAt,
            studentAnonymized: user.student?.anonymized ?? null,
          })
        ) {
          return null;
        }

        return {
          id: user.id,
          role: user.role,
          identifier: user.email,
          mustResetPwd: false, // dependency-gate-allow(temporary-password): Google accounts never carry a reset flow
          name: user.email,
          email: user.email,
          image: null,
        };
      },
    }),
  ];
}
