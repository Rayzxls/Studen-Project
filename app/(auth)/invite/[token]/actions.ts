"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import {
  PENDING_TEACHER_INVITE_COOKIE,
  PENDING_TEACHER_ONBOARDING_TTL_MS,
} from "@/lib/identity/pending-teacher-onboarding";

/**
 * Stores the raw invite token in a single-use cookie and hands off to Google.
 * The verified sign-in that returns is tied to this invite by the sign-in
 * callback, which mints the teacher onboarding handoff and routes to
 * `/onboarding/teacher`. The token is a bearer secret the link holder already
 * has, so keeping it server-side (httpOnly) for the round-trip leaks nothing.
 */
export async function startTeacherInviteAction(formData: FormData) {
  if (!identityFoundationMutationsEnabled()) return;

  const token = String(formData.get("token") ?? "").trim();
  if (token.length < 32 || token.length > 512) return;

  (await cookies()).set(PENDING_TEACHER_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(PENDING_TEACHER_ONBOARDING_TTL_MS / 1000),
  });

  try {
    await signIn("google", { redirectTo: "/dashboard" });
  } catch (error) {
    // A configuration failure is safe to surface generically; a successful
    // start throws NEXT_REDIRECT to Google, which must propagate.
    if (error instanceof AuthError) {
      redirect("/login?error=google");
    }
    throw error;
  }
}
