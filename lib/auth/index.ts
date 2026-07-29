import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { HttpError } from "@/lib/errors";
import { authConfig } from "@/lib/auth/config";
import { audit } from "@/lib/audit/log";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getRequestMeta } from "@/lib/utils/request";
import { LoginSchema } from "@/lib/validation/schemas";
import { evaluateCredentialsAccountGate } from "@/lib/auth/credentials-signin";
import { googleProvidersIfEnabled } from "@/lib/auth/google-provider";
import { onboardingSessionProviderIfEnabled } from "@/lib/auth/onboarding-session-provider";
import { createPrismaGoogleSignInService } from "@/lib/identity/google-signin-prisma";
import {
  PENDING_ONBOARDING_COOKIE,
  PENDING_ONBOARDING_TTL_MS,
  createPendingGoogleOnboardingToken,
} from "@/lib/identity/pending-google-onboarding";
import {
  PENDING_RECOVERY_COOKIE,
  PENDING_RECOVERY_TTL_MS,
  createPendingAccountRecoveryToken,
} from "@/lib/identity/pending-account-recovery";
import {
  PENDING_TEACHER_INVITE_COOKIE,
  PENDING_TEACHER_ONBOARDING_COOKIE,
  PENDING_TEACHER_ONBOARDING_TTL_MS,
  createPendingTeacherOnboardingToken,
} from "@/lib/identity/pending-teacher-onboarding";
import {
  PENDING_PROVIDER_LINK_COOKIE,
  readPendingProviderLinkToken,
} from "@/lib/identity/pending-provider-link";
import { createPrismaProviderLinkingService } from "@/lib/identity/provider-linking-prisma";

/**
 * Resolves a "link Google" attempt to a redirect back to Profile. Never returns
 * `true`: linking attaches an identity to the existing account rather than
 * establishing a session, so the OAuth sign-in is always aborted and the
 * caller's current session is left intact. The signed intent cookie proves which
 * account is being linked; the re-authentication window is re-checked here.
 */
