import type { NextAuthConfig } from "next-auth";

import {
  SESSION_INACTIVITY_MAX_AGE_S,
  SESSION_UPDATE_AGE_S,
  isSessionPastAbsoluteCap,
} from "@/lib/auth/session-policy";

/**
 * Shared NextAuth config (used by proxy.ts)
 * No DB / Node-only imports allowed here
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // Sliding inactivity window (Release D decision): a session dies after 7
    // continuous days idle. The 30-day absolute cap is enforced in `jwt`.
    maxAge: SESSION_INACTIVITY_MAX_AGE_S,
    updateAge: SESSION_UPDATE_AGE_S,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Public paths
      const isPublic =
        path === "/" ||
        path === "/login" ||
        path === "/signup" ||
        path === "/onboarding" ||
        path === "/reset-password" ||
        path === "/privacy" ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/signup");

      // /join requires auth — redirect to login with returnTo
      if (path === "/join" && !isLoggedIn) {
        const url = new URL("/login", nextUrl);
        url.searchParams.set(
          "returnTo",
          `/join${nextUrl.search ? nextUrl.search : ""}`
        );
        return Response.redirect(url);
      }

      // ── Force reset interception ──
      // If logged in AND mustResetPwd, redirect everywhere except force-reset itself
      // and the signout endpoint (so user can escape if needed)
      if (
        isLoggedIn &&
        auth.user.mustResetPwd &&
        path !== "/reset-password/force" &&
        !path.startsWith("/api/auth")
      ) {
        return Response.redirect(new URL("/reset-password/force", nextUrl));
      }

      // ── Force-reset page requires auth ──
      if (path === "/reset-password/force") {
        return isLoggedIn;
      }

      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user, trigger }) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (user) {
        // OAuth sign-in arrives with `user.id` replaced by a random UUID; the
        // real database id rides on `dbUserId`. Credentials sign-in sets no
        // `dbUserId` and keeps its own id, so the fallback is correct there.
        token.id = user.dbUserId ?? user.id;
        token.role = user.role;
        token.identifier = user.identifier;
        token.mustResetPwd = user.mustResetPwd;
        // Anchor the absolute-session cap at sign-in. Activity extends the
        // inactivity window but can never push a session past this point.
        token.signInAt = nowSec;
      }
      // Allow session update to refresh mustResetPwd after password change
      if (trigger === "update") {
        token.mustResetPwd = false;
      }
      // Absolute 30-day cap: end the session regardless of recent activity.
      // Returning null invalidates it; pure and DB-free, so it holds in the
      // edge middleware as well.
      if (isSessionPastAbsoluteCap(token.signInAt, nowSec)) {
        return null;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "TEACHER" | "STUDENT";
        session.user.identifier = token.identifier as string;
        session.user.mustResetPwd = token.mustResetPwd as boolean;
      }
      return session;
    },
  },
  providers: [], // populated in lib/auth/index.ts (server-side, with DB)
} satisfies NextAuthConfig;
