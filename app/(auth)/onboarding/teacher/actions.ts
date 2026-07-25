"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { ONBOARDING_SESSION_PROVIDER_ID } from "@/lib/auth/onboarding-session-provider";
import { HttpError } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createOnboardingSessionHandoff } from "@/lib/identity/onboarding-session-handoff";
import {
  PENDING_TEACHER_ONBOARDING_COOKIE,
  readPendingTeacherOnboardingToken,
} from "@/lib/identity/pending-teacher-onboarding";
import { createPrismaTeacherOnboardingService } from "@/lib/identity/teacher-onboarding-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import type { GoogleOnboardingState } from "@/components/auth/google-onboarding-form";

const GENERIC_ERROR = "รับคำเชิญไม่สำเร็จ กรุณาเริ่มใหม่จากลิงก์คำเชิญ";
const RESTART = "หมดเวลาการยืนยัน กรุณาเริ่มใหม่จากลิงก์คำเชิญ";

/** Maps a service error to a message safe to show without leaking account state. */
function messageForError(error: unknown): string {
  if (!(error instanceof HttpError)) return GENERIC_ERROR;
  switch (error.code) {
    case "validation_error":
      return "กรุณากรอกชื่อ-นามสกุล และยอมรับข้อกำหนด";
    case "teacher_invite_email_mismatch":
      return "อีเมล Google ไม่ตรงกับอีเมลที่ได้รับเชิญ";
    case "teacher_invite_expired":
      return "คำเชิญหมดอายุแล้ว กรุณาขอคำเชิญใหม่";
    case "teacher_invite_not_pending":
    case "teacher_invite_invalid":
      return "คำเชิญนี้ถูกใช้หรือยกเลิกแล้ว";
    case "teacher_onboarding_account_exists":
    case "teacher_onboarding_role_collision":
    case "google_identity_already_linked":
    case "teacher_onboarding_collision":
      return "อีเมลนี้มีบัญชีอยู่แล้ว";
    default:
      return GENERIC_ERROR;
  }
}

export async function completeTeacherOnboardingAction(
  _state: GoogleOnboardingState,
  formData: FormData
): Promise<GoogleOnboardingState> {
  if (!identityFoundationMutationsEnabled()) {
    return { error: GENERIC_ERROR };
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_TEACHER_ONBOARDING_COOKIE)?.value;
  if (!token) {
    return { error: RESTART };
  }

  let pending;
  try {
    pending = await readPendingTeacherOnboardingToken({ token, secret });
  } catch {
    return { error: RESTART };
  }

  // The single consent box covers both documents; without it, do not attempt
  // the mutation. Accepting means accepting the current required versions.
  const acceptedConsent = formData.get("acceptedConsent") === "on";
  if (!acceptedConsent) {
    return { error: "กรุณากรอกชื่อ-นามสกุล และยอมรับข้อกำหนด" };
  }

  const meta = await getRequestMeta();

  let userId: string;
  try {
    const result = await createPrismaTeacherOnboardingService().accept({
      rawInviteToken: pending.rawInviteToken,
      google: {
        providerAccountId: pending.providerAccountId,
        // The Google email comes only from the signed pending token, never from
        // the form, so the form cannot claim a different verified address.
        email: pending.email,
        // Invariant: a new-user Google sentinel is only produced for a verified
        // email — the sign-in resolver throws on an unverified one before the
        // not-linked branch that yields onboarding.
        emailVerified: true,
      },
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      consent: {
        termsOfUseVersion: process.env.IDENTITY_TERMS_VERSION?.trim() ?? "",
        privacyNoticeVersion:
          process.env.IDENTITY_PRIVACY_VERSION?.trim() ?? "",
      },
      occurredAt: new Date(),
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    userId = result.userId;
  } catch (error) {
    return { error: messageForError(error) };
  }

  // Single-use: clear it so a reload cannot replay the acceptance.
  cookieStore.delete(PENDING_TEACHER_ONBOARDING_COOKIE);

  // Sign the new Teacher in immediately so the invite is a single Google click.
  // The handoff is a signed, short-lived proof of the account just created; if
  // establishing it fails the account still exists, so fall back to the login
  // page rather than stranding them.
  const handoff = await createOnboardingSessionHandoff({ userId, secret });
  try {
    await signIn(ONBOARDING_SESSION_PROVIDER_ID, {
      handoff,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?onboarded=1");
    }
    throw error; // a successful sign-in throws NEXT_REDIRECT to /dashboard
  }

  return {}; // not reached: signIn always throws (redirect or AuthError)
}