async function resolveProviderLink(
  linkCookie: string,
  user: import("next-auth").User
): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "";

  let pending;
  try {
    pending = await readPendingProviderLinkToken({ token: linkCookie, secret });
  } catch {
    return "/profile?linked=error";
  }
  const reauthenticatedAt = pending.signInAt
    ? new Date(pending.signInAt * 1000)
    : null;

  // The Google subject already resolved to a linked account: never re-link,
  // just report whether that is this account or a different one.
  if (!user.googleOnboarding) {
    return user.dbUserId === pending.userId
      ? "/profile?linked=already"
      : "/profile?linked=taken";
  }

  const meta = await getRequestMeta();
  try {
    await createPrismaProviderLinkingService().linkGoogleFromAuthenticatedProfile(
      {
        actor: { userId: pending.userId, reauthenticatedAt },
        google: {
          providerAccountId: user.googleOnboarding.providerAccountId,
          email: user.googleOnboarding.email,
          // Invariant: a new-user sentinel is only produced for a verified email
          // (the resolver rejects an unverified one before the not-linked path).
          emailVerified: true,
        },
        occurredAt: new Date(),
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
    return "/profile?linked=1";
  } catch (error) {
    if (error instanceof HttpError) {
      switch (error.code) {
        case "reauthentication_required":
          return "/profile?linked=reauth";
        case "google_email_does_not_match_account":
          return "/profile?linked=mismatch";
        case "google_identity_already_linked":
        case "google_identity_already_linked_to_this_account":
          return "/profile?linked=taken";
        case "account_already_has_google_identity":
          return "/profile?linked=has_google";
      }
    }
    return "/profile?linked=error";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // A "link Google" attempt started from Profile carries a signed intent
      // cookie. Handle it before any onboarding/sign-in branch: attach the
      // returned Google identity to the account the caller is already signed in
      // as, and ALWAYS redirect (never return true) so no new session is created
      // and the existing one is preserved.
      const linkCookie = (await cookies()).get(
        PENDING_PROVIDER_LINK_COOKIE
      )?.value;
      if (linkCookie) {
        (await cookies()).delete(PENDING_PROVIDER_LINK_COOKIE);
        return resolveProviderLink(linkCookie, user);
      }

      // A brand-new verified Google user carries no session yet: mint the
      // single-use onboarding handoff and redirect to collect a real name and
      // consent. Returning a string aborts session creation and redirects.
      if (user.googleOnboarding) {
        const secret = process.env.AUTH_SECRET ?? "";
        const cookieStore = await cookies();

        // A teacher who opened `/invite/<token>` carries the raw invite token in
        // a cookie set just before the Google handoff. Tie this verified sign-in
        // to that invite and route to the teacher onboarding page instead of the
        // student one; the invite email is matched against the Google email when
        // the acceptance actually runs.
        const inviteToken = cookieStore.get(
          PENDING_TEACHER_INVITE_COOKIE
        )?.value;
        if (inviteToken) {
          const teacherToken = await createPendingTeacherOnboardingToken({
            pending: {
              providerAccountId: user.googleOnboarding.providerAccountId,
              email: user.googleOnboarding.email,
              rawInviteToken: inviteToken,
            },
            secret,
          });
          cookieStore.set(PENDING_TEACHER_ONBOARDING_COOKIE, teacherToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: Math.floor(PENDING_TEACHER_ONBOARDING_TTL_MS / 1000),
          });
          // Single-use: the raw token now lives inside the signed pending token.
          cookieStore.delete(PENDING_TEACHER_INVITE_COOKIE);
          return "/onboarding/teacher";
        }

        const token = await createPendingGoogleOnboardingToken({
          pending: user.googleOnboarding,
          secret,
        });
        cookieStore.set(PENDING_ONBOARDING_COOKIE, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: Math.floor(PENDING_ONBOARDING_TTL_MS / 1000),
        });
        return "/onboarding";
      }

      if (user.accountRecovery) {
        const token = await createPendingAccountRecoveryToken({
          pending: user.accountRecovery,
          secret: process.env.AUTH_SECRET ?? "",
        });
        (await cookies()).set(PENDING_RECOVERY_COOKIE, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: Math.floor(PENDING_RECOVERY_TTL_MS / 1000),
        });
        return "/recover";
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
            sessionVersion: true,
            isActive: true,
            deletedAt: true,
            email: true,
            accountStatus: true,
            deletionScheduledFor: true,
          },
        });

        // Generic failure (no enumeration). A recoverable Deletion Pending
        // account is not rejected here: it is unavailable for a session, but its
        // owner is routed to recovery once the password proves ownership below.
        const gate = user
          ? evaluateCredentialsAccountGate(
              {
                isActive: user.isActive,
                deletedAt: user.deletedAt,
                accountStatus: user.accountStatus,
                deletionScheduledFor: user.deletionScheduledFor,
                email: user.email,
              },
              new Date()
            )
          : null;

        if (!user || !gate || gate.kind === "unavailable") {
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

        // A Deletion Pending account inside its window is not signed in: the
        // verified password proves ownership, so route the owner to recovery
        // instead of minting a session. No LOGIN_SUCCESS is written because this
        // is not a sign-in. The sign-in callback consumes `accountRecovery` to
        // mint the recovery handoff cookie and redirect to /recover; the
        // sentinel never reaches a JWT or session (and the jwt callback fails
        // closed on it as a second guard).
        if (gate.kind === "recoverable") {
          return {
            id: `credentials-recovery:${user.id}`,
            role: user.role,
            identifier: user.identifier,
            name: user.identifier,
            email: gate.email,
            image: null,
            accountRecovery: { userId: user.id, email: gate.email },
          };
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
          sessionVersion: user.sessionVersion,
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
          sessionVersion: resolved.sessionVersion,
          requiresConsentRefresh: resolved.requiresConsentRefresh,
          requiresRecovery: resolved.requiresRecovery,
        };
      },
    }),
  ],
});
