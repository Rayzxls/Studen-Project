import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config (used by middleware)
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
      if (
        path === "/" ||
        path === "/login" ||
        path === "/signup" ||
        path === "/reset-password" ||
        path === "/privacy" ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/signup")
      ) {
        return true;
      }

      // Everything else requires auth
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.identifier = user.identifier;
        token.mustResetPwd = user.mustResetPwd;
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
