import type { NextAuthConfig } from "next-auth";

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
    maxAge: 12 * 60 * 60, // 12 hours absolute
    updateAge: 4 * 60 * 60, // sliding 4 hours idle
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
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.identifier = user.identifier;
        token.mustResetPwd = user.mustResetPwd;
      }
      // Allow session update to refresh mustResetPwd after password change
      if (trigger === "update") {
        token.mustResetPwd = false;
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
