"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { Conflict, HttpError } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { registerEmailPasswordStudent } from "@/lib/identity/email-signup-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import { SignupEmailSchema } from "@/lib/validation/schemas";

export type SignupState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Student self-registration with email + password (ADR-0043). Creates the
 * account, then signs the student in with the credentials they just chose. The
 * flow is flag-gated and rate-limited; the email is stored unverified, so
 * ownership is proven later by linking Google or a future verification step.
 */
export async function signupWithEmailAction(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  if (!identityFoundationMutationsEnabled()) {
    return { error: "การสมัครสมาชิกยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const parsed = SignupEmailSchema.safeParse({
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });
  if (!parsed.success) {
    return { fieldErrors: { email: "กรุณากรอกอีเมลและชื่อให้ถูกต้อง" } };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password !== confirmPassword) {
    return { fieldErrors: { confirmPassword: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };
  }
  const strength = validatePassword(password, "STUDENT");
  if (!strength.ok) {
    return { fieldErrors: { password: strength.reason } };
  }
  if (formData.get("acceptedConsent") !== "on") {
    return { fieldErrors: { consent: "กรุณายอมรับข้อกำหนดก่อนสมัคร" } };
  }

  const termsOfUseVersion = process.env.IDENTITY_TERMS_VERSION?.trim() ?? "";
  const privacyNoticeVersion =
    process.env.IDENTITY_PRIVACY_VERSION?.trim() ?? "";
  if (!termsOfUseVersion || !privacyNoticeVersion) {
    return { error: "ระบบยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const { email, firstName, lastName } = parsed.data;
  const meta = await getRequestMeta();

  const limit = await rateLimit({
    key: `signup:${meta.ipAddress ?? "unknown"}`,
    max: 5,
    windowSec: 3600,
    lockoutSec: 3600,
  });
  if (!limit.allowed) {
    return { error: "สมัครบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" };
  }

  try {
    await registerEmailPasswordStudent({
      email,
      passwordHash: await hashPassword(password),
      firstName,
      lastName,
      consent: { termsOfUseVersion, privacyNoticeVersion },
      occurredAt: new Date(),
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof Conflict && err.code === "email_taken") {
      return { fieldErrors: { email: "อีเมลนี้มีบัญชีอยู่แล้ว" } };
    }
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  // Sign in with the credentials just created. A successful sign-in throws a
  // NEXT_REDIRECT to the dashboard; a failure falls back to the login page,
  // where the account already exists and can be signed into by hand.
  try {
    await signIn("credentials", {
      identifier: email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?registered=1");
    }
    throw err;
  }

  return {}; // not reached: signIn always throws
}
