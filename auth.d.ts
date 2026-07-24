import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    role: "ADMIN" | "TEACHER" | "STUDENT";
    identifier: string;
    mustResetPwd: boolean;
    /**
     * The real database user id, carried separately because Auth.js's OAuth
     * flow deliberately overwrites `user.id` with a random UUID (it assumes the
     * provider id lives on an Account row an adapter would persist). We run
     * OAuth with JWT sessions and no adapter, so without this field the session
     * would carry a UUID that matches no `User.id` and every `findUnique({ where:
     * { id } })` — the dashboard included — would fail and bounce to /login. The
     * sign-in callback reads it into `token.id`. Credentials sign-in keeps its
     * own id and never sets this, so it falls back to `user.id`.
     */
    dbUserId?: string;
    /**
     * Transient markers a verified Google sign-in attaches before the session
     * exists. The sign-in callback consumes them to redirect a brand-new user
     * into onboarding, or a stale-consent user back to login, and returns a
     * redirect instead of `true`, so neither marker ever reaches a JWT/session.
     */
    googleOnboarding?: { providerAccountId: string; email: string };
    consentRefresh?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "TEACHER" | "STUDENT";
      identifier: string;
      mustResetPwd: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "ADMIN" | "TEACHER" | "STUDENT";
    identifier?: string;
    mustResetPwd?: boolean;
  }
}
