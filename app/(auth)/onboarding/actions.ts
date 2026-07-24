"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HttpError } from "@/lib/errors";
import { completeGoogleOnboarding } from "@/lib/identity/complete-google-onboarding";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import {
  PENDING_ONBOARDING_COOKIE,
  readPendingGoogleOnboardingToken,
} from "@/lib/identity/pending-google-onboarding";
import { createPrismaStudentOnboardingService } from "@/lib/identity/student-onboarding-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import type { GoogleOnboardingState } from "@/components/auth/google-onboarding-form";

const GENERIC_ERROR = "ไม่สามารถสร้างบัญชีได้ กรุณาเริ่มใหม่ด้วย Google";

export async function completeGoogleOnboardingAction(
  _state: GoogleOnboardingState,
  formData: FormData
): Promise<GoogleOnboardingState> {
  if (!identityFoundationMutationsEnabled()) {
    return { error: GENERIC_ERROR };
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_ONBOARDING_COOKIE)?.value;
  if (!token) {
    return { error: "หมดเวลาการยืนยัน กรุณาเริ่มใหม่ด้วย Google" };
  }

  let pending;
  try {
    pending = await readPendingGoogleOnboardingToken({ token, secret });
  } catch {
    return { error: "หมดเวลาการยืนยัน กรุณาเริ่มใหม่ด้วย Google" };
  }

  const meta = await getRequestMeta();

  try {
    await completeGoogleOnboarding(
      {
        onboardingService: createPrismaStudentOnboardingService(),
        requiredConsent: {
          termsOfUseVersion: process.env.IDENTITY_TERMS_VERSION?.trim() ?? "",
          privacyNoticeVersion:
            process.env.IDENTITY_PRIVACY_VERSION?.trim() ?? "",
        },
      },
      {
        pending,
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        acceptedConsent: formData.get("acceptedConsent") === "on",
        occurredAt: new Date(),
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (error) {
    // A specific validation message is safe to show; anything else stays
    // generic so account state is never leaked through the onboarding form.
    if (error instanceof HttpError && error.code === "validation_error") {
      return { error: "กรุณากรอกชื่อ-นามสกุล และยอมรับข้อกำหนด" };
    }
    return { error: GENERIC_ERROR };
  }

  // The pending handoff is single-use: clear it so a reload cannot replay it.
  cookieStore.delete(PENDING_ONBOARDING_COOKIE);

  // The account and its Google identity now exist, so the standard sign-in
  // resolver will recognise the next Google click. Session establishment is a
  // separate concern from account creation and is not forged here.
  redirect("/login?onboarded=1");
}
