import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    role: "ADMIN" | "TEACHER" | "STUDENT";
    identifier: string;
    mustResetPwd: boolean;
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
