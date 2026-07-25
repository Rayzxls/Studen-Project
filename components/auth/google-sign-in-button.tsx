"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

/**
 * Rendering is gated by a public flag so the button never appears in a build
 * that has not opted in. This is presentation only: the real gate is
 * server-side, where the Google provider is registered only when the identity
 * mutation flag and OAuth client are configured. If someone forced
 * this flag on, `signIn("google")` would simply fail because no provider is
 * registered, so the flag can only ever hide a working button, never expose a
 * broken one in production.
 */
export function googleSignInEnabled(
  env?: Readonly<Record<string, string | undefined>>
): boolean {
  // In the browser bundle Next only inlines the *literal* reference
  // `process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED`; reading it off a passed-in
  // object is not replaced and would always be undefined. Tests pass an env
  // object explicitly, so the literal is used only on the default client path.
  const value = env
    ? env.NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED
    : process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED;
  return value === "1";
}

export function GoogleSignInButton({
  callbackUrl = "/",
  label = "เข้าสู่ระบบด้วย Google",
}: {
  callbackUrl?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        // NextAuth owns the redirect; leave pending true so the control stays
        // disabled until the browser navigates away.
        void signIn("google", { callbackUrl });
      }}
      className="btn-secondary w-full justify-center gap-2"
      aria-label={label}
    >
      <GoogleGlyph />
      {pending ? "กำลังพาไป Google..." : label}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
