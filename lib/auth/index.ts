import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "@/lib/auth/config";
import { audit } from "@/lib/audit/log";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getRequestMeta } from "@/lib/utils/request";
import { LoginSchema } from "@/lib/validation/schemas";
import { isAccountAvailableForAuthentication } from "@/lib/account/status";
import { googleProvidersIfEnabled } from "@/lib/auth/google-provider";
import { onboardingSessionProviderIfEnabled } from "@/lib/auth/onboarding-session-provider";
import { createPrismaGoogleSignInService } from "@/lib/identity/google-signin-prisma";
import {
  PENDING_ONBOARDING_COOKIE,
  PENDING_ONBOARDING_TTL_MS,
  createPendingGoogleOnboardingToken,
} from "@/lib/identity/pending-google-onboarding";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // A brand-new verified Google user carries no session yet: mint the
      // single-use onboarding handoff and redirect to collect a real name and
      // consent. Returning a string aborts session creation and redirects.
      if (user.googleOnboarding) {
        const token = await createPendingGoogleOnboardingToken({
          pending: user.googleOnboarding,
          secret: process.env.AUTH_SECRET ?? "",
        });
        (await cookies()).set(PENDING_ONBOARDING_COOKIE, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: Math.floor(PENDING_ONBOARDING_TTL_MS / 1000),
        });
        return "/onboarding";
      }

      if (user.consentRefresh) {
        return "/login?error=consent_refresh";
      }

      return true;
    },
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Identifier", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;

        const meta = await getRequestMeta();

        // Rate limit per identifier (separate IP-based limit could be added)
        const limit = await rateLimit({
          key: `login:${identifier.toLowerCase()}`,
          max: 5,
          windowSec: 900, // 15 min
          lockoutSec: 1800, // 30 min lock
        });
        if (!limit.allowed) {
          await audit({
            action: "USER_LOCKED",
            targetType: "User",
            targetId: identifier,
            reason: `Locked until ${limit.lockedUntil?.toISOString()}`,
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
          });
          return null;
        }

        const user = await db.user.findUnique({
          where: { identifier },
          select: {
            id: true,
            role: true,
            identifier: true,
            passwordHash: true,
            mustResetPwd: true,
            isActive: true,
            deletedAt: true,
          },
        });

        // Generic failure (no enumeration)
        if (
          !user ||
          !isAccountAvailableForAuthentication({
            isActive: user.isActive,
            deletedAt: user.deletedAt,
          })
        ) {
          await audit({
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: identifier,
            reason: "not_found_or_inactive",
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
          });
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          await audit({
            actorId: user.id,
            actorRole: user.role,
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: user.id,
            reason: "wrong_password",
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
          });
          return null;
        }

        await audit({
          actorId: user.id,
          actorRole: user.role,
          action: "LOGIN_SUCCESS",
          targetType: "User",
          targetId: user.id,
          ipAddress: meta.ipAddress ?? undefined,
          userAgent: meta.userAgent ?? undefined,
        });

        return {
          id: user.id,
          role: user.role,
          identifier: user.identifier,
          mustResetPwd: user.mustResetPwd,
          name: user.identifier,
          email: null,
          image: null,
        };
      },
    }),
    // Programmatic-only: establishes the session right after onboarding so a
    // new Google user is not sent back for a second click. Gated identically,
    // so it spreads to nothing when the identity flags are off.
    ...onboardingSessionProviderIfEnabled(),
    // Appended, never inserted: with the identity flags off this spreads to
    // nothing and the provider list is exactly the Credentials entry above.
    ...googleProvidersIfEnabled({
      resolveSignIn: async (assertion) => {
        const meta = await getRequestMeta();
        const resolved = await createPrismaGoogleSignInService().resolve({
          google: {
            providerAccountId: assertion.providerAccountId,
            email: assertion.email,
            emailVerified: assertion.emailVerified,
          },
          occurredAt: assertion.occurredAt,
          ipAddress: meta.ipAddress ?? undefined,
          userAgent: meta.userAgent ?? undefined,
        });
        return {
          userId: resolved.userId,
          role: resolved.role,
          email: resolved.email,
          requiresConsentRefresh: resolved.requiresConsentRefresh,
        };
      },
    }),
  ],
});
